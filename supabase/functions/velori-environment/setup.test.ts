import { test } from "node:test";
import assert from "node:assert/strict";
import { installManagementToken, managementKey, validateSetup } from "./setup.ts";
const candidate = "sbp_" + "unit_test_not_a_real_credential";
const project = "abcdefghijklmnopqrst";
test("setup requires exact confirmation and a bounded management token", () => {
  assert.equal(
    validateSetup({ operation: "setup", confirm: managementKey, value: candidate }),
    candidate,
  );
  for (const value of ["", "service_role_key", candidate + "\n", "sbp_" + "x".repeat(4093)])
    assert.throws(() => validateSetup({ operation: "setup", confirm: managementKey, value }));
  assert.throws(() => validateSetup({ operation: "setup", confirm: "wrong", value: candidate }));
});
test("setup uses only the server project and audits before installing", async () => {
  const events: string[] = [];
  const fetcher = (async (url, options) => {
    assert.equal(url, `https://api.supabase.com/v1/projects/${project}/secrets`);
    assert.equal(options?.redirect, "error");
    assert.equal(new Headers(options?.headers).get("authorization"), `Bearer ${candidate}`);
    if (options?.method === "POST") {
      events.push("write");
      assert.deepEqual(JSON.parse(String(options.body)), [
        { name: managementKey, value: candidate },
      ]);
    } else events.push("read");
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  const result = await installManagementToken(
    project,
    candidate,
    async (action) => {
      events.push(action);
    },
    fetcher,
  );
  assert.deepEqual(events, [
    "read",
    "environment.setup.requested",
    "write",
    "environment.setup.confirmed",
  ]);
  assert.equal(result.saved, true);
  assert.ok(!JSON.stringify(result).includes(candidate));
  await assert.rejects(
    installManagementToken("other-project/url", candidate, async () => {}, fetcher),
  );
});
test("rejected read permissions never mutate and provider errors are redacted", async () => {
  let calls = 0;
  await assert.rejects(
    installManagementToken(
      project,
      candidate,
      async () => {
        throw Error("must not audit");
      },
      (async () => {
        calls++;
        return new Response(candidate, { status: 403 });
      }) as typeof fetch,
    ),
    /cannot read/,
  );
  assert.equal(calls, 1);
});
test("audit failure prevents writes; denied writes never report success", async () => {
  let writes = 0;
  const fetcher = (async (_url, options) => {
    if (options?.method === "POST") {
      writes++;
      return new Response(candidate, { status: 403 });
    }
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  await assert.rejects(
    installManagementToken(
      project,
      candidate,
      async () => {
        throw Error("audit failed");
      },
      fetcher,
    ),
    /audit failed/,
  );
  assert.equal(writes, 0);
  await assert.rejects(
    installManagementToken(project, candidate, async () => {}, fetcher),
    /not confirmed/,
  );
  assert.equal(writes, 1);
});
test("confirmed writes with unavailable final audit have an explicit pending state", async () => {
  const result = await installManagementToken(
    project,
    candidate,
    async (action) => {
      if (action.endsWith("confirmed")) throw Error("audit offline");
    },
    (async () => new Response(null, { status: 200 })) as typeof fetch,
  );
  assert.equal(result.saved, true);
  assert.equal(result.auditPending, true);
});
