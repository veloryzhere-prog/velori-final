import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import {
  Bell,
  Bookmark,
  Database,
  Palette,
  ShieldCheck,
  UserRound,
  ChevronRight,
} from "lucide-react";
const categories = [
  {
    id: "account",
    label: "Account",
    description: "Your identity and sign-in details.",
    icon: UserRound,
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Set the mood for your VELORI.",
    icon: Palette,
  },
  {
    id: "privacy",
    label: "Privacy & safety",
    description: "Choose how people connect with you.",
    icon: ShieldCheck,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Keep the updates that matter.",
    icon: Bell,
  },
  {
    id: "content",
    label: "Your content",
    description: "Manage the things you have shared.",
    icon: Bookmark,
  },
  {
    id: "storage",
    label: "Storage",
    description: "Your device, media and preferences.",
    icon: Database,
  },
];
export function SettingsWorkspace({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [selected, setSelected] = useState(
    pathname.endsWith("/appearance") ? "appearance" : "account",
  );
  const content = useRef<HTMLDivElement>(null);
  const current = categories.find((x) => x.id === selected)!;
  useLayoutEffect(() => {
    for (const node of content.current?.querySelectorAll<HTMLElement>("[data-settings-group]") ??
      [])
      node.hidden = node.dataset.settingsGroup !== selected;
  }, [selected, children]);
  useLayoutEffect(() => {
    setSelected(pathname.endsWith("/appearance") ? "appearance" : "account");
  }, [pathname]);
  return (
    <div className="v-settings settings-rebuilt">
      <header className="v-page-heading">
        <div>
          <span className="v-eyebrow">YOUR SPACE, YOUR RULES</span>
          <h1>Settings</h1>
          <p>A few little things that make VELORI yours.</p>
        </div>
      </header>
      <div className="v-settings-layout">
        <nav aria-label="Settings categories">
          {categories.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              aria-pressed={selected === id}
              aria-controls="settings-category-content"
              onClick={() => setSelected(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              <ChevronRight size={15} />
            </button>
          ))}
        </nav>
        <section id="settings-category-content" className="v-settings-content">
          <header>
            <current.icon size={24} />
            <div>
              <h2>{current.label}</h2>
              <p>{current.description}</p>
            </div>
          </header>
          <div ref={content}>{children}</div>
        </section>
      </div>
    </div>
  );
}
