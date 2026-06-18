const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Buat User Admin
  const admin = await prisma.user.create({
    data: {
      name: 'Budi Santoso',
      jobDesk: 'IT Manager',
      role: 'Admin',
    },
  });

  // Buat User Staff
  const staff1 = await prisma.user.create({
    data: {
      name: 'Andi Pratama',
      jobDesk: 'IT Support',
      role: 'Staff',
    },
  });

  // Buat Project
  const project1 = await prisma.project.create({
    data: {
      name: 'Migrasi Server Cloud',
      description: 'Memindahkan on-premise server ke AWS Cloud.',
      startDate: new Date('2026-06-01T00:00:00Z'),
      endDate: new Date('2026-07-01T00:00:00Z'),
      status: 'Ongoing',
    },
  });

  // Buat Task 1
  await prisma.task.create({
    data: {
      title: 'Setup AWS VPC',
      projectId: project1.id,
      userId: admin.id,
      startDate: new Date('2026-06-01T00:00:00Z'),
      endDate: new Date('2026-06-05T00:00:00Z'),
      priority: 'Butuh Cepat',
      status: 'Completed',
    },
  });

  // Buat Task 2
  await prisma.task.create({
    data: {
      title: 'Konfigurasi EC2 Instance',
      projectId: project1.id,
      userId: staff1.id,
      startDate: new Date('2026-06-06T00:00:00Z'),
      endDate: new Date('2026-06-10T00:00:00Z'),
      priority: 'Normal',
      status: 'Ongoing',
    },
  });

  // Buat Task 3 (Support Ticket / Non-project)
  await prisma.task.create({
    data: {
      title: 'Perbaikan Jaringan Lantai 3',
      projectId: project1.id, // Untuk MVP, kita bind ke project default sementara jika wajib
      userId: staff1.id,
      startDate: new Date('2026-06-15T08:00:00Z'),
      endDate: new Date('2026-06-15T12:00:00Z'),
      priority: 'Butuh Cepat',
      status: 'Not Started',
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
