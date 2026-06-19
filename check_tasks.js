const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTasks() {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Last 5 tasks:");
  tasks.forEach(t => console.log(`- ${t.title} (executor: ${t.executor})`));
}

checkTasks().catch(console.error).finally(() => prisma.$disconnect());
