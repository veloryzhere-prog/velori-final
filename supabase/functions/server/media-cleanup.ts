import type { Ctx } from "./admin-core.ts";
import { service } from "./admin-core.ts";
import { runMediaCleanup, type CleanupDatabase } from "./media-cleanup-core.ts";

export const handleMediaCleanup = async (c: Ctx) => {
  const result = await runMediaCleanup(service() as unknown as CleanupDatabase);
  return c.json(result.body, result.status as 200 | 500);
};
