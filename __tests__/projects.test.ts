import {
  buildFlatTaskTree,
  buildKanbanProjectLanes,
  buildProjectGroupedTaskTrees,
  collectDescendantTaskIds,
  computeSiblingReorderUpdates,
  computeSubtaskStatsByParent,
  computeTaskLoggedSeconds,
  wouldCreateTaskCycle,
} from "../src/lib/project-helpers";

describe("Project & Task Helpers", () => {
  const sampleTasks = [
    { id: "root", parentId: null, sortOrder: 1 },
    { id: "child-1", parentId: "root", sortOrder: 1 },
    { id: "grandchild-1", parentId: "child-1", sortOrder: 1 },
    { id: "other-root", parentId: null, sortOrder: 2 },
  ];

  test("detects self-parenting and transitive circular dependencies", () => {
    expect(wouldCreateTaskCycle("root", "root", sampleTasks)).toBe(true);
    expect(wouldCreateTaskCycle("root", "child-1", sampleTasks)).toBe(true);
    expect(wouldCreateTaskCycle("root", "grandchild-1", sampleTasks)).toBe(true);
    expect(wouldCreateTaskCycle("child-1", "grandchild-1", sampleTasks)).toBe(true);

    // Valid moves
    expect(wouldCreateTaskCycle("grandchild-1", "root", sampleTasks)).toBe(false);
    expect(wouldCreateTaskCycle("child-1", "other-root", sampleTasks)).toBe(false);
    expect(wouldCreateTaskCycle("child-1", null, sampleTasks)).toBe(false);
  });

  test("collects all descendants safely in multi-level trees", () => {
    expect(collectDescendantTaskIds("root", sampleTasks)).toEqual(["child-1", "grandchild-1"]);
    expect(collectDescendantTaskIds("other-root", sampleTasks)).toEqual([]);
  });

  test("builds deterministic flat tree with accurate depth and child counts", () => {
    const flat = buildFlatTaskTree(sampleTasks);
    expect(flat.map((r) => `${r.task.id}:${r.depth}:${r.childCount}`)).toEqual([
      "root:0:1",
      "child-1:1:1",
      "grandchild-1:2:0",
      "other-root:0:0",
    ]);
  });

  test("computes total logged seconds from finished and live running TimeLog sessions", () => {
    const now = new Date("2026-11-25T10:00:00Z").getTime();
    const total = computeTaskLoggedSeconds(
      [
        { startTime: "2026-11-25T08:00:00Z", endTime: "2026-11-25T08:30:00Z", durationSeconds: 1800 },
        { startTime: "2026-11-25T09:00:00Z", endTime: "2026-11-25T09:15:00Z", duration: 900 },
        { startTime: "2026-11-25T09:50:00Z", endTime: null }, // live 10m = 600s
      ],
      now
    );
    expect(total).toBe(3300);
  });

  test("groups tasks cleanly by project without interleaving across projects", () => {
    const projects = [
      { id: "p-a", name: "Project A" },
      { id: "p-b", name: "Project B" },
    ];
    const mixedTasks = [
      { id: "a1", projectId: "p-a", parentId: null, sortOrder: 1, status: "Completed" },
      { id: "b1", projectId: "p-b", parentId: null, sortOrder: 1, status: "Ongoing" },
      { id: "a2", projectId: "p-a", parentId: null, sortOrder: 2, status: "Ongoing" },
      { id: "a1-sub", projectId: "p-a", parentId: "a1", sortOrder: 1, status: "Completed" },
      { id: "orphan", projectId: null, parentId: null, sortOrder: 1, status: "Not Started" },
    ];
    const groups = buildProjectGroupedTaskTrees(projects, mixedTasks);
    expect(groups.map((g) => g.projectKey)).toEqual(["p-a", "p-b", "__unassigned__"]);
    expect(groups[0].rows.map((r) => `${r.task.id}:${r.depth}`)).toEqual([
      "a1:0",
      "a1-sub:1",
      "a2:0",
    ]);
    expect(groups[0].completedCount).toBe(2);
    expect(groups[1].rows.map((r) => r.task.id)).toEqual(["b1"]);
    expect(groups[2].rows.map((r) => r.task.id)).toEqual(["orphan"]);
  });

  test("reorders siblings before/after cleanly even when initial sortOrder values tie at 0", () => {
    const tasks = [
      { id: "t1", projectId: "p1", parentId: null, sortOrder: 0, startDate: "2026-07-01" },
      { id: "t2", projectId: "p1", parentId: null, sortOrder: 0, startDate: "2026-07-02" },
      { id: "t3", projectId: "p1", parentId: null, sortOrder: 0, startDate: "2026-07-03" },
      { id: "sub1", projectId: "p1", parentId: "t1", sortOrder: 0, startDate: "2026-07-01" },
    ];

    // Move t3 ABOVE t1 -> t3 becomes sortOrder 0, t1 becomes 10, t2 becomes 20
    const moveBefore = computeSiblingReorderUpdates(tasks, {
      taskId: "t3",
      targetTaskId: "t1",
      mode: "before",
    });
    expect(moveBefore.ok).toBe(true);
    if (moveBefore.ok) {
      expect(moveBefore.updates.map((u) => `${u.id}:${u.sortOrder}`)).toEqual([
        "t3:0",
        "t1:10",
        "t2:20",
      ]);
      expect(moveBefore.nextParentId).toBeNull();
    }

    // Move sub1 BELOW t2 (auto-promotes sub1 to root after t2)
    const promoteAfter = computeSiblingReorderUpdates(tasks, {
      taskId: "sub1",
      targetTaskId: "t2",
      mode: "after",
    });
    expect(promoteAfter.ok).toBe(true);
    if (promoteAfter.ok) {
      expect(promoteAfter.nextParentId).toBeNull();
      expect(promoteAfter.updates.map((u) => `${u.id}:${u.sortOrder}`)).toEqual([
        "t1:0",
        "t2:10",
        "sub1:20",
        "t3:30",
      ]);
    }

    // Prevent circular nesting when trying to drop parent t1 inside its child sub1
    const cycleAttempt = computeSiblingReorderUpdates(tasks, {
      taskId: "t1",
      targetTaskId: "sub1",
      mode: "inside",
    });
    expect(cycleAttempt.ok).toBe(false);
    if (!cycleAttempt.ok) {
      expect(cycleAttempt.status).toBe(400);
    }
  });

  test("builds Kanban project swimlanes and main-task-only subtask rollup stats", () => {
    const projects = [
      { id: "p1", name: "Project One" },
      { id: "p2", name: "Project Two" },
    ];
    const tasks = [
      { id: "m1", projectId: "p1", parentId: null, status: "Ongoing" },
      { id: "s1", projectId: "p1", parentId: "m1", status: "Completed" },
      { id: "s2", projectId: "p1", parentId: "m1", status: "Not Started" },
      { id: "m2", projectId: "p2", parentId: null, status: "Completed" },
    ];

    const stats = computeSubtaskStatsByParent(tasks);
    expect(stats.get("m1")).toEqual({ total: 2, completed: 1 });
    expect(stats.get("m2")).toBeUndefined();

    const mainOnlyLanes = buildKanbanProjectLanes(projects, tasks, { mainTasksOnly: true });
    expect(mainOnlyLanes.map((l) => `${l.projectKey}:${l.tasks.map((t) => t.id).join(",")}`)).toEqual([
      "p1:m1",
      "p2:m2",
    ]);

    const allTaskLanes = buildKanbanProjectLanes(projects, tasks, { mainTasksOnly: false });
    expect(allTaskLanes[0].tasks.map((t) => t.id)).toEqual(["m1", "s1", "s2"]);
  });
});
