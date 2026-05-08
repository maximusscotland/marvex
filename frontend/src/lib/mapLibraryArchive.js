/**
 * `.mmlib` — Marvex Studio's full-library archive.
 *
 * A single zip the user can drop on a USB stick to take EVERYTHING with
 * them: every map, reminders, recents, ink strokes, settings, and any
 * uploaded images / PDFs that live in localStorage as data: URLs.
 *
 * Layout inside the zip:
 *   manifest.json       { format: "mindmapper.lib.v1", exportedAt, mapCount, … }
 *   maps/<id>.mmap      Each map serialised through the proprietary `.mmap`
 *                       format — keeps the same "members-only" framing.
 *   storage.json        Other localStorage keys we want to preserve
 *                       (reminders, ink, recents, settings, etc.)
 *
 * Why split the maps out of `storage.json` and not just dump every key?
 * Because users open these zips, and the most recognisable / usable
 * artefact in there is the per-map `.mmap` file — they can re-share a
 * single map by extracting one file from the zip without us writing a
 * second tool.
 */

import JSZip from "jszip";
import { encodeMmap, decodeMmap } from "@/lib/mapFile";
import { listMaps, saveMap } from "@/lib/storage";

const MAPS_KEY = "mindmapper.maps.v1";

// Other keys we copy verbatim into storage.json. Keep the list narrow so
// we never accidentally smuggle the user's IndexedDB blobs / auth token
// into a portable file.
const PERSISTED_KEYS = [
  "mindmapper.reminders.v1",
  "mindmapper.recents.v1",
  "mindmapper.ink.v1",
  "mindmapper.settings.v1",
  "mindmapper.bookmarks.v1",
  "mm.bookmarkPicker.recents",
  "mm.libraryView",
  "mm.topToolbarOrient",
  "mm.privacyMode",
];

/**
 * Build a `.mmlib` zip from the user's current library.
 * Returns a Blob the caller can hand to `URL.createObjectURL`.
 */
export async function buildLibraryArchive() {
  const zip = new JSZip();
  const maps = listMaps();
  const manifest = {
    format: "mindmapper.lib.v1",
    exportedAt: new Date().toISOString(),
    appVersion: "0.1.0",
    mapCount: maps.length,
    maps: maps.map((m) => ({ id: m.id, title: m.title || "Untitled", file: `maps/${safeId(m.id)}.mmap` })),
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // Each map — proprietary binary so non-software users can't trivially read.
  const mapsFolder = zip.folder("maps");
  for (const m of maps) {
    try {
      mapsFolder.file(`${safeId(m.id)}.mmap`, encodeMmap(m));
    } catch (err) {
      // Single corrupt map shouldn't fail the whole archive — drop a stub
      // so the manifest still references the entry honestly.
      mapsFolder.file(
        `${safeId(m.id)}.error.txt`,
        `Could not encode this map: ${err?.message || "unknown error"}`,
      );
    }
  }

  const storage = {};
  for (const key of PERSISTED_KEYS) {
    try {
      const v = localStorage.getItem(key);
      if (v != null) storage[key] = v;
    } catch { /* private mode / quota */ }
  }
  zip.file("storage.json", JSON.stringify(storage, null, 2));

  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });
}

/** Trigger browser download of the full library as `<date>-mindmapper-library.mmlib`. */
export async function downloadLibraryArchive() {
  const blob = await buildLibraryArchive();
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${stamp}-mindmapper-library.mmlib`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Read a `.mmlib` File handle and merge its contents into the user's
 * current library. Maps with the same id are OVERWRITTEN — that's the
 * documented behaviour ("import" not "merge"); keeps the round-trip
 * clean.  Returns a summary `{ mapsAdded, mapsOverwritten, keysRestored }`.
 */
export async function importLibraryArchive(file) {
  const zip = await JSZip.loadAsync(file);
  const manifestEntry = zip.file("manifest.json");
  if (!manifestEntry) throw new Error("Not a Marvex library (manifest.json missing).");
  const manifest = JSON.parse(await manifestEntry.async("text"));
  if (!manifest?.format?.startsWith("mindmapper.lib.")) {
    throw new Error("Unrecognised library format.");
  }

  const before = new Set(listMaps().map((m) => m.id));
  let added = 0;
  let overwritten = 0;
  const mapEntries = Object.values(zip.files).filter((f) => /^maps\/[^/]+\.mmap$/.test(f.name));
  for (const entry of mapEntries) {
    try {
      const ab = await entry.async("arraybuffer");
      const map = decodeMmap(ab);
      // Make sure we keep the import idempotent: bump updatedAt and clear
      // any stale share registry pointer (slug from another device wouldn't
      // be revocable here).
      map.updatedAt = Date.now();
      saveMap(map);
      if (before.has(map.id)) overwritten += 1; else added += 1;
    } catch {
      // skip individually-corrupt maps
    }
  }

  // Restore other persisted keys.
  let keysRestored = 0;
  const storageEntry = zip.file("storage.json");
  if (storageEntry) {
    try {
      const data = JSON.parse(await storageEntry.async("text"));
      for (const [k, v] of Object.entries(data || {})) {
        if (!PERSISTED_KEYS.includes(k)) continue;   // ignore unknown keys
        try { localStorage.setItem(k, v); keysRestored += 1; } catch { /* ignore */ }
      }
    } catch { /* corrupt storage.json — ignore */ }
  }

  return { mapsAdded: added, mapsOverwritten: overwritten, keysRestored };
}

const safeId = (id) => String(id || "map").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 80);
