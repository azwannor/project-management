const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const updates = [
    { name: "Dwi Ramdhan", areas: ["JATENG 1", "JATENG 2", "JATENG 3", "KALBAR", "KALTIM", "KALSELTENG", "DENPASAR", "JAKARTA 1", "JAKARTA 4", "JAKARTA 5", "JAKARTA 6", "JAKARTA 7", "KAM PROJECT"] },
    { name: "Kevin", areas: ["MEDAN & ACEH RAYA", "TANGERANG", "SURABAYA 1", "SURABAYA 2", "MALANG"] },
    { name: "Jahtra", areas: ["SULAWESI 1", "SULAWESI 2", "SULAWESI 3"] },
    { name: "Ruslan", areas: ["SULAWESI 1", "SULAWESI 2", "SULAWESI 3"] },
    { name: "Angel", areas: ["JAKARTA 2", "JAKARTA 3", "JAWA BARAT 1", "JAWA BARAT 2", "SUMBANGSEL 1", "SUMBANGSEL 2"] }
  ];

  for (const update of updates) {
    const user = await prisma.user.findFirst({
      where: { name: { contains: update.name, mode: 'insensitive' } }
    });
    
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { handledAreas: update.areas }
      });
      console.log(`Updated ${user.name}`);
    } else {
      console.log(`User not found: ${update.name}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
