export type CleanupItem = {
  id: number;
  bucket_id: "post-media" | "story-media" | "reel-media";
  object_path: string;
};

export type CleanupDatabase = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: Error | null }>;
  storage: {
    from: (bucket: CleanupItem["bucket_id"]) => {
      remove: (paths: string[]) => Promise<{ error: Error | null }>;
    };
  };
};

const isMissingObject = (error: Error) => {
  const storageError = error as Error & {
    error?: string;
    statusCode?: number | string;
  };
  const code = storageError.error ?? "";
  return (
    String(storageError.statusCode) === "404" && (code === "NoSuchKey" || code === "not_found")
  );
};

const recordFailure = async (db: CleanupDatabase, item: CleanupItem, message: string) => {
  const { error } = await db.rpc("release_storage_cleanup_item", {
    p_id: item.id,
    p_error: message.slice(0, 500),
  });
  if (error) console.error("Could not release a failed media cleanup claim.");
};

export const runMediaCleanup = async (db: CleanupDatabase) => {
  const { data, error } = await db.rpc("claim_storage_cleanup_batch", {
    p_batch_size: 1000,
  });

  if (error) {
    console.error("Could not claim the expired media cleanup batch.");
    return {
      body: { error: "Media cleanup is temporarily unavailable." },
      status: 500,
    };
  }

  const items = (data ?? []) as CleanupItem[];
  let removed = 0;
  let failed = 0;
  const batches = new Map<CleanupItem["bucket_id"], CleanupItem[]>();
  for (const item of items) {
    const bucketItems = batches.get(item.bucket_id) ?? [];
    bucketItems.push(item);
    batches.set(item.bucket_id, bucketItems);
  }

  for (const [bucket, bucketItems] of batches) {
    const paths = bucketItems.map((item) => item.object_path);
    const { error: removeError } = await db.storage.from(bucket).remove(paths);
    if (!removeError) {
      const { error: ackError } = await db.rpc("ack_storage_cleanup_batch", {
        p_ids: bucketItems.map((item) => item.id),
      });
      if (ackError) {
        console.error("Storage removal succeeded but queue acknowledgement failed.");
        failed += bucketItems.length;
      } else {
        removed += bucketItems.length;
      }
      continue;
    }

    // A mixed batch can fail because of a single bad or already-missing key.
    // Retry paths one at a time so successful removals do not block the rest.
    for (const item of bucketItems) {
      const { error: itemError } = await db.storage.from(bucket).remove([item.object_path]);
      if (itemError) {
        if (isMissingObject(itemError)) {
          const { error: ackError } = await db.rpc("ack_storage_cleanup_batch", {
            p_ids: [item.id],
          });
          if (!ackError) {
            removed += 1;
            continue;
          }
        }
        await recordFailure(db, item, itemError.message);
        failed += 1;
        continue;
      }

      const { error: ackError } = await db.rpc("ack_storage_cleanup_batch", {
        p_ids: [item.id],
      });
      if (ackError) {
        console.error("Storage removal succeeded but queue acknowledgement failed.");
        failed += 1;
      } else {
        removed += 1;
      }
    }
  }

  return {
    body: { claimed: items.length, removed, failed },
    status: failed ? 500 : 200,
  };
};
