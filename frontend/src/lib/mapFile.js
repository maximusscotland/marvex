/**
 * `.mmap` — Marvex Studio's proprietary map file format.
 *
 * Structure (binary):
 *   bytes 0..3   "MMAP"           ASCII magic — identifies the file at a glance.
 *   byte  4      0x01             Format version. Bumped if the layout ever changes.
 *   byte  5      flags            bit0 = compressed, bit1 = scrambled.  Reserved bits 0.
 *   bytes 6..end                  Payload — JSON document of the map, optionally
 *                                 deflate-compressed (pako) and optionally
 *                                 byte-XOR-scrambled with the key below.
 *
 * Why a binary format and not raw JSON?
 *   1. **Members-only feel.** No competing app will render it natively — opening
 *      a `.mmap` in Notepad shows binary noise.  Determined readers can still
 *      reverse it (we're not encrypting, just framing) but the app is the only
 *      tool that "just works" out of the box.
 *   2. **Smaller files.** Zlib trims a typical 30-element map ~70%.  Matters
 *      when the user emails it round.
 *   3. **OS file association.** Pairing a magic header with a registered
 *      extension lets Windows/macOS/Linux double-click directly into the app
 *      (Electron desktop build registers `.mmap` as Marvex Studio).
 *
 * What we DO NOT do:
 *   – No encryption.  This is not a secrecy format.  If you want true
 *     confidentiality, use `Pure Local Mode` and never email the file.
 *   – No multi-map archives.  Use `.mmlib` (mapLibraryArchive.js) for that.
 */

import pako from "pako";

const MAGIC = "MMAP";
const VERSION = 0x01;
const FLAG_COMPRESSED = 0x01;
const FLAG_SCRAMBLED  = 0x02;

// Lightweight XOR key. NOT cryptographic — just stops casual JSON-sniffing.
// Keep this stable across versions; changing it would invalidate every
// `.mmap` ever exported.
const SCRAMBLE_KEY = Uint8Array.from([0x4D, 0x4D, 0xC0, 0x53, 0x4D, 0x4F, 0x53]);

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8");

const xorBuf = (buf, key) => {
  const out = new Uint8Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ key[i % key.length];
  return out;
};

/**
 * Encode a map object to a `.mmap` ArrayBuffer ready to be downloaded
 * via Blob / saved by the desktop bridge.
 *
 * Always sets both flags (compressed + scrambled) — there's no benefit
 * shipping the uncompressed branch, but the format reserves the bits for
 * future use (e.g. a chunked / streaming variant).
 */
export function encodeMmap(map) {
  if (!map || typeof map !== "object") {
    throw new Error("encodeMmap: map must be an object");
  }
  const json = JSON.stringify(map);
  const raw = ENCODER.encode(json);
  const compressed = pako.deflate(raw);
  const scrambled = xorBuf(compressed, SCRAMBLE_KEY);

  const headerLen = 6;
  const out = new Uint8Array(headerLen + scrambled.length);
  out[0] = MAGIC.charCodeAt(0);
  out[1] = MAGIC.charCodeAt(1);
  out[2] = MAGIC.charCodeAt(2);
  out[3] = MAGIC.charCodeAt(3);
  out[4] = VERSION;
  out[5] = FLAG_COMPRESSED | FLAG_SCRAMBLED;
  out.set(scrambled, headerLen);
  return out.buffer;
}

/**
 * Decode a `.mmap` ArrayBuffer back into a map object.
 *
 * Throws an Error with a user-friendly message if the file isn't a valid
 * `.mmap` — the caller should toast the message verbatim.
 */
export function decodeMmap(buffer) {
  const view = new Uint8Array(buffer);
  if (view.length < 7) {
    throw new Error("This file is too short to be a Marvex map");
  }
  const magic = String.fromCharCode(view[0], view[1], view[2], view[3]);
  if (magic !== MAGIC) {
    throw new Error("Not a Marvex map (.mmap header missing)");
  }
  const version = view[4];
  if (version !== VERSION) {
    throw new Error(
      `This .mmap was written by a newer version (v${version}). Update Marvex Studio to open it.`,
    );
  }
  const flags = view[5];
  let payload = view.slice(6);
  if (flags & FLAG_SCRAMBLED) payload = xorBuf(payload, SCRAMBLE_KEY);
  if (flags & FLAG_COMPRESSED) payload = pako.inflate(payload);

  let parsed;
  try {
    parsed = JSON.parse(DECODER.decode(payload));
  } catch {
    throw new Error("This .mmap is corrupted — could not parse the map data.");
  }
  if (!parsed || typeof parsed !== "object" || !parsed.id) {
    throw new Error("This .mmap is missing a valid map document.");
  }
  return parsed;
}

/**
 * Trigger a browser download of `map` as `<safe-title>.mmap`.
 * Convenience wrapper used by the toolbar / context menu.
 */
export function downloadMmap(map) {
  const buf = encodeMmap(map);
  const blob = new Blob([buf], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const safeTitle = (map.title || "mindmap").replace(/[^a-z0-9-_ ]/gi, "_").slice(0, 60);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeTitle}.mmap`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Read a File handle (from <input type=file>) as a `.mmap` map document.
 * Resolves with the parsed map object or rejects with a user-readable error.
 */
export async function readMmapFile(file) {
  const buf = await file.arrayBuffer();
  return decodeMmap(buf);
}

/** Quick sniff — returns true if the first 4 bytes are the MMAP magic. */
export function isMmapBuffer(buffer) {
  const view = new Uint8Array(buffer);
  return (
    view.length >= 4 &&
    String.fromCharCode(view[0], view[1], view[2], view[3]) === MAGIC
  );
}
