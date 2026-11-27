export interface MinimalTaskNode {
  id: string;
  parentId?: string | null;
  sortOrder?: number;
  startDate?: string | Date;
}

export interface MinimalTimeLog {
  id?: string;
  startTime: string | Date;
  endTime?: string | Date | null;
  duration?: number | null;
  durationSeconds?: number | null;
}

/**
 * Determine whether setting `candidateParentId` on `taskId` would introduce a circular hierarchy.
 * Walks upward along `parentId` pointers using a visited set so malformed data never loops infinitely.
 */
export function wouldCreateTaskCycle(
  taskId: string,
  candidateParentId: string | null | undefined,
  tasks: MinimalTaskNode[]
): boolean {
  if (!candidateParentId) return false;
  if (candidateParentId === taskId) return true;

  const byId = new Map<string, MinimalTaskNode>();
  for (const t of tasks) {
    byId.set(t.id, t);
  }

  const visited = new Set<string>([taskId]);
  let currentId: string | null | undefined = candidateParentId;

  while (currentId) {
    if (visited.has(currentId)) {
      return true;
    }
    visited.add(currentId);
    const node = byId.get(currentId);
    currentId = node?.parentId || null;
  }

  return false;
}

/**
 * Collect all descendant task IDs (children, grandchildren, etc.) safely with cycle protection.
 */
export function collectDescendantTaskIds(rootId: string, tasks: MinimalTaskNode[]): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const t of tasks) {
    if (!t.parentId) continue;
    const arr = childrenByParent.get(t.parentId) || [];
    arr.push(t.id);
    childrenByParent.set(t.parentId, arr);
  }

  const descendants: string[] = [];
  const visited = new Set<string>([rootId]);
  const queue: string[] = [...(childrenByParent.get(rootId) || [])];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    descendants.push(id);
    const grandKids = childrenByParent.get(id) || [];
    queue.push(...grandKids);
  }

  return descendants;
}

/**
 * Compute total logged seconds across completed and currently running TimeLog sessions.
 */
export function computeTaskLoggedSeconds(
  timeLogs: MinimalTimeLog[],
  nowMs: number = Date.now()
): number {
  let total = 0;
  for (const log of timeLogs) {
    if (log.durationSeconds && log.durationSeconds > 0) {
      total += log.durationSeconds;
      continue;
    }
    if (log.duration && log.duration > 0) {
      total += log.duration;
      continue;
    }
    const startMs = new Date(log.startTime).getTime();
    if (Number.isNaN(startMs)) continue;
    const endMs = log.endTime ? new Date(log.endTime).getTime() : nowMs;
    if (!Number.isNaN(endMs) && endMs > startMs) {
      total += Math.floor((endMs - startMs) / 1000);
    }
  }
  return total;
}

/**
 * Order tasks hierarchically (root -> children) safely without duplicating or looping.
 */
export function buildFlatTaskTree<T extends MinimalTaskNode>(
  tasks: T[]
): Array<{ task: T; depth: number; childCount: number }> {
  const taskIds = new Set(tasks.map((t) => t.id));
  const childrenMap = new Map<string, T[]>();
  const roots: T[] = [];

  for (const t of tasks) {
    if (t.parentId && taskIds.has(t.parentId) && t.parentId !== t.id) {
      const list = childrenMap.get(t.parentId) || [];
      list.push(t);
      childrenMap.set(t.parentId, list);
    } else {
      roots.push(t);
    }
  }

  const sortFn = (a: T, b: T) => {
    const sa = a.sortOrder ?? 0;
    const sb = b.sortOrder ?? 0;
    if (sa !== sb) return sa - sb;
    const da = a.startDate ? new Date(a.startDate).getTime() : 0;
    const db = b.startDate ? new Date(b.startDate).getTime() : 0;
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  };

  roots.sort(sortFn);
  for (const list of childrenMap.values()) {
    list.sort(sortFn);
  }

  const result: Array<{ task: T; depth: number; childCount: number }> = [];
  const visited = new Set<string>();

  function walk(node: T, depth: number) {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    const kids = childrenMap.get(node.id) || [];
    result.push({ task: node, depth, childCount: kids.length });
    for (const child of kids) {
      walk(child, depth + 1);
    }
  }

  for (const r of roots) {
    walk(r, 0);
  }

  // Append any unreachable orphan cycle nodes gracefully
  for (const t of tasks) {
    if (!visited.has(t.id)) {
      walk(t, 0);
    }
  }

  return result;
}

export interface ProjectGroupTree<
  P extends { id: string; name: string },
  T extends MinimalTaskNode & { projectId?: string | null; status?: string },
> {
  projectKey: string;
  project: P | null;
  rows: Array<{ task: T; depth: number; childCount: number }>;
  totalCount: number;
  completedCount: number;
}

/**
 * Group tasks cleanly under their top-level Project so tasks from Project A, B, and C
 * never interleave when viewing All Projects, while preserving parent -> subtask trees inside each project.
 */
export function buildProjectGroupedTaskTrees<
  P extends { id: string; name: string },
  T extends MinimalTaskNode & { projectId?: string | null; status?: string },
>(projects: P[], tasks: T[]): Array<ProjectGroupTree<P, T>> {
  const byProjectId = new Map<string, T[]>();
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  for (const t of tasks) {
    const key = t.projectId && projectMap.has(t.projectId) ? t.projectId : "__unassigned__";
    const list = byProjectId.get(key) || [];
    list.push(t);
    byProjectId.set(key, list);
  }

  const orderedKeys: string[] = [];
  for (const p of projects) {
    if (byProjectId.has(p.id)) {
      orderedKeys.push(p.id);
    }
  }
  if (byProjectId.has("__unassigned__")) {
    orderedKeys.push("__unassigned__");
  }

  return orderedKeys.map((key) => {
    const groupTasks = byProjectId.get(key) || [];
    const rows = buildFlatTaskTree(groupTasks);
    const completedCount = groupTasks.filter(
      (t) => t.status === "Completed" || t.status === "Done"
    ).length;

    return {
      projectKey: key,
      project: key === "__unassigned__" ? null : projectMap.get(key) || null,
      rows,
      totalCount: groupTasks.length,
      completedCount,
    };
  });
}

export type ReorderDropMode = "before" | "after" | "inside" | "root";

export interface MinimalReorderTask extends MinimalTaskNode {
  projectId?: string | null;
}

export interface ReorderUpdateEntry {
  id: string;
  sortOrder: number;
  parentId?: string | null;
  projectId?: string | null;
}

export type ReorderResult =
  | {
      ok: false;
      error: string;
      status: 400 | 404;
    }
  | {
      ok: true;
      updates: ReorderUpdateEntry[];
      nextParentId: string | null;
      nextProjectId: string | null;
      descendantIds: string[];
    };

/**
 * Compute deterministic sibling sortOrder updates and parent/project reassignment
 * when dragging a task above, below, inside another task, or onto a project root.
 */
export function computeSiblingReorderUpdates<T extends MinimalReorderTask>(
  allTasks: T[],
  params: {
    taskId: string;
    targetTaskId?: string | null;
    mode: ReorderDropMode;
    targetProjectId?: string | null;
  }
): ReorderResult {
  const { taskId, targetTaskId = null, mode, targetProjectId } = params;
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  const moving = byId.get(taskId);
  if (!moving) {
    return { ok: false, error: "Task not found", status: 404 };
  }

  let nextParentId: string | null = moving.parentId ?? null;
  let nextProjectId: string | null = moving.projectId ?? null;

  if (mode === "root" || !targetTaskId) {
    nextParentId = null;
    if (targetProjectId !== undefined) {
      nextProjectId = targetProjectId === "__unassigned__" ? null : targetProjectId;
    }
  } else {
    const target = byId.get(targetTaskId);
    if (!target) {
      return { ok: false, error: "Target task not found", status: 404 };
    }
    if (target.id === taskId) {
      return {
        ok: true,
        updates: [],
        nextParentId,
        nextProjectId,
        descendantIds: [],
      };
    }

    if (mode === "inside") {
      nextParentId = target.id;
      nextProjectId = target.projectId ?? moving.projectId ?? null;
    } else {
      nextParentId = target.parentId ?? null;
      nextProjectId = target.projectId ?? null;
    }
  }

  if (nextParentId && wouldCreateTaskCycle(taskId, nextParentId, allTasks)) {
    return { ok: false, error: "Circular parent-child dependency is not allowed", status: 400 };
  }

  const sortFn = (a: T, b: T) => {
    const sa = a.sortOrder ?? 0;
    const sb = b.sortOrder ?? 0;
    if (sa !== sb) return sa - sb;
    const da = a.startDate ? new Date(a.startDate).getTime() : 0;
    const db = b.startDate ? new Date(b.startDate).getTime() : 0;
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  };

  const siblings = allTasks
    .filter((t) => {
      if (t.id === taskId) return false;
      if ((t.parentId ?? null) !== nextParentId) return false;
      if (nextParentId === null && (t.projectId ?? null) !== nextProjectId) return false;
      return true;
    })
    .sort(sortFn);

  let insertIdx = siblings.length;
  if (mode === "root" || !targetTaskId) {
    insertIdx = 0;
  } else if (mode === "before") {
    const idx = siblings.findIndex((s) => s.id === targetTaskId);
    insertIdx = idx >= 0 ? idx : 0;
  } else if (mode === "after") {
    const idx = siblings.findIndex((s) => s.id === targetTaskId);
    insertIdx = idx >= 0 ? idx + 1 : siblings.length;
  } else if (mode === "inside") {
    insertIdx = siblings.length;
  }

  const orderedIds = siblings.map((s) => s.id);
  orderedIds.splice(insertIdx, 0, taskId);

  const descendantIds =
    (moving.projectId ?? null) !== nextProjectId
      ? collectDescendantTaskIds(taskId, allTasks)
      : [];

  const updates: ReorderUpdateEntry[] = orderedIds.map((id, idx) => {
    const sortOrder = idx * 10;
    if (id === taskId) {
      return {
        id,
        sortOrder,
        parentId: nextParentId,
        projectId: nextProjectId,
      };
    }
    return { id, sortOrder };
  });

  return {
    ok: true,
    updates,
    nextParentId,
    nextProjectId,
    descendantIds,
  };
}

export interface SubtaskStats {
  total: number;
  completed: number;
}

/**
 * Compute direct & transitive child subtask completion counts keyed by each parent task ID.
 */
export function computeSubtaskStatsByParent<
  T extends MinimalTaskNode & { status?: string },
>(tasks: T[]): Map<string, SubtaskStats> {
  const byId = new Set(tasks.map((t) => t.id));
  const stats = new Map<string, SubtaskStats>();

  for (const t of tasks) {
    if (!t.parentId || !byId.has(t.parentId) || t.parentId === t.id) continue;
    const prev = stats.get(t.parentId) || { total: 0, completed: 0 };
    const isDone = t.status === "Completed" || t.status === "Done";
    stats.set(t.parentId, {
      total: prev.total + 1,
      completed: prev.completed + (isDone ? 1 : 0),
    });
  }

  return stats;
}

export interface KanbanProjectLane<
  P extends { id: string; name: string },
  T extends MinimalTaskNode & { projectId?: string | null; status?: string },
> {
  projectKey: string;
  project: P | null;
  tasks: T[];
  totalCount: number;
  completedCount: number;
}

/**
 * Group tasks cleanly into per-project Kanban swimlanes preserving project order
 * and keeping main-task vs subtask filtering consistent.
 */
export function buildKanbanProjectLanes<
  P extends { id: string; name: string },
  T extends MinimalTaskNode & { projectId?: string | null; status?: string },
>(
  projects: P[],
  filteredTasks: T[],
  options?: { mainTasksOnly?: boolean; allTaskIds?: Set<string> }
): Array<KanbanProjectLane<P, T>> {
  const mainTasksOnly = Boolean(options?.mainTasksOnly);
  const allIds = options?.allTaskIds || new Set(filteredTasks.map((t) => t.id));
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const byProjectId = new Map<string, T[]>();

  for (const t of filteredTasks) {
    if (mainTasksOnly && t.parentId && allIds.has(t.parentId) && t.parentId !== t.id) {
      continue;
    }
    const key = t.projectId && projectMap.has(t.projectId) ? t.projectId : "__unassigned__";
    const list = byProjectId.get(key) || [];
    list.push(t);
    byProjectId.set(key, list);
  }

  const orderedKeys: string[] = [];
  for (const p of projects) {
    if (byProjectId.has(p.id)) orderedKeys.push(p.id);
  }
  if (byProjectId.has("__unassigned__")) {
    orderedKeys.push("__unassigned__");
  }

  return orderedKeys.map((key) => {
    const laneTasks = byProjectId.get(key) || [];
    const completedCount = laneTasks.filter(
      (t) => t.status === "Completed" || t.status === "Done"
    ).length;
    return {
      projectKey: key,
      project: key === "__unassigned__" ? null : projectMap.get(key) || null,
      tasks: laneTasks,
      totalCount: laneTasks.length,
      completedCount,
    };
  });
}
