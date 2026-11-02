import assert from "node:assert/strict";
import { test } from "node:test";
import { isReadOnlySql, parseAllowedOrigins, stripPsqlMetaCommands } from "./guards.mjs";

// -- isReadOnlySql ----------------------------------------------------------
//
// This is the guard that stands between an operator's mistake and a production
// mutation, so the negative cases matter more than the positive ones.

test("plain selects are read-only", () => {
  assert.equal(isReadOnlySql("select 1"), true);
  assert.equal(isReadOnlySql("  SELECT now()  "), true);
  assert.equal(isReadOnlySql("with x as (select 1) select * from x"), true);
  assert.equal(isReadOnlySql("explain select 1"), true);
});

test("every mutating statement is refused", () => {
  const writes = [
    "insert into t values (1)",
    "update t set a = 1",
    "delete from t",
    "drop table t",
    "alter table t add column c int",
    "create table t (id int)",
    "truncate t",
    "grant select on t to anon",
    "revoke select on t from anon",
    "comment on table t is 'x'",
    "create policy p on t for select to anon using (true)",
    "drop policy p on t",
    "reset role",
    "vacuum analyze t",
    "do $$ begin end $$",
    "call some_proc()",
    "lock table t",
  ];
  for (const sql of writes) {
    assert.equal(isReadOnlySql(sql), false, `expected refusal for: ${sql}`);
  }
});

test("privilege escalation is refused even when it looks like a read", () => {
  assert.equal(isReadOnlySql("security definer"), false);
  assert.equal(isReadOnlySql("select 1; execute grant_something()"), false);
  assert.equal(isReadOnlySql("set role postgres"), false);
  assert.equal(isReadOnlySql("set session authorization postgres"), false);
});

test("keywords hidden in strings or comments do not cause a false write", () => {
  assert.equal(isReadOnlySql("select 'please drop this table' as notice"), true);
  assert.equal(isReadOnlySql("select 1 -- delete from t"), true);
  assert.equal(isReadOnlySql("/* update t set a=1 */ select 1"), true);
});

test("empty or non-string input is refused rather than trusted", () => {
  assert.equal(isReadOnlySql(""), false);
  assert.equal(isReadOnlySql("   "), false);
  assert.equal(isReadOnlySql(null), false);
  assert.equal(isReadOnlySql(undefined), false);
  assert.equal(isReadOnlySql(42), false);
});

// -- stripPsqlMetaCommands -------------------------------------------------

test("psql meta-commands are removed so one gate file runs anywhere", () => {
  const source = "\\set ON_ERROR_STOP on\n\\echo checking\ndo $$ begin end $$;\n";
  const stripped = stripPsqlMetaCommands(source);
  assert.equal(stripped.includes("\\set"), false);
  assert.equal(stripped.includes("\\echo"), false);
  assert.equal(stripped.includes("do $$ begin end $$;"), true);
});

test("SQL that merely contains a backslash is left intact", () => {
  const source = "select '\\set' as literal;";
  assert.equal(stripPsqlMetaCommands(source).includes("\\set"), true);
});

// -- parseAllowedOrigins ---------------------------------------------------

test("https origins are accepted", () => {
  assert.deepEqual(parseAllowedOrigins("https://veloryz.online,https://www.veloryz.online"), [
    "https://veloryz.online",
    "https://www.veloryz.online",
  ]);
});

test("plain http is accepted only for loopback", () => {
  assert.deepEqual(parseAllowedOrigins("http://localhost:3001,http://127.0.0.1:3001"), [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ]);
});

test("plain http for a real host is refused", () => {
  assert.throws(() => parseAllowedOrigins("http://veloryz.online"), /HTTPS/);
  assert.throws(() => parseAllowedOrigins("http://evil.example.com"), /HTTPS/);
});

test("wildcards and paths are refused because they cannot match an Origin header", () => {
  assert.throws(() => parseAllowedOrigins("*"), /unparseable|exact origins/);
  assert.throws(() => parseAllowedOrigins("https://veloryz.online/"), /exact origins/);
  assert.throws(() => parseAllowedOrigins("https://veloryz.online/app"), /exact origins/);
  assert.throws(() => parseAllowedOrigins("https://veloryz.online?a=1"), /exact origins/);
});

test("an empty allowlist is refused rather than becoming open access", () => {
  assert.throws(() => parseAllowedOrigins(""), /at least one origin/);
  assert.throws(() => parseAllowedOrigins("   "), /at least one origin/);
  assert.throws(() => parseAllowedOrigins(undefined), /at least one origin/);
});
