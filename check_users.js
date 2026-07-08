const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.task.findMany({
    where: { executor: { contains: 'Kevin' } },
    select: { id: true, title: true, executor: true }
  });
  
  const weirdExecutors = tasks.filter(t => t.executor.includes('Kevin') && !t.executor.includes('Kevin Owen'));
  console.log("Tasks with Kevin but NOT 'Kevin Owen':", weirdExecutors);
}

main().catch(console.error).finally(() => prisma.$disconnect());
