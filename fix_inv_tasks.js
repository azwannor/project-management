const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixTasks() {
  const inventoryId = "15bd07a1-6704-405e-9922-c4025d8b743f"; // Inventory Management
  
  const tasksToFix = [
    "2f6f2a00-5859-4832-a309-369c501efc58", // Existing Process Analysis
    "20785cb0-f570-4eae-ba19-855c4985b1c5", // Business Rule Documentation
    "9f09de75-7caa-43cd-9a12-c74edf49e72f", // Requirement & Analyst
    "d0aebfaa-e806-4294-ba19-735b253b9417", // Master Table Design
    "bd39ef03-f217-401e-9aa0-fc3be1d2d496"  // System Design
  ];

  await prisma.task.updateMany({
    where: { id: { in: tasksToFix } },
    data: { parentId: inventoryId }
  });
  
  console.log("Tasks restored under Inventory Management");
}

fixTasks().finally(() => prisma.$disconnect());
