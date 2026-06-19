const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const email = 'ruddinb121@royalmedicalink.id';
  const hashedPassword = await bcrypt.hash('password', 10);
  
  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashedPassword },
    create: {
      email,
      password: hashedPassword,
      name: 'Ruddin',
      role: 'ADMIN',
      jobDesk: 'IT Support'
    }
  });
  console.log(`User created/updated: ${user.email} with password: password`);

  const angelEmail = 'angel.lieta@royalmedicalink.id';
  const angel = await prisma.user.upsert({
    where: { email: angelEmail },
    update: { password: hashedPassword },
    create: {
      email: angelEmail,
      password: hashedPassword,
      name: 'Angel Lieta',
      role: 'ADMIN',
      jobDesk: 'IT Support'
    }
  });
  console.log(`User created/updated: ${angel.email} with password: password`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
