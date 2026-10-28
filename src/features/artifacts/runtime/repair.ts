/* Copyright © 2026 VELORYZ. */
import { applyRevision } from "./policy.ts";
import { parseSourceFiles, type SourceFile } from "../multi-file.ts";
export type BuildResult = { exitCode: number; output: string };
/** Adapters execute only inside their reviewed sandbox. No host shell is provided. */
export async function repairBuild(options: {
  files: SourceFile[];
  attempts: number;
  signal: AbortSignal;
  build: (files: SourceFile[], signal: AbortSignal) => Promise<BuildResult>;
  propose: (files: SourceFile[], diagnostic: string, signal: AbortSignal) => Promise<SourceFile[]>;
  approve: (before: SourceFile[], next: SourceFile[]) => Promise<boolean>;
  event: (message: string, result?: BuildResult) => void;
}) {
  if (!Number.isInteger(options.attempts) || options.attempts < 0 || options.attempts > 3)
    throw Error("Use zero to three repair attempts.");
  const original = parseSourceFiles(options.files);
  let files = original,
    previous = "";
  for (let attempt = 0; attempt <= options.attempts; attempt++) {
    options.signal.throwIfAborted();
    const result = await options.build(files, options.signal);
    options.signal.throwIfAborted();
    options.event(result.exitCode === 0 ? "Build succeeded." : "Build failed.", result);
    if (result.exitCode === 0) return { files, result, repaired: attempt > 0 };
    if (attempt === options.attempts || result.output === previous)
      return { files: original, result, repaired: false };
    previous = result.output;
    const next = parseSourceFiles(
      await options.propose(files, result.output.slice(-12000), options.signal),
    );
    options.signal.throwIfAborted();
    if (!(await options.approve(files, next))) return { files: original, result, repaired: false };
    files = applyRevision(files, files, next, false);
    options.event(`Approved repair ${attempt + 1} applied in the sandbox.`);
  }
  throw Error("Invalid repair state.");
}
