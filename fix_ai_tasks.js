const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAITasks() {
  const inventoryTask = await prisma.task.findFirst({
    where: { title: { contains: "Inventory Management" } }
  });
  
  const incentiveTask = await prisma.task.findFirst({
    where: { title: { contains: "Incentive" } }
  });

  if (inventoryTask) {
    console.log(`Setting Inventory Management (${inventoryTask.id}) as root task.`);
    await prisma.task.update({
      where: { id: inventoryTask.id },
      data: { parentId: null }
    });
  }

  if (incentiveTask) {
    console.log(`Setting Incentive Module (${incentiveTask.id}) as root task.`);
    await prisma.task.update({
      where: { id: incentiveTask.id },
      data: { parentId: null }
    });
  }
}

fixAITasks().finally(() => prisma.$disconnect());
