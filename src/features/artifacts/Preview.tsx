import { studioId } from "./identity.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { Monitor, Smartphone, RefreshCw, Square, Play } from "lucide-react";
import { useInterfaceMotion } from "../../motion/InterfaceMotion";
import type { Project } from "./model";
import { pageDocument } from "./document";
export function Preview({
  project,
  path,
  onNavigate,
  onError,
}: {
  project: Project;
  path: string;
  onNavigate: (path: string) => void;
  onError?: (message: string) => void;
}) {
  const [phone, setPhone] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [run, setRun] = useState(0);
  const [status, setStatus] = useState("Opening preview…");
  const frame = useRef<HTMLIFrameElement>(null);
  const { mode } = useInterfaceMotion();
  const channel = useMemo(() => studioId(), [project, path, run, mode]);
  const doc = useMemo(
    () =>
      pageDocument(
        project.pages.find((p) => p.path === path) ?? project.pages[0],
        project.title,
        channel,
        project.pages.map((p) => p.path),
        mode !== "off",
      ),
    [project, path, channel, mode],
  );
  useEffect(() => {
    setStatus("Opening preview…");
    const listen = (e: MessageEvent) => {
      if (
        e.source !== frame.current?.contentWindow ||
        e.origin !== "null" ||
        e.data?.source !== "velori-artifact" ||
        e.data.channel !== channel ||
        typeof e.data.message !== "string"
      )
        return;
      if (e.data.kind === "navigate" && project.pages.some((p) => p.path === e.data.message))
        onNavigate(e.data.message);
      else if (e.data.kind === "error") {
        const error = e.data.message.slice(0, 600);
        setStatus(`Preview error: ${error}`);
        onError?.(error);
      } else if (e.data.kind === "ready")
        setStatus((p) => (p.startsWith("Preview error:") ? p : "Preview ready"));
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [project, channel, onNavigate, onError]);
  return (
    <section className="vf-preview" aria-label="Live preview">
      <div className="vf-panel-bar">
        <span>
          <i />
          Live canvas <small>/{path}</small>
        </span>
        <div>
          <button
            aria-label="Desktop preview"
            aria-pressed={!phone}
            title="Desktop preview"
            onClick={() => setPhone(false)}
          >
            <Monitor size={16} />
          </button>
          <button
            aria-label="Phone preview"
            title="Phone preview"
            aria-pressed={phone}
            onClick={() => setPhone(true)}
          >
            <Smartphone size={16} />
          </button>
          <button
            aria-label="Restart preview"
            title="Restart preview"
            onClick={() => {
              setStopped(false);
              setRun((n) => n + 1);
            }}
          >
            <RefreshCw size={15} />
          </button>
          <button
            aria-label={stopped ? "Resume preview" : "Stop preview"}
            title={stopped ? "Resume preview" : "Stop preview"}
            onClick={() => setStopped(!stopped)}
          >
            {stopped ? <Play size={15} /> : <Square size={14} />}
          </button>
        </div>
      </div>
      <div className={`vf-stage${phone ? " vf-phone" : ""}`}>
        {stopped ? (
          <div className="vf-paused">
            <Square />
            <p>Canvas paused.</p>
            <button onClick={() => setStopped(false)}>Resume preview</button>
          </div>
        ) : (
          <iframe
            key={channel}
            ref={frame}
            title={`${project.title} — isolated preview`}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            srcDoc={doc}
          />
        )}
      </div>
      <div className="vf-preview-status" role="status">
        {stopped ? "Preview stopped" : status}
        <span>Isolated · no external libraries</span>
      </div>
    </section>
  );
}
