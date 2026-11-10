interface StoryEditorOnboardingProps {
  complete: boolean;
  onComplete: () => void;
}

export function StoryEditorOnboarding({ complete, onComplete }: StoryEditorOnboardingProps) {
  if (complete) return null;
  return (
    <aside aria-label="Story Studio getting started" className="story-editor-onboarding">
      <div>
        <span className="story-editor-eyebrow">QUICK START</span>
        <h2>Your story, step by step</h2>
      </div>
      <ol>
        <li>
          <strong>Build</strong>
          <span>Add slides, then bring in photos or video.</span>
        </li>
        <li>
          <strong>Style</strong>
          <span>Choose a template, add text and stickers, then apply your brand kit.</span>
        </li>
        <li>
          <strong>Review</strong>
          <span>Play the preview and export images or a supported MP4.</span>
        </li>
      </ol>
      <button onClick={onComplete} type="button">
        Got it
      </button>
    </aside>
  );
}
