require('dotenv/config');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL || 'admin@healthsurvey.local';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD || 'ChangeMe123!';

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name: 'Super Admin', role: 'SUPER_ADMIN', isActive: true },
  });
  console.log(`Seeded super admin: ${email} / ${password}`);

  const area = await prisma.area.upsert({
    where: { code: 'AREA-001' },
    update: {},
    create: { name: 'North District', code: 'AREA-001' },
  });
  console.log(`Seeded area: ${area.name} (${area.code})`);

  const fieldWorkerEmail = 'fieldworker1@healthsurvey.local';
  const fieldWorkerPassword = 'FieldWorker123!';
  const fieldWorker = await prisma.user.upsert({
    where: { email: fieldWorkerEmail },
    update: {},
    create: {
      email: fieldWorkerEmail,
      passwordHash: await bcrypt.hash(fieldWorkerPassword, 12),
      name: 'Sample Field Worker',
      role: 'FIELD_WORKER',
      areaId: area.id,
      isActive: true,
    },
  });
  console.log(`Seeded field worker: ${fieldWorkerEmail} / ${fieldWorkerPassword}`);

  const household = await prisma.household.upsert({
    where: { householdCode: 'HH-0001' },
    update: {},
    create: {
      householdCode: 'HH-0001',
      address: '12 Sample Street, North District',
      areaId: area.id,
      registeredById: fieldWorker.id,
    },
  });

  const member = await prisma.householdMember.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      householdId: household.id,
      name: 'Sample Member',
      age: 34,
      gender: 'FEMALE',
      relationship: 'HEAD',
    },
  });

  await prisma.healthAssessment.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      memberId: member.id,
      temperatureC: 37.1,
      hasFever: false,
      hasCough: false,
      hasBreathingDifficulty: false,
      notes: 'Sample baseline assessment',
      recordedById: fieldWorker.id,
    },
  });

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
