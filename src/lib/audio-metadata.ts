/* Copyright © 2026 VELORYZ. All rights reserved. */

export interface EmbeddedAudioCover {
  blob: Blob;
  mimeType: string;
  extension: string;
}

export interface EmbeddedAudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  mood?: string;
  language?: string;
  year?: string;
  bpm?: string;
  trackNumber?: string;
  composer?: string;
  comment?: string;
  cover?: EmbeddedAudioCover;
}

const decoder = (encoding: string) => new TextDecoder(encoding, { fatal: false });
const clean = (value: string) => value.replace(/\0/g, "").replace(/[\r\n]+/g, " ").trim();
const latin1 = (bytes: Uint8Array) => clean(decoder("iso-8859-1").decode(bytes));
const utf8 = (bytes: Uint8Array) => clean(decoder("utf-8").decode(bytes));

function uint32be(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}
function uint32le(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24)
  ) >>> 0;
}
function syncSafe32(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] ?? 0) & 0x7f) * 0x200000 +
    ((bytes[offset + 1] ?? 0) & 0x7f) * 0x4000 +
    ((bytes[offset + 2] ?? 0) & 0x7f) * 0x80 +
    ((bytes[offset + 3] ?? 0) & 0x7f)
  );
}
function textValue(bytes: Uint8Array) {
  if (!bytes.length) return "";
  const encoding = bytes[0];
  const body = bytes.subarray(1);
  try {
    if (encoding === 0) return latin1(body);
    if (encoding === 1) return clean(decoder("utf-16").decode(body));
    if (encoding === 2) return clean(decoder("utf-16be").decode(body));
    if (encoding === 3) return utf8(body);
  } catch {
    return utf8(body);
  }
  return utf8(body);
}
function findZero(bytes: Uint8Array, start: number, wide: boolean) {
  for (let index = start; index < bytes.length - (wide ? 1 : 0); index += wide ? 2 : 1) {
    if (bytes[index] === 0 && (!wide || bytes[index + 1] === 0)) return index;
  }
  return bytes.length;
}
function parseId3Cover(frame: Uint8Array): EmbeddedAudioCover | undefined {
  if (frame.length < 5) return undefined;
  let cursor = 1;
  const mimeEnd = frame.indexOf(0, cursor);
  if (mimeEnd < 0 || mimeEnd + 2 >= frame.length) return undefined;
  const mimeType = latin1(frame.subarray(cursor, mimeEnd)).toLowerCase() || "image/jpeg";
  cursor = mimeEnd + 2; // MIME terminator and picture type.
  const wide = frame[0] === 1 || frame[0] === 2;
  const descriptionEnd = findZero(frame, cursor, wide);
  cursor = Math.min(frame.length, descriptionEnd + (wide ? 2 : 1));
  if (cursor >= frame.length) return undefined;
  const extension = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  return {
    blob: new Blob([frame.subarray(cursor).slice().buffer as ArrayBuffer], { type: mimeType }),
    mimeType,
    extension,
  };
}

function parseId3(bytes: Uint8Array, result: EmbeddedAudioMetadata) {
  if (bytes.length < 10 || latin1(bytes.subarray(0, 3)) !== "ID3") return;
  const version = bytes[3];
  if (version !== 3 && version !== 4) return;
  const tagEnd = Math.min(bytes.length, 10 + syncSafe32(bytes, 6));
  let cursor = 10;
  const fields: Record<string, keyof EmbeddedAudioMetadata> = {
    TIT2: "title",
    TPE1: "artist",
    TALB: "album",
    TCON: "genre",
    TMOO: "mood",
    TLAN: "language",
    TDRC: "year",
    TYER: "year",
    TBPM: "bpm",
    TRCK: "trackNumber",
    TCOM: "composer",
  };
  while (cursor + 10 <= tagEnd) {
    const id = latin1(bytes.subarray(cursor, cursor + 4));
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = version === 4 ? syncSafe32(bytes, cursor + 4) : uint32be(bytes, cursor + 4);
    if (!size || cursor + 10 + size > tagEnd) break;
    const payload = bytes.subarray(cursor + 10, cursor + 10 + size);
    if (fields[id]) {
      const value = textValue(payload);
      if (value && !result[fields[id]]) Object.assign(result, { [fields[id]]: value });
    } else if (id === "COMM" && payload.length > 4) {
      const wide = payload[0] === 1 || payload[0] === 2;
      const descriptionStart = 4;
      const descriptionEnd = findZero(payload, descriptionStart, wide);
      const commentStart = Math.min(payload.length, descriptionEnd + (wide ? 2 : 1));
      const comment = textValue(new Uint8Array([payload[0], ...payload.subarray(commentStart)]));
      if (comment && !result.comment) result.comment = comment;
    } else if (id === "APIC" && !result.cover) {
      result.cover = parseId3Cover(payload);
    }
    cursor += 10 + size;
  }
}

function parseId3v1(bytes: Uint8Array, result: EmbeddedAudioMetadata) {
  if (bytes.length < 128 || latin1(bytes.subarray(bytes.length - 128, bytes.length - 125)) !== "TAG")
    return;
  const tag = bytes.subarray(bytes.length - 128);
  const assign = (key: keyof EmbeddedAudioMetadata, start: number, length: number) => {
    const value = latin1(tag.subarray(start, start + length));
    if (value && !result[key]) Object.assign(result, { [key]: value });
  };
  assign("title", 3, 30);
  assign("artist", 33, 30);
  assign("album", 63, 30);
  assign("year", 93, 4);
  assign("comment", 97, 30);
}

function parseWaveInfo(bytes: Uint8Array, result: EmbeddedAudioMetadata) {
  if (bytes.length < 12 || latin1(bytes.subarray(0, 4)) !== "RIFF" || latin1(bytes.subarray(8, 12)) !== "WAVE")
    return;
  const fields: Record<string, keyof EmbeddedAudioMetadata> = {
    INAM: "title",
    IART: "artist",
    IPRD: "album",
    IGNR: "genre",
    ICMT: "comment",
    ICRD: "year",
  };
  for (let cursor = 12; cursor + 8 <= bytes.length; ) {
    const id = latin1(bytes.subarray(cursor, cursor + 4));
    const size = uint32le(bytes, cursor + 4);
    const end = Math.min(bytes.length, cursor + 8 + size);
    if (id === "LIST" && size >= 4 && latin1(bytes.subarray(cursor + 8, cursor + 12)) === "INFO") {
      for (let item = cursor + 12; item + 8 <= end; ) {
        const key = latin1(bytes.subarray(item, item + 4));
        const itemSize = uint32le(bytes, item + 4);
        const itemEnd = Math.min(end, item + 8 + itemSize);
        const field = fields[key];
        if (field && itemEnd > item + 8 && !result[field])
          Object.assign(result, { [field]: latin1(bytes.subarray(item + 8, itemEnd)) });
        item = item + 8 + itemSize + (itemSize % 2);
      }
    }
    if (end <= cursor) break;
    cursor = end + (size % 2);
  }
}

function parseVorbisComments(bytes: Uint8Array, result: EmbeddedAudioMetadata) {
  let commentOffset = -1;
  for (let index = 0; index + 7 < bytes.length; index++) {
    if (
      bytes[index] === 3 &&
      latin1(bytes.subarray(index + 1, index + 7)) === "vorbis"
    ) {
      commentOffset = index + 7;
      break;
    }
  }
  if (commentOffset < 0 || commentOffset + 8 > bytes.length) return;
  let cursor = commentOffset;
  const vendorLength = uint32le(bytes, cursor);
  cursor += 4 + vendorLength;
  if (cursor + 4 > bytes.length) return;
  const count = Math.min(uint32le(bytes, cursor), 1000);
  cursor += 4;
  const fields: Record<string, keyof EmbeddedAudioMetadata> = {
    TITLE: "title",
    ARTIST: "artist",
    ALBUM: "album",
    GENRE: "genre",
    MOOD: "mood",
    LANGUAGE: "language",
    DATE: "year",
    YEAR: "year",
    BPM: "bpm",
    TRACKNUMBER: "trackNumber",
    COMPOSER: "composer",
    DESCRIPTION: "comment",
    COMMENT: "comment",
  };
  for (let index = 0; index < count && cursor + 4 <= bytes.length; index++) {
    const length = uint32le(bytes, cursor);
    cursor += 4;
    if (!length || cursor + length > bytes.length) return;
    const item = utf8(bytes.subarray(cursor, cursor + length));
    cursor += length;
    const separator = item.indexOf("=");
    if (separator <= 0) continue;
    const key = item.slice(0, separator).toUpperCase();
    const field = fields[key];
    const value = clean(item.slice(separator + 1));
    if (field && value && !result[field]) Object.assign(result, { [field]: value });
  }
}

function parseMp4Ilst(bytes: Uint8Array, result: EmbeddedAudioMetadata) {
  const marker = new Uint8Array([0x69, 0x6c, 0x73, 0x74]);
  let ilst = -1;
  for (let i = 4; i <= bytes.length - 4; i++) {
    if (bytes[i] === marker[0] && bytes[i + 1] === marker[1] && bytes[i + 2] === marker[2] && bytes[i + 3] === marker[3]) {
      ilst = i;
      break;
    }
  }
  if (ilst < 4) return;
  const fields: Record<string, keyof EmbeddedAudioMetadata> = {
    "©nam": "title",
    "©ART": "artist",
    aART: "artist",
    "©alb": "album",
    "©gen": "genre",
    "©day": "year",
    "©cmt": "comment",
    "©wrt": "composer",
  };
  const containerEnd = Math.min(bytes.length, uint32be(bytes, ilst - 4) + ilst - 4);
  for (let cursor = ilst + 4; cursor + 8 <= containerEnd; ) {
    const size = uint32be(bytes, cursor);
    const key = latin1(bytes.subarray(cursor + 4, cursor + 8));
    const end = Math.min(containerEnd, cursor + size);
    if (size < 8 || end <= cursor) break;
    for (let child = cursor + 8; child + 16 <= end; ) {
      const childSize = uint32be(bytes, child);
      const childKey = latin1(bytes.subarray(child + 4, child + 8));
      if (childSize < 8 || child + childSize > end) break;
      if (childKey === "data" && childSize > 16) {
        const valueBytes = bytes.subarray(child + 16, child + childSize);
        const field = fields[key];
        const value = utf8(valueBytes);
        if (field && value && !result[field]) Object.assign(result, { [field]: value });
        if (key === "tmpo" && valueBytes.length >= 2 && !result.bpm)
          result.bpm = String((valueBytes[0] << 8) | valueBytes[1]);
        if (key === "covr" && !result.cover) {
          const dataType = uint32be(bytes, child + 8);
          const mimeType = dataType === 14 ? "image/png" : dataType === 13 ? "image/jpeg" : "application/octet-stream";
          const extension = dataType === 14 ? "png" : "jpg";
          result.cover = {
            blob: new Blob([valueBytes.slice().buffer as ArrayBuffer], { type: mimeType }),
            mimeType,
            extension,
          };
        }
        if (key === "trkn" && valueBytes.length >= 6 && !result.trackNumber)
          result.trackNumber = String((valueBytes[2] << 8) | valueBytes[3]);
        break;
      }
      child += childSize;
    }
    cursor = end;
  }
}

/** Reads common embedded tags without uploading or storing the file anywhere. */
export async function readAudioFileMetadata(file: File): Promise<EmbeddedAudioMetadata> {
  const result: EmbeddedAudioMetadata = {};
  if (!(file instanceof Blob) || file.size === 0) return result;
  const bytes = new Uint8Array(await file.arrayBuffer());
  parseId3(bytes, result);
  parseId3v1(bytes, result);
  parseWaveInfo(bytes, result);
  parseVorbisComments(bytes, result);
  parseMp4Ilst(bytes, result);
  return result;
}
