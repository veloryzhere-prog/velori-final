import {
  createElement,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type TextareaHTMLAttributes,
  type Ref,
} from "react";
import { Input as UiInput, Textarea as UiTextarea } from "../components/ui";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return createElement("button", props);
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <UiInput {...props} />;
}
export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return createElement("label", props);
}
export function Anchor(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return createElement("a", props);
}
export function Heading1(props: HTMLAttributes<HTMLHeadingElement>) {
  return createElement("h1", props);
}
export function Heading2(props: HTMLAttributes<HTMLHeadingElement>) {
  return createElement("h2", props);
}
export function Textarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> },
) {
  return <UiTextarea {...props} />;
}

/** Shared card heading. Lives here rather than in admin.tsx because the public
 * reels and stories screens use the same console card styles. */
export function CardHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return createElement(
    "div",
    { className: "admin-card-heading" },
    createElement(Heading2, null, title),
    subtitle ? createElement("p", null, subtitle) : null,
  );
}
