import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateMessageAttachment,
  MAX_MESSAGE_ATTACHMENT_BYTES,
} from "./message-attachment-validation.mjs";
test("GIF upload recognizes real signatures, dimensions and MIME", async () => {
  for (const version of ["GIF87a", "GIF89a"]) {
    const result = await validateMessageAttachment(
      new File([version + "\x01\x00\x01\x00\x80\x00\x00"], "tiny.gif", { type: "image/gif" }),
    );
    assert.equal(result.kind, "image");
    assert.equal(result.extension, "gif");
  }
  await assert.rejects(
    validateMessageAttachment(new File(["GIF89a\0\0\0\0"], "zero.gif", { type: "image/gif" })),
    /contents/,
  );
  await assert.rejects(
    validateMessageAttachment(new File(["not a gif"], "fake.gif", { type: "image/gif" })),
    /contents/,
  );
  await assert.rejects(
    validateMessageAttachment(
      new File(["GIF89a\x01\0\x01\0"], "fake.svg", { type: "image/svg+xml" }),
    ),
    /Choose/,
  );
});
test("attachment size and empty checks remain enforced", async () => {
  await assert.rejects(
    validateMessageAttachment(new File([], "empty.gif", { type: "image/gif" })),
    /empty/,
  );
  const file = { type: "image/gif", size: MAX_MESSAGE_ATTACHMENT_BYTES + 1 };
  await assert.rejects(validateMessageAttachment(file), /25 MB/);
});
