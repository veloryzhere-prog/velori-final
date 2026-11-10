import { Heart, MessageCircle, Send, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import "@/styles/tokens.css";
import "./PreviewPanel.css";

const platforms = ["IG", "FB", "LinkedIn", "X"] as const;

export interface PreviewPanelProps {
  previewContent: ReactNode;
  platform: string;
  onPlatformChange: (platform: string) => void;
}

export default function PreviewPanel({
  previewContent,
  platform,
  onPlatformChange,
}: PreviewPanelProps) {
  const [progressKey, setProgressKey] = useState(0);

  return (
    <section className="studio-preview-panel" aria-label="Preview panel">
      <h2 className="studio-preview-title">Preview</h2>
      <div className="studio-preview-phone" aria-label="Phone preview">
        <div
          key={progressKey}
          className="studio-preview-progress"
          onAnimationIteration={() => setProgressKey((key) => key + 1)}
        />
        <div className="studio-preview-platform-header">
          <span className="studio-preview-profile" aria-hidden="true">
            V
          </span>
          <span className="studio-preview-name">Your profile</span>
          <button className="studio-preview-close" type="button" aria-label="Close preview">
            <X size={12} />
          </button>
        </div>
        <div className="studio-preview-content">{previewContent}</div>
        <div className="studio-preview-actions" aria-label="Platform actions">
          <Heart aria-label="Like" />
          <MessageCircle aria-label="Comment" />
          <Send aria-label="Share" />
        </div>
      </div>
      <div className="studio-preview-platforms" role="tablist" aria-label="Preview platform">
        {platforms.map((item) => (
          <button
            key={item}
            className="studio-preview-platform"
            type="button"
            role="tab"
            aria-selected={platform.toLowerCase() === item.toLowerCase()}
            onClick={() => onPlatformChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="studio-preview-info">
        <span>Size: 1080×1350</span>
        <span>File: 2.4 MB</span>
      </div>
    </section>
  );
}
