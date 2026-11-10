import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import "./mention-assist.css";
type Account = { id: string; username: string; display_name: string; avatar_url: string | null };
type Field = HTMLInputElement | HTMLTextAreaElement;
type Token = { field: Field; start: number; end: number; query: string };
function readToken(field: Field): Token | null {
  if (field.selectionStart === null || field.selectionStart !== field.selectionEnd) return null;
  const end = field.selectionStart;
  const match = field.value.slice(0, end).match(/(?:^|[\s(])@([a-zA-Z0-9_]{0,24})$/);
  return match ? { field, start: end - match[1].length - 1, end, query: match[1] } : null;
}
/** One account picker for controlled text fields in every creator studio. */
export function MentionAssist() {
  const [token, setToken] = useState<Token | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState("");
  const [position, setPosition] = useState({ left: 0, top: 0, width: 300 });
  const state = useRef({ token, accounts, active });
  state.current = { token, accounts, active };
  const popup = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function close() {
    setToken(null);
    setAccounts([]);
    setStatus("");
  }
  function choose(account: Account) {
    const current = state.current.token;
    if (!current || !current.field.isConnected) return close();
    const { field, start, end } = current;
    const text = "@" + account.username + " ";
    const value = field.value.slice(0, start) + text + field.value.slice(end);
    const prototype =
      field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.focus();
    field.setSelectionRange(start + text.length, start + text.length);
    close();
  }
  useEffect(() => {
    function inspect(event: Event) {
      const field = event.target;
      if (
        !(field instanceof HTMLTextAreaElement) &&
        !(field instanceof HTMLInputElement && field.type === "text")
      )
        return;
      if (
        field.disabled ||
        field.readOnly ||
        field.closest("[data-mention-disabled]") ||
        window.location.pathname.startsWith("/admin")
      )
        return;
      const next = readToken(field);
      setActive(0);
      setAccounts([]);
      setToken(next);
      if (!next) {
        setStatus("");
        return;
      }
      const rect = field.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 24);
      const top =
        rect.bottom + 6 + 280 > window.innerHeight ? Math.max(12, rect.top - 280) : rect.bottom + 6;
      setPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top,
        width,
      });
    }
    function key(event: KeyboardEvent) {
      const s = state.current;
      if (!s.token) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (
        s.accounts.length &&
        ["ArrowDown", "ArrowUp", "Enter", "Tab"].includes(event.key)
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Enter" || event.key === "Tab")
          choose(s.accounts[s.active] || s.accounts[0]);
        else
          setActive(
            (n) =>
              (n + (event.key === "ArrowDown" ? 1 : -1) + s.accounts.length) % s.accounts.length,
          );
      }
    }
    function outside(event: PointerEvent) {
      if (
        !popup.current?.contains(event.target as Node) &&
        event.target !== state.current.token?.field
      )
        close();
    }
    document.addEventListener("input", inspect);
    document.addEventListener("click", inspect);
    document.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", outside);
    function scroll(event: Event) {
      if (!popup.current?.contains(event.target as Node)) close();
    }
    window.addEventListener("resize", close);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("input", inspect);
      document.removeEventListener("click", inspect);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", scroll, true);
    };
  }, []);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setStatus("Finding people…");
    const controller = new AbortController();
    timer.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id,username,display_name,avatar_url")
          .ilike("username", token.query + "%")
          .order("username")
          .limit(6)
          .abortSignal(controller.signal);
        if (cancelled) return;
        if (error) {
          setAccounts([]);
          setStatus("People could not be loaded. You can still type a username.");
          return;
        }
        setAccounts(data ?? []);
        setStatus(data?.length ? "" : "No matching accounts. Keep typing.");
      } catch {
        if (!cancelled) setStatus("People could not be loaded.");
      }
    }, 160);
    return () => {
      cancelled = true;
      controller.abort();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [token]);
  if (!token) return null;
  return createPortal(
    <div
      ref={popup}
      className="mention-picker"
      style={position}
      role="dialog"
      aria-label="Mention a person"
    >
      <div className="mention-picker-heading">
        MENTION SOMEONE <span>↑ ↓ to browse · Enter to select</span>
      </div>
      {status && <p role="status">{status}</p>}
      {accounts.map((account, index) => (
        <button
          key={account.id}
          type="button"
          className={index === active ? "is-active" : ""}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => choose(account)}
          aria-label={"Mention @" + account.username}
        >
          {account.avatar_url ? (
            <img src={account.avatar_url} alt="" />
          ) : (
            <span className="mention-avatar">{(account.display_name || account.username)[0]}</span>
          )}
          <span>
            <strong>{account.display_name || account.username}</strong>
            <small>@{account.username}</small>
          </span>
          <span className="mention-at">@</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
