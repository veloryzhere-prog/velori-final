import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Button } from "../primitives";
import { AreaField, SelectField, TextField, ToggleField } from "../widgets";
import type { CmsContentBlock } from "../../cms-public-page";

const BLOCK_OPTIONS = [
  { value: "heading", label: "Heading" },
  { value: "paragraph", label: "Paragraph" },
  { value: "quote", label: "Quote" },
  { value: "list", label: "List" },
  { value: "callout", label: "Info or warning" },
  { value: "divider", label: "Divider" },
  { value: "faq", label: "FAQ" },
  { value: "image", label: "Image" },
  { value: "button", label: "Button or link" },
  { value: "html", label: "HTML block" },
];

function newBlock(type: CmsContentBlock["type"]): CmsContentBlock {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `block_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  switch (type) {
    case "heading":
      return { id, type, title: "New section", level: 2 };
    case "paragraph":
    case "quote":
    case "callout":
      return { id, type, text: "" };
    case "list":
      return { id, type, items: [""] };
    case "faq":
      return { id, type, title: "Question", text: "Answer" };
    case "image":
      return { id, type, url: "", alt: "" };
    case "button":
      return { id, type, title: "Learn more", url: "/about" };
    case "html":
      return { id, type, text: "" };
    case "divider":
      return { id, type };
  }
}

export function CmsBlockEditor({
  blocks,
  onChange,
}: {
  blocks: CmsContentBlock[];
  onChange: (blocks: CmsContentBlock[]) => void;
}) {
  const [addType, setAddType] = useState<CmsContentBlock["type"]>("heading");

  const updateBlock = (index: number, patch: Partial<CmsContentBlock>) => {
    onChange(blocks.map((block, current) => (current === index ? { ...block, ...patch } : block)));
  };
  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const reordered = [...blocks];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    onChange(reordered);
  };

  return (
    <div className="cms-block-editor">
      {blocks.length === 0 ? (
        <p className="cms-block-empty">Start with a section heading, then add content blocks.</p>
      ) : null}
      {blocks.map((block, index) => (
        <details className="cms-block-item" key={block.id} open>
          <summary>
            <span>
              {index + 1}. {BLOCK_OPTIONS.find((option) => option.value === block.type)?.label}
            </span>
            <span className="cms-block-actions">
              <Button
                type="button"
                aria-label={`Move block ${index + 1} up`}
                disabled={index === 0}
                onClick={(event) => {
                  event.preventDefault();
                  moveBlock(index, -1);
                }}
              >
                <ArrowUp size={15} />
              </Button>
              <Button
                type="button"
                aria-label={`Move block ${index + 1} down`}
                disabled={index === blocks.length - 1}
                onClick={(event) => {
                  event.preventDefault();
                  moveBlock(index, 1);
                }}
              >
                <ArrowDown size={15} />
              </Button>
              <Button
                type="button"
                aria-label={`Duplicate block ${index + 1}`}
                onClick={(event) => {
                  event.preventDefault();
                  const copy = {
                    ...block,
                    id: newBlock(block.type).id,
                    items: block.items ? [...block.items] : undefined,
                  };
                  onChange([...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)]);
                }}
              >
                <Copy size={15} />
              </Button>
              <Button
                type="button"
                aria-label={`${block.visible === false ? "Show" : "Hide"} block ${index + 1}`}
                onClick={(event) => {
                  event.preventDefault();
                  updateBlock(index, { visible: block.visible === false });
                }}
              >
                {block.visible === false ? <Eye size={15} /> : <EyeOff size={15} />}
              </Button>
              <Button
                type="button"
                aria-label={`Delete block ${index + 1}`}
                onClick={(event) => {
                  event.preventDefault();
                  onChange(blocks.filter((_, current) => current !== index));
                }}
              >
                <Trash2 size={15} />
              </Button>
            </span>
          </summary>
          <div className="cms-block-fields">
            {block.type === "heading" ? (
              <>
                <TextField
                  label="Heading"
                  value={block.title ?? ""}
                  onChange={(title) => updateBlock(index, { title })}
                />
                <SelectField
                  label="Heading level"
                  value={String(block.level ?? 2)}
                  options={[2, 3, 4].map((level) => ({ value: String(level), label: `H${level}` }))}
                  onChange={(level) => updateBlock(index, { level: Number(level) })}
                />
              </>
            ) : null}
            {block.type === "paragraph" || block.type === "quote" ? (
              <AreaField
                label={block.type === "quote" ? "Quote" : "Paragraph"}
                value={block.text ?? ""}
                onChange={(text) => updateBlock(index, { text })}
                rows={4}
              />
            ) : null}
            {block.type === "callout" ? (
              <>
                <SelectField
                  label="Callout type"
                  value={block.tone ?? "info"}
                  options={[
                    { value: "info", label: "Information" },
                    { value: "warning", label: "Warning" },
                  ]}
                  onChange={(tone) => updateBlock(index, { tone: tone as "info" | "warning" })}
                />
                <TextField
                  label="Optional title"
                  value={block.title ?? ""}
                  onChange={(title) => updateBlock(index, { title })}
                />
                <AreaField
                  label="Message"
                  value={block.text ?? ""}
                  onChange={(text) => updateBlock(index, { text })}
                  rows={3}
                />
              </>
            ) : null}
            {block.type === "list" ? (
              <>
                <ToggleField
                  label="Numbered list"
                  checked={Boolean(block.ordered)}
                  onChange={(ordered) => updateBlock(index, { ordered })}
                />
                <AreaField
                  label="List items"
                  value={(block.items ?? []).join("\n")}
                  onChange={(value) => updateBlock(index, { items: value.split("\n") })}
                  rows={5}
                  hint="One item per line."
                />
              </>
            ) : null}
            {block.type === "faq" ? (
              <>
                <TextField
                  label="Question"
                  value={block.title ?? ""}
                  onChange={(title) => updateBlock(index, { title })}
                />
                <AreaField
                  label="Answer"
                  value={block.text ?? ""}
                  onChange={(text) => updateBlock(index, { text })}
                  rows={4}
                />
              </>
            ) : null}
            {block.type === "image" ? (
              <>
                <TextField
                  label="Image URL"
                  value={block.url ?? ""}
                  onChange={(url) => updateBlock(index, { url })}
                />
                <TextField
                  label="Alternative text"
                  value={block.alt ?? ""}
                  onChange={(alt) => updateBlock(index, { alt })}
                />
                <TextField
                  label="Caption"
                  value={block.title ?? ""}
                  onChange={(title) => updateBlock(index, { title })}
                />
              </>
            ) : null}
            {block.type === "button" ? (
              <>
                <TextField
                  label="Button label"
                  value={block.title ?? ""}
                  onChange={(title) => updateBlock(index, { title })}
                />
                <TextField
                  label="Destination"
                  value={block.url ?? ""}
                  onChange={(url) => updateBlock(index, { url })}
                  hint="Use a site route such as /help or a complete https URL."
                />
              </>
            ) : null}
            {block.type === "html" ? (
              <AreaField
                label="Sanitized HTML block"
                value={block.text ?? ""}
                onChange={(text) => updateBlock(index, { text })}
                rows={8}
                hint="The server sanitizes this block before saving."
              />
            ) : null}
            {block.type === "divider" ? (
              <p className="cms-block-empty">A divider will appear between adjacent sections.</p>
            ) : null}
          </div>
        </details>
      ))}
      <div className="cms-block-add">
        <SelectField
          label="Add content block"
          value={addType}
          options={BLOCK_OPTIONS}
          onChange={(value) => setAddType(value as CmsContentBlock["type"])}
        />
        <Button
          type="button"
          className="admin-secondary"
          onClick={() => onChange([...blocks, newBlock(addType)])}
        >
          <Plus size={16} /> Add block
        </Button>
      </div>
    </div>
  );
}
