/* Copyright © 2026 VELORYZ. Browser execution is opt-in and license gated. */
import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import { projectPlan, type Command } from "./policy.ts";
import type { SourceFile } from "../multi-file.ts";
export type RuntimeEvent = {
  kind: "status" | "output" | "error" | "preview";
  message: string;
  time: string;
};
let owner: BrowserRuntime | null = null;
export class BrowserRuntime {
  private instance?: WebContainer;
  private processes = new Set<WebContainerProcess>();
  private listeners: (() => void)[] = [];
  private disposed = false;
  private active = false;
  constructor(private event: (event: RuntimeEvent) => void) {}
  private emit(kind: RuntimeEvent["kind"], message: string) {
    if (!this.disposed)
      this.event({ kind, message: message.slice(-16000), time: new Date().toISOString() });
  }
  async boot() {
    if (owner) throw Error("Another project owns the browser runtime. Stop it first.");
    if (this.disposed) throw Error("Runtime cancelled.");
    owner = this;
    try {
      const { WebContainer } = await import("@webcontainer/api");
      if (this.disposed) throw Error("Runtime cancelled.");
      this.instance = await WebContainer.boot({
        coep: "require-corp",
        workdirName: "velori-project",
      });
      if (this.disposed) {
        this.instance.teardown();
        this.instance = undefined;
        throw Error("Runtime cancelled.");
      }
      this.listeners.push(
        this.instance.on("server-ready", (_port, url) => {
          if (
            new URL(url).protocol !== "https:" ||
            new URL(url).origin === window.location.origin
          ) {
            this.emit("error", "Invalid runtime preview URL.");
            return;
          }
          this.emit("preview", url);
        }),
      );
      this.listeners.push(this.instance.on("error", (error) => this.emit("error", error.message)));
      this.emit("status", "Browser runtime initialized.");
    } catch (e) {
      if (owner === this) owner = null;
      throw e;
    }
  }
  async mount(files: SourceFile[]) {
    if (!this.instance) throw Error("Initialize the runtime first.");
    const plan = projectPlan(files);
    // A fresh runtime is mounted once; no stale or deleted files survive a restart.
    for (const file of plan.files) {
      if (/^\.(?:npmrc|yarnrc)/.test(file.path))
        throw Error("Custom registry configuration is not supported.");
      const parent = file.path.split("/").slice(0, -1).join("/");
      if (parent) await this.instance.fs.mkdir(parent, { recursive: true });
      await this.instance.fs.writeFile(file.path, file.content);
    }
    this.emit("status", `Mounted ${files.length} local source files.`);
    return plan;
  }
  async command(command: Command, wait: boolean, signal: AbortSignal, timeout = 120000) {
    if (!this.instance || this.active)
      throw Error("Runtime is unavailable or a command is already running.");
    signal.throwIfAborted();
    this.active = true;
    let process: WebContainerProcess | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    const kill = () => process?.kill();
    let output = "";
    try {
      process = await this.instance.spawn(command.executable, command.args);
      this.processes.add(process);
      signal.addEventListener("abort", kill, { once: true });
      if (signal.aborted || this.disposed) process.kill();
      this.emit("status", `$ ${command.executable} ${command.args.join(" ")}`);
      void process.output
        .pipeTo(
          new WritableStream({
            write: (chunk) => {
              output = (output + chunk).slice(-30000);
              this.emit("output", chunk);
            },
          }),
        )
        .catch(() => undefined);
      if (!wait) {
        void process.exit.then((code) => {
          this.emit("status", `Development server exited (${code}).`);
          if (process) this.processes.delete(process);
          signal.removeEventListener("abort", kill);
        });
        return {
          exitCode: 0,
          output: "Server process started; waiting for the runtime server-ready event.",
        };
      }
      timer = setTimeout(kill, timeout);
      const exitCode = await process.exit;
      signal.throwIfAborted();
      return { exitCode, output };
    } finally {
      this.active = false;
      if (timer) clearTimeout(timer);
      if (wait) {
        signal.removeEventListener("abort", kill);
        if (process) this.processes.delete(process);
      }
    }
  }
  stop() {
    this.disposed = true;
    for (const process of this.processes) process.kill();
    for (const listener of this.listeners) listener();
    this.processes.clear();
    this.listeners = [];
    this.instance?.teardown();
    this.instance = undefined;
    if (owner === this) owner = null;
  }
}
