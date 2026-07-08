const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLogic() {
  const id = 'cb1744e5-337e-468f-b3b8-34b4dc7e668d';
  const body = { executor: "Kevin Owen, Rafael Cavin" }; // testing changing executor

  const updateData = {};
  if (body.executor !== undefined) updateData.executor = body.executor || null;

  try {
    const existingTask = await prisma.task.findUnique({ where: { id } });

    console.log("Before update:", existingTask.executor);

    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateData,
      include: { project: true }
    });
    
    console.log("After update:", updatedTask.executor);

    // Run the exact logic from route.ts
    if (body.executor !== undefined && existingTask && existingTask.executor !== body.executor) {
      if (body.executor) {
        const executors = body.executor.split(",").map((e) => e.trim()).filter(Boolean);
        const existingExecutors = existingTask.executor ? existingTask.executor.split(",").map((e) => e.trim()) : [];
        
        console.log("New Executors:", executors);
        console.log("Existing Executors:", existingExecutors);
        
        for (const executorName of executors) {
          if (!existingExecutors.includes(executorName)) {
            console.log(`Finding user for newly added executor: ${executorName}`);
            const executorUser = await prisma.user.findFirst({
              where: { name: executorName }
            });
            
            if (executorUser) {
              console.log(`Found user: ${executorUser.id}. Simulating notification create...`);
              // ... simulates prisma.notification.create
            } else {
              console.log(`User ${executorName} NOT found!`);
            }
          }
        }
      }
    }
    
    console.log("Success");
  } catch (error) {
    console.error("Error occurred:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogic();
