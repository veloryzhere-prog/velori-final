import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

export function CmsCodeEditor({
  language,
  value,
  height,
  onChange,
}: {
  language: "html" | "css" | "javascript";
  value: string;
  height: string;
  onChange: (value: string) => void;
}) {
  return (
    <CodeMirror
      value={value}
      height={height}
      theme={oneDark}
      extensions={[language === "html" ? html() : language === "css" ? css() : javascript()]}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        searchKeymap: true,
        bracketMatching: true,
      }}
      onChange={onChange}
    />
  );
}
