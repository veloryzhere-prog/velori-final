import React from "react";

export interface StorySlideSummary {
  id: string;
  thumbnailUrl?: string | null;
  label: string;
}

export interface StorySlideRailProps {
  slides: StorySlideSummary[];
  activeSlideId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  canAdd?: boolean;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}

export default function StorySlideRail({
  slides,
  activeSlideId,
  onSelect,
  onAdd,
  canAdd = true,
  onDuplicate,
  onDelete,
  onMove,
}: StorySlideRailProps) {
  return (
    <section className="velori-slide-rail" aria-label="Story slides">
      <div className="velori-slide-rail__header">
        <h2>Story slides</h2>

        <button type="button" disabled={!canAdd} onClick={onAdd}>
          + Add slide
        </button>
      </div>

      <div className="velori-slide-rail__items">
        {slides.map((slide, index) => (
          <article
            key={slide.id}
            className={
              slide.id === activeSlideId ? "velori-slide-card is-active" : "velori-slide-card"
            }
          >
            <button
              type="button"
              className="velori-slide-card__preview"
              aria-pressed={slide.id === activeSlideId}
              aria-label={`Select ${slide.label}`}
              onClick={() => onSelect(slide.id)}
            >
              {slide.thumbnailUrl ? (
                <img src={slide.thumbnailUrl} alt="" loading="lazy" />
              ) : (
                <span>{index + 1}</span>
              )}
            </button>

            <div className="velori-slide-card__footer">
              <span>{slide.label}</span>

              <div className="velori-slide-card__actions">
                <button
                  type="button"
                  title="Move slide left"
                  aria-label={`Move ${slide.label} earlier`}
                  disabled={index === 0}
                  onClick={() => onMove(slide.id, -1)}
                >
                  ←
                </button>

                <button
                  type="button"
                  title="Move slide right"
                  aria-label={`Move ${slide.label} later`}
                  disabled={index === slides.length - 1}
                  onClick={() => onMove(slide.id, 1)}
                >
                  →
                </button>

                <button
                  type="button"
                  title="Duplicate slide"
                  aria-label={`Duplicate ${slide.label}`}
                  disabled={!canAdd}
                  onClick={() => onDuplicate(slide.id)}
                >
                  +
                </button>

                <button
                  type="button"
                  title="Delete slide"
                  aria-label={`Delete ${slide.label}`}
                  disabled={slides.length <= 1}
                  onClick={() => onDelete(slide.id)}
                >
                  ×
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
