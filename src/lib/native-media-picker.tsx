import { useEffect, useRef, useState } from "react";
import { Camera, MediaType, MediaTypeSelection, type MediaResult } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { Button, Dialog } from "../components/ui";
import { nativeMediaAccept } from "./native-media-picker-policy.mjs";

type PickerTarget = {
  input: HTMLInputElement;
  photos: boolean;
  videos: boolean;
  otherFiles: boolean;
};

const FILE_EXTENSIONS: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/3gpp": "3gp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
  "video/x-matroska": "mkv",
};

function fileType(result: MediaResult, blob: Blob) {
  if (blob.type.startsWith("video/") || blob.type.startsWith("image/")) return blob.type;
  if (result.type === MediaType.Video) return "video/mp4";
  const format = result.metadata?.format?.toLowerCase();
  if (format === "gif") return "image/gif";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  return "image/jpeg";
}

async function asFile(result: MediaResult, index: number) {
  const source = result.webPath ?? (result.uri ? Capacitor.convertFileSrc(result.uri) : "");
  if (!source) throw new Error("The selected media could not be opened.");

  const response = await fetch(source);
  if (!response.ok) throw new Error("The selected media could not be read. Please try again.");
  const blob = await response.blob();
  if (blob.size === 0) throw new Error("The selected media is empty.");

  const type = fileType(result, blob);
  const extension =
    FILE_EXTENSIONS[type] ?? type.split("/")[1]?.split(/[+;]/, 1)[0].replace(/^x-/, "") ?? "media";
  return new File([blob], `velori-${Date.now()}-${index}.${extension}`, { type });
}

function isCancellation(error: unknown) {
  const value = error as { code?: string; message?: string };
  return `${value?.code ?? ""} ${value?.message ?? ""}`.toLowerCase().includes("cancel");
}

export function NativeAndroidMediaPicker() {
  const [target, setTarget] = useState<PickerTarget | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const bypassInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;

    const interceptPicker = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLInputElement) || event.target.type !== "file") return;
      if (bypassInput.current === event.target) {
        bypassInput.current = null;
        return;
      }

      const input = event.target;
      if (input.disabled) return;
      const media = nativeMediaAccept(input.accept);
      if (!media) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      setError("");
      setTarget({ input, ...media });
    };

    document.addEventListener("click", interceptPicker, true);
    return () => document.removeEventListener("click", interceptPicker, true);
  }, []);

  function close() {
    if (!busy) {
      setError("");
      setTarget(null);
    }
  }

  function browseFiles() {
    if (!target || busy) return;
    const input = target.input;
    bypassInput.current = input;
    setTarget(null);
    window.requestAnimationFrame(() => input.click());
  }

  async function selectMedia(action: "gallery" | "photo" | "video") {
    if (!target || busy) return;
    setBusy(action);
    setError("");

    try {
      let results: MediaResult[];
      if (action === "gallery") {
        const selection = target.photos
          ? target.videos
            ? MediaTypeSelection.All
            : MediaTypeSelection.Photo
          : MediaTypeSelection.Video;
        const gallery = await Camera.chooseFromGallery({
          mediaType: selection,
          allowMultipleSelection: target.input.multiple,
          quality: 90,
          includeMetadata: true,
        });
        results = gallery.results;
      } else if (action === "photo") {
        results = [await Camera.takePhoto({ quality: 90, includeMetadata: true })];
      } else {
        results = [await Camera.recordVideo({ includeMetadata: true })];
      }

      if (results.length > 0) {
        if (!target.input.isConnected || target.input.disabled) {
          setTarget(null);
          return;
        }
        const files = await Promise.all(results.map(asFile));
        if (!target.input.multiple && files.length > 1) {
          throw new Error("Choose one file for this upload.");
        }
        const transfer = new DataTransfer();
        files.forEach((file) => transfer.items.add(file));
        target.input.files = transfer.files;
        target.input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      setTarget(null);
    } catch (cause) {
      if (isCancellation(cause)) {
        setTarget(null);
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "Media selection failed. Please try again or browse files.",
        );
      }
    } finally {
      setBusy("");
    }
  }

  const hasCameraAction = target?.input.hasAttribute("capture") ?? false;
  return (
    <Dialog
      open={Boolean(target)}
      title="Add media"
      description="Choose photos or videos from your device, or browse files."
      onClose={close}
      className="native-media-picker-dialog"
    >
      <div style={{ display: "grid", gap: 10 }}>
        {target && (target.photos || target.videos) && (
          <Button
            variant="primary"
            loading={busy === "gallery"}
            disabled={Boolean(busy)}
            onClick={() => void selectMedia("gallery")}
          >
            Choose from gallery
          </Button>
        )}
        {hasCameraAction && target?.photos && (
          <Button
            variant="outline"
            loading={busy === "photo"}
            disabled={Boolean(busy)}
            onClick={() => void selectMedia("photo")}
          >
            Take a photo
          </Button>
        )}
        {hasCameraAction && target?.videos && (
          <Button
            variant="outline"
            loading={busy === "video"}
            disabled={Boolean(busy)}
            onClick={() => void selectMedia("video")}
          >
            Record a video
          </Button>
        )}
        {target?.otherFiles && (
          <Button variant="outline" disabled={Boolean(busy)} onClick={browseFiles}>
            Browse files
          </Button>
        )}
        {error && (
          <p className="inline-feedback is-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
