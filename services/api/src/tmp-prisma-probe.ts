import { prisma } from './db/prisma.js';

const email = `media-probe-${Date.now()}@example.com`;

try {
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Probe',
      passwordHash: 'x',
      emailVerifiedAt: new Date(),
    },
  });
  console.log(JSON.stringify({ ok: true, id: user.id }));
  await prisma.user.delete({ where: { id: user.id } });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
