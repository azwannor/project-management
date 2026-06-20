const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixCycle() {
  const taskId = "15bd07a1-6704-405e-9922-c4025d8b743f"; // Inventory Management
  
  await prisma.task.update({
    where: { id: taskId },
    data: { parentId: null }
  });
  
  console.log("Fixed circular dependency! Set Inventory Management to root.");
}

fixCycle().finally(() => prisma.$disconnect());
