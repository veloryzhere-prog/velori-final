import {
  ArrowLeftRight,
  ChartNoAxesColumnIncreasing,
  Film,
  Layers,
  Music2,
  Image,
  Smile,
  Square,
  Star,
  Sticker,
  Type,
  WandSparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "@/styles/tokens.css";
import "./ToolsTab.css";

export type StudioKind = "post" | "reel" | "story";

interface ToolDefinition {
  name: string;
  Icon: typeof Type;
  label?: string;
}

const toolsByStudio: Record<StudioKind, ToolDefinition[]> = {
  post: [
    { name: "Text", Icon: Type },
    { name: "Image", Icon: Image },
    { name: "Shape", Icon: Square },
    { name: "Icon", Icon: Star },
    { name: "Background", Icon: Layers },
    { name: "Sticker", Icon: Smile },
    { name: "Music", Icon: Music2 },
  ],
  reel: [
    { name: "Clip", Icon: Film },
    { name: "Text", Icon: Type },
    { name: "Sticker", Icon: Smile },
    { name: "Transition", Icon: ArrowLeftRight },
    { name: "Effect", Icon: WandSparkles },
    { name: "Audio", Icon: Music2 },
  ],
  story: [
    { name: "Text", Icon: Type },
    { name: "Media", Icon: Image },
    { name: "Sticker", Icon: Sticker },
    { name: "Interactive", Icon: ChartNoAxesColumnIncreasing },
    { name: "Transition", Icon: ArrowLeftRight },
    { name: "Audio", Icon: Music2 },
  ],
};

export interface ToolsTabProps {
  studio: StudioKind;
  activeTool?: string | null;
  onSelectTool: (toolName: string) => void;
}

export default function ToolsTab({ studio, activeTool, onSelectTool }: ToolsTabProps) {
  const [localActiveTool, setLocalActiveTool] = useState<string | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const selectedTool = activeTool === undefined ? localActiveTool : activeTool;

  const selectTool = (toolName: string) => {
    setLocalActiveTool(toolName);
    onSelectTool(toolName);
  };

  useEffect(() => {
    if (!musicFile) {
      setMusicUrl(null);
      return;
    }
    const url = URL.createObjectURL(musicFile);
    setMusicUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [musicFile]);

  return (
    <>
      <div className="studio-tools-tab" role="toolbar" aria-label={`${studio} tools`}>
        {toolsByStudio[studio].map(({ name, Icon }) => (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={selectedTool === name}
            onClick={() => selectTool(name)}
          >
            <Icon size={20} aria-hidden="true" />
          </button>
        ))}
      </div>
      {studio === "post" && selectedTool === "Music" && (
        <section className="studio-music-tool" aria-label="Music preview">
          <div className="studio-music-heading">
            <Music2 size={17} aria-hidden="true" />
            <strong>Music preview</strong>
          </div>
          <p>
            Preview a local audio file. Post publishing does not currently attach a separate
            soundtrack.
          </p>
          <input
            ref={musicInputRef}
            className="studio-music-file-input"
            type="file"
            accept="audio/*"
            aria-label="Choose music file"
            onChange={(event) => setMusicFile(event.currentTarget.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="studio-music-choose"
            onClick={() => musicInputRef.current?.click()}
          >
            {musicFile ? "Choose another file" : "Choose audio"}
          </button>
          {musicFile && musicUrl ? (
            <div className="studio-music-player">
              <span title={musicFile.name}>{musicFile.name}</span>
              <audio controls preload="metadata" src={musicUrl}>
                Audio playback is not supported by this browser.
              </audio>
              <button type="button" onClick={() => setMusicFile(null)}>
                Remove preview
              </button>
            </div>
          ) : null}
        </section>
      )}
    </>
  );
}
