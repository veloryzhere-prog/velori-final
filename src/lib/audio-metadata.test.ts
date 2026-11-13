/* Copyright © 2026 VELORYZ. All rights reserved. */
import test from "node:test";
import assert from "node:assert/strict";
import { readAudioFileMetadata } from "./audio-metadata.ts";

function id3TextFrame(id: string, value: string) {
  const body = new TextEncoder().encode(value);
  const payload = new Uint8Array([3, ...body]);
  const frame = new Uint8Array(10 + payload.length);
  frame.set(new TextEncoder().encode(id), 0);
  frame[7] = payload.length;
  frame.set(payload, 10);
  return frame;
}
function makeId3File() {
  const frames = [id3TextFrame("TIT2", "Night Drive"), id3TextFrame("TPE1", "VELORI Artist")];
  const body = new Uint8Array(frames.reduce((sum, frame) => sum + frame.length, 0));
  let offset = 0;
  for (const frame of frames) {
    body.set(frame, offset);
    offset += frame.length;
  }
  const header = new Uint8Array(10);
  header.set([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, body.length]);
  return new File([header, body], "track.mp3", { type: "audio/mpeg" });
}

test("reads editable title and artist metadata from an ID3v2 MP3", async () => {
  const metadata = await readAudioFileMetadata(makeId3File());
  assert.equal(metadata.title, "Night Drive");
  assert.equal(metadata.artist, "VELORI Artist");
});

test("returns an empty object for an audio file without embedded tags", async () => {
  const metadata = await readAudioFileMetadata(new File([new Uint8Array([1, 2, 3])], "plain.mp3"));
  assert.deepEqual(metadata, {});
});
