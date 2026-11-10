import { useEffect, useRef, useState } from "react";
import { Smile, X, Image as ImageIcon } from "lucide-react";
import "./expressions.css";
const groups = [
  {
    name: "Faces",
    emoji:
      "😀 😃 😄 😁 😆 😅 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 🤗 🤭 🤫 🤔 🫡 😎 🥳 😏 😌 😔 😴 😭 😤 😡 🤯 🥺 🫠".split(
        " ",
      ),
  },
  {
    name: "Gestures",
    emoji: "👋 🤚 ✋ 🖖 👌 🤌 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 👍 👎 ✊ 👊 🤝 🙌 🫶 👏 🙏 💪".split(
      " ",
    ),
  },
  {
    name: "Hearts",
    emoji: "❤️ 🩷 🧡 💛 💚 💙 🩵 💜 🖤 🤍 🤎 💔 ❤️‍🔥 💖 💗 💓 💞 💕 💌 💘 💝 ✨ 💫 ⭐ 🌟 🔥 🎉".split(
      " ",
    ),
  },
  {
    name: "Everyday",
    emoji:
      "🌸 🌻 🌷 🌹 🍀 🌿 🌈 ☀️ 🌙 ☁️ 🌊 🐶 🐱 🦋 🐝 🍕 ☕ 🍰 🎂 🎁 🎵 🎬 📸 🎨 ⚽ 🏆 💻 🚀 🌍 🏡".split(
        " ",
      ),
  },
];
export function ChatExpressionPicker({
  disabled,
  onEmoji,
  onGif,
}: {
  disabled: boolean;
  onEmoji: (emoji: string) => void;
  onGif: (file: File) => void;
}) {
  const [open, setOpen] = useState(false),
    [category, setCategory] = useState("Faces"),
    [query, setQuery] = useState(""),
    [recent, setRecent] = useState<string[]>(() => {
      try {
        const a = JSON.parse(localStorage.getItem("velori-recent-emoji") || "[]");
        return Array.isArray(a)
          ? a.filter((x) => typeof x === "string" && x.length < 30).slice(0, 24)
          : [];
      } catch {
        return [];
      }
    });
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key, true);
    };
  }, [open]);
  const visible = query.trim()
    ? groups
        .filter((g) => g.name.toLowerCase().includes(query.toLowerCase()))
        .flatMap((g) => g.emoji)
    : category === "Recent"
      ? recent
      : (groups.find((g) => g.name === category)?.emoji ?? []);
  return (
    <div className="chat-expressions" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="messages-attach-button"
        aria-label="Emoji and GIFs"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
      >
        <Smile size={19} />
      </button>
      {open && !disabled ? (
        <section className="chat-expression-panel" aria-label="Emoji and GIF picker">
          <header>
            <div>
              <small>EXPRESS YOURSELF</small>
              <strong>A little more you.</strong>
            </div>
            <button
              type="button"
              aria-label="Close emoji picker"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <X size={17} />
            </button>
          </header>
          <input
            type="search"
            aria-label="Search emoji categories"
            placeholder="Search faces, hearts, gestures…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="chat-expression-tabs" aria-label="Emoji categories">
            {["Recent", ...groups.map((g) => g.name)].map((name) => (
              <button
                type="button"
                key={name}
                aria-pressed={category === name}
                onClick={() => {
                  setCategory(name);
                  setQuery("");
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="chat-emoji-grid">
            {visible.map((emoji) => (
              <button
                type="button"
                key={emoji}
                aria-label={"Insert " + emoji}
                onClick={() => {
                  onEmoji(emoji);
                  const next = [emoji, ...recent.filter((x) => x !== emoji)].slice(0, 24);
                  setRecent(next);
                  try {
                    localStorage.setItem("velori-recent-emoji", JSON.stringify(next));
                  } catch {}
                }}
              >
                {emoji}
              </button>
            ))}
            {!visible.length ? <p>No emoji here yet. Try another category.</p> : null}
          </div>
          <label className="chat-gif-upload">
            <ImageIcon size={20} />
            <span>
              <strong>Add a GIF</strong>
              <small>Choose an animated GIF · up to 25 MB</small>
            </span>
            <input
              className="sr-only"
              type="file"
              accept="image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onGif(file);
                  setOpen(false);
                }
                e.target.value = "";
              }}
            />
          </label>
          <p className="chat-expression-note">
            You can also use your keyboard for any Unicode emoji. Your GIF is sent only when you
            press Send.
          </p>
        </section>
      ) : null}
    </div>
  );
}
export function AttachmentPreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file.type.startsWith("image/")) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url ? (
    <img className="chat-attachment-preview" src={url} alt="Attachment preview" />
  ) : null;
}
