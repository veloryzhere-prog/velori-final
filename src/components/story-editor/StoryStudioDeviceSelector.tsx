import { Monitor, Smartphone } from "lucide-react";
import { Dialog } from "../ui";

export type StoryStudioDeviceLayout = "computer" | "mobile";

interface StoryStudioDeviceSelectorProps {
  onClose: () => void;
  onSelect: (layout: StoryStudioDeviceLayout) => void;
}

export function StoryStudioDeviceSelector({ onClose, onSelect }: StoryStudioDeviceSelectorProps) {
  return (
    <Dialog
      className="story-studio-device-dialog"
      description="Select how you want to create your story."
      dismissOnBackdrop={false}
      onClose={onClose}
      open
      title="Choose Your Editing Experience"
    >
      <div aria-label="Editing experience" className="story-studio-device-options">
        <button
          className="story-studio-device-option"
          onClick={() => onSelect("computer")}
          type="button"
        >
          <span className="story-studio-device-icon">
            <Monitor aria-hidden="true" size={25} />
          </span>
          <span>
            <strong>Computer Studio</strong>
            <small>Full workspace with desktop editing controls.</small>
          </span>
        </button>
        <button
          className="story-studio-device-option"
          onClick={() => onSelect("mobile")}
          type="button"
        >
          <span className="story-studio-device-icon">
            <Smartphone aria-hidden="true" size={25} />
          </span>
          <span>
            <strong>Android / Mobile Studio</strong>
            <small>Touch-first editing designed for your phone.</small>
          </span>
        </button>
      </div>
    </Dialog>
  );
}
