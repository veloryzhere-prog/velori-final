export const MAX_MESSAGE_ATTACHMENT_BYTES: number;
export function validateMessageAttachment(
  file: File,
): Promise<{ kind: "image" | "video" | "file" | "audio"; extension: string }>;
