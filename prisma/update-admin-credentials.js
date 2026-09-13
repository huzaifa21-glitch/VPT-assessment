
require('dotenv/config');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const NEW_EMAIL = 'admin@local.com';
const NEW_PASSWORD = 'Admin1234';

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!admin) {
    throw new Error('No SUPER_ADMIN user found — run `npm run seed` first to create one.');
  }

  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 12);
  await prisma.user.update({
    where: { id: admin.id },
    data: { email: NEW_EMAIL, passwordHash },
  });

  console.log(`Updated super admin credentials.`);
  console.log(`  email:    ${NEW_EMAIL}`);
  console.log(`  password: ${NEW_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
