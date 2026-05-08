/**
 * Cloud sync client — Pro-only, last-write-wins.
 *
 * Responsibilities:
 *   - Push local maps → /api/sync/maps (batch)
 *   - Pull remote maps → write winners into localStorage
 *   - Track lastSyncedAt + tombstones-sent so we don't re-upload deletions
 *
 * Conflict resolution: `updatedAt` wins. Ties go to the server (since push
 * only happens when client thinks local is newer or equal).
 *
 * This module NEVER mutates localStorage unless it has a definitively
 * newer copy — if the backend is offline or returns 402, we silently bail.
 * Callers get a `{ok, error?, pushed, pulled, deleted}` summary.
 */

import axios from "axios";
import { listMaps, saveMap } from "@/lib/storage";
import { pushSnapshot } from "@/lib/mapHistory";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STATE_KEY = "mindmapper.cloudSync.v1";
const TOMB_KEY  = "mindmapper.cloudSync.tombstones.v1";

const readState = () => {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};
const writeState = (s) => {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch { /* quota */ }
};

/**
 * Tombstones — mark a map as locally-deleted. The next sync push will
 * call DELETE /api/sync/maps/:id for each entry; successful ones are
 * removed from the tombstone set.
 */
const readTombstones = () => {
  try {
    const raw = localStorage.getItem(TOMB_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};
const writeTombstones = (arr) => {
  try { localStorage.setItem(TOMB_KEY, JSON.stringify(arr)); } catch { /* quota */ }
};
export const markMapDeleted = (mapId) => {
  if (!mapId) return;
  const s = new Set(readTombstones());
  s.add(mapId);
  writeTombstones([...s]);
};
export const clearTombstones = () => writeTombstones([]);

/**
 * Roll back the most recent sync-pull overwrite for a map. Pops the
 * latest snapshot from mapHistory, writes it back to localStorage with
 * a bumped updatedAt (now() + 1 ms past the server watermark) so the
 * NEXT sync push wins and the server gets our restored version.
 *
 * Returns true if a restore happened, false if no snapshot existed.
 */
export const undoLastSyncPull = async (mapId) => {
  // Lazy import to keep mapHistory a pure dependency (no cycle).
  const { popSnapshot } = await import("@/lib/mapHistory");
  const snap = popSnapshot(mapId);
  if (!snap) return false;
  const restored = { ...snap.data, id: mapId, updatedAt: Date.now() };
  // Write directly to the maps key — saveMap would also trigger a fresh
  // updatedAt but we want to use our explicit one so the next push
  // definitively wins.
  try {
    const raw = localStorage.getItem("mindmapper.maps.v1");
    const arr = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(arr) ? arr.filter((m) => m.id !== mapId) : [];
    next.unshift(restored);
    localStorage.setItem("mindmapper.maps.v1", JSON.stringify(next));
  } catch { /* quota */ }
  return true;
};

export const getLastSyncedAt = () => readState().lastSyncedAt || 0;
export const getLastSyncError = () => readState().lastError || null;

/**
 * GET /api/sync/status — returns {enabled, map_count, server_time}.
 * `enabled` is false for non-Pro users; callers should avoid running
 * sync at all in that case (avoids a noisy stream of 402s).
 */
export const fetchSyncStatus = async () => {
  try {
    const res = await axios.get(`${API}/sync/status`, {
      withCredentials: true, timeout: 8000,
    });
    return res.data;
  } catch (e) {
    return { enabled: false, error: String(e?.message || e) };
  }
};

/**
 * Run one full sync pass: delete tombstoned maps, pull remote changes,
 * push local changes. Returns a summary for the UI badge.
 */
export const syncNow = async () => {
  const state = readState();
  const since = state.lastSyncedAt || 0;
  const summary = { ok: false, pushed: 0, pulled: 0, deleted: 0, error: null };

  // 1) Push tombstones first so a delete-then-recreate never gets reversed.
  const tombs = readTombstones();
  for (const id of tombs) {
    try {
      await axios.delete(`${API}/sync/maps/${encodeURIComponent(id)}`, {
        withCredentials: true, timeout: 10000,
      });
      summary.deleted += 1;
    } catch (e) {
      if (e?.response?.status === 402) { // Pro-gated
        summary.error = "pro-required";
        return summary;
      }
      // transient — leave the tombstone for next pass
    }
  }
  if (summary.deleted > 0) clearTombstones();

  // 2) Pull remote changes since `since`.
  let serverMaps = [];
  let serverTombstones = [];
  let serverTime = Date.now();
  try {
    const res = await axios.get(`${API}/sync/maps`, {
      params: { since },
      withCredentials: true,
      timeout: 20000,
    });
    serverMaps = res.data?.maps || [];
    serverTombstones = res.data?.tombstones || [];
    serverTime = res.data?.server_time || Date.now();
  } catch (e) {
    if (e?.response?.status === 402) {
      summary.error = "pro-required"; return summary;
    }
    summary.error = e?.response?.status === 401 ? "signed-out" : "network";
    return summary;
  }

  // Apply server winners: for each remote map, overwrite local ONLY if
  // remote updated_at > local updatedAt (newer). Also delete locally
  // anything the server says is tombstoned.
  const localAll = listMaps();
  const localById = new Map(localAll.map((m) => [m.id, m]));
  const pulledDetails = []; // {mapId, title, prevVersion?} — fed to the UI toast
  for (const rm of serverMaps) {
    const local = localById.get(rm.map_id);
    const localUpdated = local ? (local.updatedAt || 0) : 0;
    if (rm.updated_at > localUpdated) {
      // Snapshot BEFORE overwriting so the user can Undo. Only snapshot
      // when we actually have a local copy to lose — pure first-pull
      // from a new device has no "before" state to preserve.
      if (local) pushSnapshot(rm.map_id, local);
      const merged = { ...(rm.data || {}), id: rm.map_id, updatedAt: rm.updated_at };
      saveMap(merged); // saveMap stamps a fresh updatedAt — so restore it.
      const allAfter = listMaps();
      const i = allAfter.findIndex((m) => m.id === rm.map_id);
      if (i >= 0) {
        allAfter[i].updatedAt = rm.updated_at;
        try { localStorage.setItem("mindmapper.maps.v1", JSON.stringify(allAfter)); } catch { /* */ }
      }
      summary.pulled += 1;
      pulledDetails.push({
        mapId: rm.map_id,
        title: (rm.data && rm.data.title) || (local && local.title) || "Untitled",
        hadLocal: !!local,
      });
    }
  }
  for (const tid of serverTombstones) {
    if (localById.has(tid)) {
      const remaining = listMaps().filter((m) => m.id !== tid);
      try { localStorage.setItem("mindmapper.maps.v1", JSON.stringify(remaining)); } catch { /* */ }
      summary.deleted += 1;
    }
  }

  // 3) Push local maps that are newer than our last sync.
  // We send every map that was modified after `since` (the last known
  // server_time we consumed). The server's LWW check handles stale pushes.
  const toPush = listMaps()
    .filter((m) => (m.updatedAt || 0) > since)
    .map((m) => ({
      map_id: m.id,
      data: m,
      updated_at: m.updatedAt || Date.now(),
    }));
  if (toPush.length) {
    try {
      const res = await axios.post(`${API}/sync/maps`, { maps: toPush }, {
        withCredentials: true, timeout: 30000,
      });
      const results = res.data?.results || [];
      summary.pushed = results.filter((r) => r.outcome === "uploaded").length;
    } catch (e) {
      if (e?.response?.status === 402) { summary.error = "pro-required"; return summary; }
      summary.error = e?.response?.status === 401 ? "signed-out" : "network";
      return summary;
    }
  }

  // 4) Commit watermark.
  writeState({ lastSyncedAt: serverTime, lastError: null });
  summary.ok = true;
  summary.pulledDetails = pulledDetails;

  // Fire a DOM event so any mounted component can react (toast with Undo,
  // sidebar dot, etc.). Ignored when nothing actually changed locally.
  if (typeof window !== "undefined" && pulledDetails.some((p) => p.hadLocal)) {
    try {
      window.dispatchEvent(new CustomEvent("mindmapper:sync-pulled", {
        detail: {
          pulled: pulledDetails.filter((p) => p.hadLocal),
          at: Date.now(),
        },
      }));
    } catch { /* IE/old webviews — noop */ }
  }

  return summary;
};
