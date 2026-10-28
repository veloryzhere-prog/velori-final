import { runMediaCleanup } from "./media-cleanup-core.ts";

type CleanupItem = {
  id: number;
  bucket_id: "post-media" | "story-media" | "reel-media";
  object_path: string;
};

type RpcCall = { name: string; args: Record<string, unknown> };
type RemoveCall = { bucket: string; paths: string[] };

const setup = (
  items: CleanupItem[],
  remove: (bucket: string, paths: string[]) => Error | null = () => null,
) => {
  const rpcCalls: RpcCall[] = [];
  const removeCalls: RemoveCall[] = [];
  const fakeDb = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return name === "claim_storage_cleanup_batch"
        ? { data: items, error: null }
        : { data: null, error: null };
    },
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => {
          removeCalls.push({ bucket, paths });
          return { data: null, error: remove(bucket, paths) };
        },
      }),
    },
  };

  return {
    fakeDb,
    rpcCalls,
    removeCalls,
  };
};

Deno.test("cleanup groups objects by bucket and acknowledges removed batches", async () => {
  const state = setup([
    { id: 1, bucket_id: "post-media", object_path: "a/one.jpg" },
    { id: 2, bucket_id: "post-media", object_path: "a/two.jpg" },
    { id: 3, bucket_id: "story-media", object_path: "b/one.jpg" },
  ]);

  const response = await runMediaCleanup(state.fakeDb);

  if (response.status !== 200) throw new Error("Expected successful cleanup response.");
  if (JSON.stringify(response.body) !== JSON.stringify({ claimed: 3, removed: 3, failed: 0 })) {
    throw new Error("Cleanup counts should include all acknowledged objects.");
  }
  if (state.removeCalls.length !== 2 || state.removeCalls[0].paths.length !== 2) {
    throw new Error("Cleanup must batch objects by bucket.");
  }
  const acknowledgements = state.rpcCalls.filter(
    (call) => call.name === "ack_storage_cleanup_batch",
  );
  if (acknowledgements.length !== 2) throw new Error("Each bucket batch must be acknowledged.");
});

Deno.test("cleanup acknowledges an already-missing object idempotently", async () => {
  const missing = Object.assign(new Error("object missing"), {
    error: "NoSuchKey",
    statusCode: "404",
  });
  const state = setup(
    [{ id: 9, bucket_id: "reel-media", object_path: "c/gone.mp4" }],
    () => missing,
  );

  const response = await runMediaCleanup(state.fakeDb);

  if (response.status !== 200) throw new Error("Missing objects should be treated as removed.");
  if (JSON.stringify(response.body) !== JSON.stringify({ claimed: 1, removed: 1, failed: 0 })) {
    throw new Error("The missing object should be acknowledged once.");
  }
  if (!state.rpcCalls.some((call) => call.name === "ack_storage_cleanup_batch")) {
    throw new Error("The missing object must be removed from the queue.");
  }
});

Deno.test("cleanup releases failed objects for retry and reports failure", async () => {
  const state = setup(
    [{ id: 11, bucket_id: "story-media", object_path: "d/retry.jpg" }],
    () => new Error("storage unavailable"),
  );

  const response = await runMediaCleanup(state.fakeDb);

  if (response.status !== 500) throw new Error("Failed cleanup should return HTTP 500.");
  if (JSON.stringify(response.body) !== JSON.stringify({ claimed: 1, removed: 0, failed: 1 })) {
    throw new Error("Failed objects should be counted for retry.");
  }
  const release = state.rpcCalls.find((call) => call.name === "release_storage_cleanup_item");
  if (release?.args.p_id !== 11) throw new Error("The failed queue item must be released.");
});
