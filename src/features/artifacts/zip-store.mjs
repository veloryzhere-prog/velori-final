/* Copyright © 2026 VELORYZ. See NOTICE.md for third-party rights. */
/** A small dependency-free ZIP writer (STORE method, no compression). */
const encoder = new TextEncoder();
const put16 = (v, d, o) => d.setUint16(o, v, true);
const put32 = (v, d, o) => d.setUint32(o, v >>> 0, true);
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function createSourceZip(entries) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 200)
    throw new Error("Invalid archive contents.");
  let offset = 0;
  const chunks = [],
    central = [];
  const paths = new Set();
  for (const [path, value] of entries) {
    if (
      typeof path !== "string" ||
      !/^[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*$/i.test(path) ||
      path.includes("..") ||
      paths.has(path)
    )
      throw new Error("Invalid archive path.");
    if (typeof value !== "string") throw new Error("Only UTF-8 source files may be exported.");
    paths.add(path);
    const name = encoder.encode(path),
      data = encoder.encode(value);
    if (name.length > 200 || data.length > 2_000_000)
      throw new Error("Archive file exceeds safety limit.");
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    put32(0x04034b50, lv, 0);
    put16(20, lv, 4);
    put16(0x0800, lv, 6);
    put16(0, lv, 8);
    put32(crc32(data), lv, 14);
    put32(data.length, lv, 18);
    put32(data.length, lv, 22);
    put16(name.length, lv, 26);
    local.set(name, 30);
    chunks.push(local, data);
    const c = new Uint8Array(46 + name.length),
      cv = new DataView(c.buffer);
    put32(0x02014b50, cv, 0);
    put16(20, cv, 4);
    put16(20, cv, 6);
    put16(0x0800, cv, 8);
    put32(crc32(data), cv, 16);
    put32(data.length, cv, 20);
    put32(data.length, cv, 24);
    put16(name.length, cv, 28);
    put32(offset, cv, 42);
    c.set(name, 46);
    central.push(c);
    offset += local.length + data.length;
  }
  const centralBytes = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22),
    view = new DataView(end.buffer);
  put32(0x06054b50, view, 0);
  put16(entries.length, view, 8);
  put16(entries.length, view, 10);
  put32(centralBytes, view, 12);
  put32(offset, view, 16);
  return new Blob([...chunks, ...central, end], { type: "application/zip" });
}
