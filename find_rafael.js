const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRafael() {
  const tasks = await prisma.task.findMany({
    where: { executor: { contains: 'Rafael' } },
  });
  const tickets = await prisma.supportTicket.findMany({
    where: { executors: { some: { name: { contains: 'Rafael' } } } },
    include: { executors: true }
  });
  const maintenance = await prisma.maintenanceSchedule.findMany({
    where: { assignedExecutors: { some: { name: { contains: 'Rafael' } } } },
    include: { assignedExecutors: true }
  });
  
  console.log("Tasks:", tasks.length > 0 ? tasks.map(t => ({id: t.id, exec: t.executor})) : "None");
  console.log("Tickets:", tickets.length > 0 ? tickets.map(t => ({id: t.id, exec: t.executors.map(e => e.name).join(", ")})) : "None");
  console.log("Maintenance:", maintenance.length > 0 ? maintenance.map(t => ({id: t.id, exec: t.assignedExecutors.map(e => e.name).join(", ")})) : "None");
}

checkRafael().catch(console.error).finally(() => prisma.$disconnect());
