/**
 * Pure utility: runs a 2-level deep research expansion on a focus node
 * within a map and returns the updated map + count of added branches.
 *
 * Caller handles quota gating (Pro / BYO-key). This function will throw
 * on auth/quota errors — wrap accordingly.
 */
import { runResearchAssistant } from "@/lib/api";
import { getResearchConfig, getApiKey } from "@/lib/settings";

export const MAX_L2_PER_BRANCH = 2;

export async function runDeepResearch({ map, focusNode, onProgress }) {
  if (!map || !focusNode) return { map, added: 0 };
  const cfg = getResearchConfig();
  const userKey = getApiKey();

  // Build the outline context so the assistant can dedupe against existing
  // siblings anywhere in the tree.
  const outline = [];
  const walk = (node, depth = 0) => {
    outline.push({ title: node.title || "", depth });
    (node.children || []).forEach((c) => walk(c, depth + 1));
  };
  walk(map, 0);

  onProgress?.({ phase: "l1", title: focusNode.title });

  // ---- Level 1 ----
  const l1 = await runResearchAssistant({
    mapContext: {
      title: map.title || "Untitled",
      focus_title: focusNode.title || "",
      focus_summary: focusNode.summary || "",
      outline,
    },
    persona: cfg.persona,
    audience: cfg.audience,
    depth: cfg.depth,
    userKey,
  });

  const l1Branches = (l1.children || []).map((c) => ({
    ...c,
    id: `${focusNode.id}-dr-${Math.random().toString(36).slice(2, 7)}`,
  }));
  if (!l1Branches.length) return { map, added: 0 };

  onProgress?.({ phase: "l2", count: l1Branches.length });

  // ---- Level 2 (parallel, one call per L1 branch) ----
  const l2Results = await Promise.allSettled(
    l1Branches.map(async (parent) => {
      try {
        const r = await runResearchAssistant({
          mapContext: {
            title: map.title || "Untitled",
            focus_title: parent.title || "",
            focus_summary: parent.summary || "",
            outline: [...outline, { title: parent.title, depth: 1 }],
          },
          persona: cfg.persona,
          audience: cfg.audience,
          depth: cfg.depth,
          userKey,
        });
        const kids = (r.children || []).slice(0, MAX_L2_PER_BRANCH).map((c) => ({
          ...c,
          id: `${parent.id}-dr-${Math.random().toString(36).slice(2, 7)}`,
        }));
        return { parentId: parent.id, kids };
      } catch {
        return { parentId: parent.id, kids: [] };
      }
    })
  );

  let totalAdded = l1Branches.length;
  l2Results.forEach((r) => {
    if (r.status === "fulfilled") {
      const parent = l1Branches.find((p) => p.id === r.value.parentId);
      if (parent) {
        parent.children = [...(parent.children || []), ...r.value.kids];
        totalAdded += r.value.kids.length;
      }
    }
  });

  // ---- Graft L1+L2 subtree under focus node ----
  const graft = (node) => {
    if (node.id === focusNode.id) {
      return { ...node, children: [...(node.children || []), ...l1Branches] };
    }
    if (!node.children || !node.children.length) return node;
    return { ...node, children: node.children.map(graft) };
  };
  const isRoot = focusNode.id === map.id;
  const nextMap = isRoot
    ? {
        ...map,
        children: [...(map.children || []), ...l1Branches],
        source: map.source || "research",
      }
    : {
        ...map,
        children: (map.children || []).map(graft),
        source: map.source || "research",
      };

  return { map: nextMap, added: totalAdded };
}
