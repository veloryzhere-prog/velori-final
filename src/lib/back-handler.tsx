import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { App } from "@capacitor/app";
import { Dialog, Button } from "../components/ui";

export function AndroidBackController() {
  const navigate = useNavigate();
  const location = useLocation();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const handleBack = () => {
      if (!active) return;

      // Priority 1: Active dialogs / modals
      const openDialog = document.querySelector('[role="dialog"]');
      if (openDialog) {
        const closeButton = openDialog.querySelector<HTMLButtonElement>(
          'button[aria-label*="Close"], button.ui-dialog-close, button.button-quiet',
        );
        if (closeButton) {
          closeButton.click();
          return;
        }
      }

      // Priority 2: Bottom sheets / menus / mobile drawer
      const mobileMenu = document.querySelector(
        ".v-navigation-dialog, .create-dialog, .v-create-dialog",
      );
      if (mobileMenu) {
        const closeBtn = mobileMenu.querySelector<HTMLButtonElement>(
          'button[aria-label*="Close"], button.ui-dialog-close, button.button-quiet',
        );
        if (closeBtn) {
          closeBtn.click();
          return;
        }
      }

      // Priority 3: Messaging conversation -> inbox
      if (location.pathname === "/messages" && location.search.includes("conversation=")) {
        navigate("/messages", { replace: true });
        return;
      }

      // Priority 4: Story or Reel viewer overlay
      const storyViewer = document.querySelector(".story-viewer-backdrop, .reel-detail-overlay");
      if (storyViewer) {
        const closeStory = storyViewer.querySelector<HTMLButtonElement>(
          'button[aria-label*="Close"], button.story-close',
        );
        if (closeStory) {
          closeStory.click();
          return;
        }
      }

      // Priority 5: Nested route navigation or history pop
      if (window.history.length > 1 && location.pathname !== "/home" && location.pathname !== "/") {
        navigate(-1);
        return;
      }

      // Priority 6: Root screen exit confirmation
      if (location.pathname === "/home" || location.pathname === "/") {
        setExitConfirmOpen(true);
      } else {
        navigate("/home", { replace: true });
      }
    };

    // Listen to Capacitor Back Button event
    const subscription = App.addListener("backButton", () => {
      handleBack();
    });

    return () => {
      active = false;
      subscription.then((sub) => sub.remove()).catch(() => {});
    };
  }, [location, navigate]);

  return (
    <>
      {exitConfirmOpen && (
        <Dialog
          open
          title="Exit VELORI"
          description="Are you sure you want to exit VELORI?"
          onClose={() => setExitConfirmOpen(false)}
          className="v-exit-dialog"
          actions={
            <div
              style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "flex-end" }}
            >
              <Button variant="outline" onClick={() => setExitConfirmOpen(false)}>
                Stay in App
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setExitConfirmOpen(false);
                  void App.exitApp();
                }}
              >
                Exit
              </Button>
            </div>
          }
        >
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            You are at the main VELORI feed. Choose Exit to close the application.
          </p>
        </Dialog>
      )}
    </>
  );
}
