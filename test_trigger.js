const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const users = await prisma.user.findMany();
  const tasks = await prisma.task.findMany();
  if (users.length === 0 || tasks.length === 0) {
    console.log("No users or tasks");
    return;
  }
  
  const user = users[users.length - 1]; // Pick a user
  const task = tasks[tasks.length - 1]; // Pick a task

  console.log(`Assigning task ${task.title} to user ${user.name}...`);
  
  // Fake the API trigger logic
  const body = { executor: user.name };
  const existingTask = await prisma.task.findUnique({ where: { id: task.id } });
  
  if (body.executor !== undefined && existingTask && existingTask.executor !== body.executor) {
    if (body.executor) {
      const executorUser = await prisma.user.findFirst({
        where: { name: body.executor }
      });
      console.log("executorUser found?", !!executorUser);
      if (executorUser) {
        const notif = await prisma.notification.create({
          data: {
            userId: executorUser.id,
            title: "Tugas Dialokasikan",
            message: `Anda ditugaskan pada task: "${task.title}"`,
            type: "ASSIGNMENT",
            link: "/"
          }
        });
        console.log("Notification created:", notif);
      }
    }
  } else {
    console.log("Trigger condition not met. existingTask.executor =", existingTask.executor, "body.executor =", body.executor);
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
