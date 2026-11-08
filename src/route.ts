import type { KnowledgeNode, Mastery, Importance } from "./types";

export interface RouteStats {
  total: number;
  mastered: number;
  partial: number;
  remaining: number;
  remainingHours: number;
  progressPct: number;
}

export interface RouteStage {
  index: number; // 从 1 开始
  nodes: KnowledgeNode[];
}

export interface RouteResult {
  stages: RouteStage[];
  stats: RouteStats;
  warnings: string[];
}

const IMPORTANCE_ORDER: Record<Importance, number> = {
  core: 0,
  recommended: 1,
  extension: 2,
};

function normName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

export function computeStats(nodes: KnowledgeNode[]): RouteStats {
  const total = nodes.length;
  const mastered = nodes.filter((n) => n.mastery === "mastered").length;
  const partial = nodes.filter((n) => n.mastery === "partial").length;
  const remaining = total - mastered;
  const remainingHours = nodes
    .filter((n) => n.mastery !== "mastered")
    .reduce((s, n) => s + (Number(n.estHours) || 0), 0);
  const progressPct = total === 0 ? 0 : Math.round((mastered / total) * 100);
  return { total, mastered, partial, remaining, remainingHours, progressPct };
}

/**
 * 把知识清单规划成分阶段学习路线：
 * 1. 过滤已掌握节点
 * 2. prereq 名称 → 节点 id 归一化匹配（匹配不到的忽略）
 * 3. Kahn 拓扑排序；出现环时从重要度最低的节点断边
 * 4. 节点层级 = 最长依赖路径深度，按层级分阶段
 * 5. 阶段内：core 优先，再按 estHours 降序
 */
export function computeRoute(nodes: KnowledgeNode[]): RouteResult {
  const warnings: string[] = [];
  const stats = computeStats(nodes);
  const active = nodes.filter((n) => n.mastery !== "mastered");

  // 名称 → id（同一个名字多个节点时取第一个）
  const idByName = new Map<string, string>();
  for (const n of active) {
    const key = normName(n.name);
    if (!idByName.has(key)) idByName.set(key, n.id);
  }

  // 依赖边：prereq 节点 → 当前节点
  const deps = new Map<string, Set<string>>(); // nodeId -> 依赖的节点 id 集合
  const dependents = new Map<string, Set<string>>(); // nodeId -> 依赖它的节点 id 集合
  for (const n of active) {
    if (!deps.has(n.id)) deps.set(n.id, new Set());
    if (!dependents.has(n.id)) dependents.set(n.id, new Set());
  }
  for (const n of active) {
    for (const p of n.prereqs || []) {
      const pid = idByName.get(normName(p));
      if (!pid || pid === n.id) continue;
      deps.get(n.id)!.add(pid);
      dependents.get(pid)!.add(n.id);
    }
  }

  // Kahn 拓扑排序 + 断环
  const inDeg = new Map<string, number>();
  for (const [id, set] of deps) inDeg.set(id, set.size);
  const queue: string[] = active.filter((n) => (inDeg.get(n.id) || 0) === 0).map((n) => n.id);
  const order: string[] = [];
  const nodeById = new Map(active.map((n) => [n.id, n]));
  const removedEdges: string[] = [];

  while (queue.length || inDeg.size > order.length) {
    while (queue.length) {
      const id = queue.shift()!;
      order.push(id);
      for (const dep of dependents.get(id) || []) {
        const d = (inDeg.get(dep) || 0) - 1;
        inDeg.set(dep, d);
        if (d === 0) queue.push(dep);
      }
    }
    // 仍有剩余节点 → 存在环，从环中重要度最低的节点断掉一条出边
    const stuck = active.filter(
      (n) => !order.includes(n.id) && (inDeg.get(n.id) || 0) > 0
    );
    if (!stuck.length) break;
    stuck.sort(
      (a, b) =>
        IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance] ||
        a.name.localeCompare(b.name)
    );
    const victim = stuck[0];
    const depIds = Array.from(deps.get(victim.id) || []);
    if (!depIds.length) break;
    // 断掉 victim 的一条前置边（选依赖数最多的前置，尽量瓦解环）
    depIds.sort((a, b) => (dependents.get(b)?.size || 0) - (dependents.get(a)?.size || 0));
    const cut = depIds[0];
    deps.get(victim.id)!.delete(cut);
    dependents.get(cut)!.delete(victim.id);
    inDeg.set(victim.id, (inDeg.get(victim.id) || 0) - 1);
    removedEdges.push(`${cut} → ${victim.id}`);
    if (inDeg.get(victim.id) === 0) queue.push(victim.id);
  }
  if (removedEdges.length) {
    warnings.push(`检测到依赖循环，已自动忽略部分前置关系（不影响学习顺序的合理性）`);
  }

  // 层级 = 最长路径深度
  const level = new Map<string, number>();
  for (const id of order) {
    const ds = deps.get(id) || new Set<string>();
    let lv = 0;
    for (const d of ds) lv = Math.max(lv, (level.get(d) ?? -1) + 1);
    level.set(id, lv);
  }

  const maxLevel = Math.max(-1, ...Array.from(level.values()));
  const stages: RouteStage[] = [];
  for (let lv = 0; lv <= maxLevel; lv++) {
    const group = order
      .filter((id) => level.get(id) === lv)
      .map((id) => nodeById.get(id)!)
      .sort(
        (a, b) =>
          IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance] ||
          b.estHours - a.estHours ||
          a.name.localeCompare(b.name)
      );
    if (group.length) stages.push({ index: stages.length + 1, nodes: group });
  }

  return { stages, stats, warnings };
}

export function masteryLabel(m: Mastery): string {
  return m === "mastered" ? "已掌握" : m === "partial" ? "部分掌握" : "未掌握";
}

export function importanceLabel(i: Importance): string {
  return i === "core" ? "核心" : i === "recommended" ? "进阶" : "拓展";
}

/**
 * 计算全部节点的依赖层级（最长路径深度），用于知识图谱布局。
 * prereq 名称匹配不到的忽略；出现环时从低重要度节点断边。
 */
export function computeLevels(nodes: KnowledgeNode[]): Map<string, number> {
  const idByName = new Map<string, string>();
  for (const n of nodes) {
    const key = normName(n.name);
    if (!idByName.has(key)) idByName.set(key, n.id);
  }
  const deps = new Map<string, Set<string>>();
  for (const n of nodes) deps.set(n.id, new Set());
  for (const n of nodes) {
    for (const p of n.prereqs || []) {
      const pid = idByName.get(normName(p));
      if (!pid || pid === n.id) continue;
      deps.get(n.id)!.add(pid);
    }
  }
  // Kahn + 断环
  const inDeg = new Map<string, number>();
  for (const [id, set] of deps) inDeg.set(id, set.size);
  const dependents = new Map<string, Set<string>>();
  for (const n of nodes) dependents.set(n.id, new Set());
  for (const [id, set] of deps) {
    for (const d of set) dependents.get(d)!.add(id);
  }
  const order: string[] = [];
  const queue = nodes.filter((n) => (inDeg.get(n.id) || 0) === 0).map((n) => n.id);
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const dep of dependents.get(id) || []) {
      const d = (inDeg.get(dep) || 0) - 1;
      inDeg.set(dep, d);
      if (d === 0) queue.push(dep);
    }
  }
  if (order.length < nodes.length) {
    // 有环：反复从环中入度最小的节点断边
    const remaining = nodes.filter((n) => !order.includes(n.id));
    for (const victim of remaining) {
      const ds = deps.get(victim.id)!;
      if (ds.size) {
        const first = Array.from(ds)[0];
        ds.delete(first);
        dependents.get(first)!.delete(victim.id);
        inDeg.set(victim.id, (inDeg.get(victim.id) || 0) - 1);
        if (inDeg.get(victim.id) === 0) queue.push(victim.id);
      }
      while (queue.length) {
        const id = queue.shift()!;
        order.push(id);
        for (const dep of dependents.get(id) || []) {
          const d = (inDeg.get(dep) || 0) - 1;
          inDeg.set(dep, d);
          if (d === 0) queue.push(dep);
        }
      }
    }
  }
  // 最长路径分层
  const level = new Map<string, number>();
  for (const id of order) {
    let lv = 0;
    for (const d of deps.get(id) || []) lv = Math.max(lv, (level.get(d) ?? -1) + 1);
    level.set(id, lv);
  }
  return level;
}
