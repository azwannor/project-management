const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTasks() {
  const allTasks = await prisma.task.findMany({
    where: {
      project: {
        name: "SISTEM AI"
      }
    },
    include: {
      parentTask: true,
      subTasks: true
    }
  });
  
  console.log(`Total tasks in SISTEM AI: ${allTasks.length}`);
  allTasks.forEach(t => {
    console.log(`ID: ${t.id} | Title: ${t.title} | ParentId: ${t.parentId} | IsRoot: ${t.parentId === null} | Status: ${t.status}`);
  });
}

checkTasks().finally(() => prisma.$disconnect());
