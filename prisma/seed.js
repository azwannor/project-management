const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  if (count === 0) {
    const passwordHash = await bcrypt.hash('password123', 10);
    
    await prisma.user.createMany({ data: [
      { name: 'Admin Utama', email: 'admin@it-tracker.com', password: passwordHash, jobDesk: 'Administrator', role: 'Admin' },
      { name: 'Budi Santoso', email: 'budi@it-tracker.com', password: passwordHash, jobDesk: 'Frontend Dev', role: 'Staff' }, 
      { name: 'Andi Pratama', email: 'andi@it-tracker.com', password: passwordHash, jobDesk: 'Backend Dev', role: 'Staff' }, 
      { name: 'Citra Kirana', email: 'citra@it-tracker.com', password: passwordHash, jobDesk: 'UI/UX Designer', role: 'Staff' }, 
      { name: 'Dina Lestari', email: 'dina@it-tracker.com', password: passwordHash, jobDesk: 'QA Engineer', role: 'Staff' }
    ]});
    console.log('Users seeded with emails and passwords.'); 
  } else { 
    console.log('Users already exist, skipping seed.'); 
  } 
} 
main().catch(console.error).finally(() => prisma.$disconnect());
