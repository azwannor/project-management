const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixCycles() {
  const tasks = await prisma.task.findMany();
  
  let fixedCount = 0;
  for (const task of tasks) {
    if (!task.parentId) continue;
    
    // Trace parent chain
    let currentId = task.parentId;
    const visited = new Set([task.id]);
    let hasCycle = false;
    
    while (currentId) {
      if (visited.has(currentId)) {
        hasCycle = true;
        break;
      }
      visited.add(currentId);
      const parentTask = tasks.find(t => t.id === currentId);
      currentId = parentTask ? parentTask.parentId : null;
    }
    
    if (hasCycle) {
      console.log(`Cycle detected for task ${task.title} (${task.id}). Breaking cycle by setting parentId to null.`);
      await prisma.task.update({
        where: { id: task.id },
        data: { parentId: null }
      });
      fixedCount++;
      // Update local array to prevent duplicate fixing logs
      task.parentId = null;
    }
  }
  
  console.log(`Fixed ${fixedCount} cycles.`);
}

fixCycles().finally(() => prisma.$disconnect());
