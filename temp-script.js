const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const rooms = await prisma.room.findMany({
    select: { id: true, title: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(rooms, null, 2));
  await prisma.();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
