require('dotenv/config');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL || 'admin@local.com';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD || 'Admin1234';

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name: 'Super Admin', role: 'SUPER_ADMIN', isActive: true },
  });
  console.log(`Seeded super admin: ${email} / ${password}`);

  const areaDefs = [
    { name: 'North District', code: 'AREA-001' },
    { name: 'East District', code: 'AREA-002' },
    { name: 'South District', code: 'AREA-003' },
    { name: 'West District', code: 'AREA-004' },
  ];
  const areas = {};
  for (const def of areaDefs) {
    const area = await prisma.area.upsert({
      where: { code: def.code },
      update: {},
      create: def,
    });
    areas[area.name] = area;
    console.log(`Seeded area: ${area.name} (${area.code})`);
  }

  const testWorkerDefs = [
    { email: 'test1@gmail.com', name: 'Test Worker One', areaName: 'North District' },
    { email: 'test2@gmail.com', name: 'Test Worker Two', areaName: 'South District' },
  ];
  const testWorkerPassword = 'Pass1234';
  const testWorkerPasswordHash = await bcrypt.hash(testWorkerPassword, 12);

  const seededWorkers = [];
  for (const def of testWorkerDefs) {
    const worker = await prisma.user.upsert({
      where: { email: def.email },
      update: {},
      create: {
        email: def.email,
        passwordHash: testWorkerPasswordHash,
        name: def.name,
        role: 'FIELD_WORKER',
        areaId: areas[def.areaName].id,
        isActive: true,
      },
    });
    seededWorkers.push(worker);
    console.log(`Seeded field worker: ${def.email} / ${testWorkerPassword} (${def.areaName})`);
  }

  const household = await prisma.household.upsert({
    where: { householdCode: 'HH-0001' },
    update: {},
    create: {
      householdCode: 'HH-0001',
      address: '12 Sample Street, North District',
      areaId: areas['North District'].id,
      registeredById: seededWorkers[0].id,
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
      recordedById: seededWorkers[0].id,
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