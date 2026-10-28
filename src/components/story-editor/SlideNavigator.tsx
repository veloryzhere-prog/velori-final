import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { Slide } from "../../lib/story-editor/types";

interface SlideNavigatorProps {
  slides: Slide[];
  activeIndex: number;
  canAddSlide: boolean;
  canRemoveSlide: boolean;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: () => void;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}

const thumbnailBackgrounds = [
  "linear-gradient(145deg, #182a4a, #5b4db5 55%, #d37fa2)",
  "linear-gradient(145deg, #e9a76b, #c34d63 55%, #743d80)",
  "linear-gradient(145deg, #94c4b2, #367f91 55%, #263b68)",
  "linear-gradient(145deg, #efcc83, #da806a 55%, #823f65)",
  "linear-gradient(145deg, #a6a1ed, #6960c4 55%, #354777)",
];

export function SlideNavigator({
  slides,
  activeIndex,
  canAddSlide,
  canRemoveSlide,
  onSelect,
  onAdd,
  onRemove,
  collapsible = false,
  collapsed = false,
  onToggle,
}: SlideNavigatorProps) {
  return (
    <section
      aria-label="Story slides"
      className="story-editor-slide-navigator"
      data-collapsed={collapsible && collapsed}
    >
      <div className="story-editor-storyboard-heading">
        {collapsible ? (
          <button
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand storyboard" : "Collapse storyboard"}
            className="story-editor-storyboard-toggle"
            onClick={onToggle}
            type="button"
          >
            <strong>Slides</strong>
            <span>
              {slides.length} / 10 · {activeIndex + 1} selected
            </span>
            <ChevronDown aria-hidden="true" size={15} />
          </button>
        ) : (
          <>
            <strong>Storyboard</strong>
            <span>{slides.length} / 10 slides</span>
          </>
        )}
        {collapsible && collapsed ? (
          <button
            aria-label="Add slide"
            className="story-editor-icon-button"
            disabled={!canAddSlide}
            onClick={onAdd}
            type="button"
          >
            <Plus size={16} />
          </button>
        ) : null}
        <button
          aria-label="Delete current slide"
          className="story-editor-icon-button"
          disabled={!canRemoveSlide}
          onClick={onRemove}
          title={canRemoveSlide ? "Delete current slide" : "A story needs at least one slide"}
          type="button"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="story-editor-slide-list" role="list">
        {slides.map((slide, index) => (
          <div className="story-editor-slide-item" key={slide.id} role="listitem">
            <button
              aria-current={activeIndex === index ? "step" : undefined}
              aria-label={`Select slide ${index + 1}`}
              className="story-editor-slide-card"
              data-active={activeIndex === index}
              onClick={() => onSelect(index)}
              type="button"
            >
              <span
                className="story-editor-slide-thumbnail"
                style={{
                  background:
                    slide.backgroundType === "solid" && slide.background
                      ? slide.background
                      : slide.backgroundType === "gradient" && slide.background === "sunset"
                        ? "linear-gradient(145deg, #f1a46d, #c64d72 55%, #67417e)"
                        : thumbnailBackgrounds[index % thumbnailBackgrounds.length],
                  backgroundImage:
                    slide.backgroundType === "image" && slide.background
                      ? `url("${slide.background}")`
                      : undefined,
                }}
              >
                {slide.mediaUrl && slide.mediaType !== "video" ? (
                  <img alt="" aria-hidden="true" src={slide.mediaUrl} />
                ) : null}
                {slide.mediaType === "video" && slide.mediaUrl ? (
                  <video aria-hidden="true" muted playsInline src={slide.mediaUrl} />
                ) : null}
                {slide.mediaType === "video" ? <i aria-label="Video clip" /> : null}
                <small>{String(index + 1).padStart(2, "0")}</small>
              </span>
              <span className="story-editor-slide-meta">
                <strong>{index + 1}</strong>
                <small>{slide.duration}s</small>
              </span>
            </button>
          </div>
        ))}
        <button
          aria-label="Add slide"
          className="story-editor-add-slide"
          disabled={!canAddSlide}
          onClick={onAdd}
          type="button"
        >
          <Plus size={18} />
          <span>{canAddSlide ? "Add" : "Limit"}</span>
        </button>
      </div>
    </section>
  );
}
