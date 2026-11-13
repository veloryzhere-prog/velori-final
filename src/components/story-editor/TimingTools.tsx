import type { StoryTransitionType } from "../../lib/story-editor/types";

export interface StoryTransitionSettings {
  type: StoryTransitionType;
  duration: number;
}

interface TimingToolsProps {
  slideDuration: number;
  transition: StoryTransitionSettings;
  loopStory: boolean;
  loopSlide: boolean;
  hasNextSlide: boolean;
  onSlideDurationChange: (duration: number) => void;
  onTransitionChange: (transition: StoryTransitionSettings) => void;
  onLoopStoryChange: (loop: boolean) => void;
  onLoopSlideChange: (loop: boolean) => void;
}

const transitionLabels: Record<StoryTransitionType, string> = {
  fade: "Fade",
  slide: "Slide",
  zoom: "Zoom",
  spin: "Spin",
  wipe: "Wipe",
  glitch: "Glitch",
};

export function TimingTools({
  slideDuration,
  transition,
  loopStory,
  loopSlide,
  hasNextSlide,
  onSlideDurationChange,
  onTransitionChange,
  onLoopStoryChange,
  onLoopSlideChange,
}: TimingToolsProps) {
  return (
    <section aria-label="Slide timing and transitions" className="story-editor-timing-tools">
      <div className="story-editor-section-heading">
        <div>
          <span className="story-editor-eyebrow">TIMING & TRANSITIONS</span>
          <h2>Set the pace</h2>
        </div>
      </div>

      <label className="story-editor-sticker-range">
        <span>
          Slide duration <small>{slideDuration.toFixed(1)}s</small>
        </span>
        <input
          aria-label="Slide duration in seconds"
          max={20}
          min={1}
          onChange={(event) => onSlideDurationChange(Number(event.target.value))}
          step={0.1}
          type="range"
          value={Math.min(20, Math.max(1, slideDuration))}
        />
        <small className="story-editor-tool-hint">Music-selected slides can match the chosen excerpt length, up to 20 seconds.</small>
      </label>

      <label className="story-editor-select">
        <span>{hasNextSlide ? "Transition to next slide" : "Transition when story loops"}</span>
        <select
          onChange={(event) =>
            onTransitionChange({
              ...transition,
              type: event.target.value as StoryTransitionType,
            })
          }
          value={transition.type}
        >
          {Object.entries(transitionLabels).map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="story-editor-sticker-range">
        <span>
          Transition duration <small>{transition.duration.toFixed(1)}s</small>
        </span>
        <input
          max={1.5}
          min={0.3}
          onChange={(event) =>
            onTransitionChange({ ...transition, duration: Number(event.target.value) })
          }
          step={0.1}
          type="range"
          value={transition.duration}
        />
      </label>

      <label className="story-editor-check">
        <input
          checked={loopSlide}
          onChange={(event) => onLoopSlideChange(event.target.checked)}
          type="checkbox"
        />
        Loop this slide
      </label>
      <label className="story-editor-check">
        <input
          checked={loopStory}
          onChange={(event) => onLoopStoryChange(event.target.checked)}
          type="checkbox"
        />
        Loop entire story
      </label>
      <p className="story-editor-tool-hint">
        Individual slide loop holds on this slide during preview. Story loop returns from the last
        slide to the first.
      </p>
    </section>
  );
}
