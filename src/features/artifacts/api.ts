import { supabase } from "../../lib/supabase";
export const studioEnabled = import.meta.env.VITE_STUDIO_ENABLED !== "false";
export class StudioError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}
export async function studioRequest<T>(
  action: string,
  values: Record<string, unknown> = {},
): Promise<T> {
  if (!studioEnabled)
    throw new StudioError(
      "AI, account saves and payments await server setup. Local editing and downloads are ready.",
    );
  const { data, error } = await supabase.functions.invoke("velori-studio", {
    body: { action, ...values },
    timeout: action === "generate" ? 65000 : 12000,
  });
  if (error) {
    let message = "Studio could not connect. Your browser draft is safe.";
    let code;
    try {
      const r = await error.context?.json();
      if (typeof r?.error === "string") message = r.error;
      if (typeof r?.code === "string") code = r.code;
    } catch {
      /* Never expose upstream response bodies. */
    }
    throw new StudioError(message, code);
  }
  return data as T;
}
export type ReferenceImage = { mimeType: string; data: string; preview: string; name: string };
export async function prepareImage(file: File): Promise<ReferenceImage> {
  if (file.size > 8000000 || !["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Choose a JPG, PNG or WebP up to 8 MB.");
  const image = await createImageBitmap(file);
  try {
    if (!image.width || !image.height || image.width * image.height > 40000000)
      throw new Error("Choose an image smaller than 40 megapixels.");
    const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot prepare the image.");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const preview = canvas.toDataURL("image/jpeg", 0.82);
    if (preview.length > 2000000) throw new Error("Try a smaller image reference.");
    return {
      mimeType: "image/jpeg",
      data: preview.split(",")[1],
      preview,
      name: file.name.slice(0, 100),
    };
  } finally {
    image.close();
  }
}
