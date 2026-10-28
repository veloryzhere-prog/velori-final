import "./design-system/tokens.css";
import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/reference-ui.css";
import "./styles/motion-experience.css";
import "./styles/polished-experience.css";
import "./styles/clean-product.css";
import "./styles/page-workspaces.css";
import "./product/product.css";
import "./styles/spatial-motion.css";
import "./styles/studio-completion.css";
import "./styles/admin-workspace.css";
import "./styles/responsive-refinement.css";
import "./components/status-surfaces.css";
import "./components/messaging-refinements.css";
import "./features/chat/chat.css";

function SystemThemeSync() {
  useEffect(() => {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = () => {
      let preference = "system";
      try {
        preference = localStorage.getItem("velori-theme") || "system";
      } catch {
        // The default light appearance remains active when browser storage is blocked.
      }
      const dark = preference === "dark" || (preference === "system" && colorScheme.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#100914" : "#FAF8FC");
      window.dispatchEvent(new Event("theme-preference-updated"));
    };
    colorScheme.addEventListener("change", applySystemTheme);
    return () => colorScheme.removeEventListener("change", applySystemTheme);
  }, []);
  return null;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <>
      <SystemThemeSync />
      <App />
    </>
  </React.StrictMode>,
);

import "./styles/motion-finish.css";

import "./styles/inbox-finish.css";
import "./styles/social-app-finish.css";
