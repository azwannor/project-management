const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const reqTask = await prisma.task.findUnique({
    where: { id: '9f09de75-7caa-43cd-9a12-c74edf49e72f' },
    include: { parentTask: true }
  });
  console.log('Requirement Analyst:', reqTask.id);
  console.log('Parent of Req Analyst:', reqTask.parentId);

  const brdTask = await prisma.task.findUnique({
    where: { id: '20785cb0-f570-4eae-ba19-855c4985b1c5' },
    include: { parentTask: true }
  });
  console.log('BRD:', brdTask.id);
  console.log('Parent of BRD:', brdTask.parentId);
}

check().finally(() => prisma.$disconnect());
