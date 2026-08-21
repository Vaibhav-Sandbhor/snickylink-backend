import { PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding mission templates...');

  const missionTemplates = [
    { type: 'daily' as const, title: 'Guess Me', detail: 'Get one answer right about each other', xpReward: 80, verification: 'self_report' as const },
    { type: 'daily' as const, title: 'Tiny Victory', detail: 'Celebrate a win from this week', xpReward: 60, verification: 'self_report' as const },
    { type: 'daily' as const, title: 'Secret Effort', detail: 'Leave a thoughtful surprise', xpReward: 90, verification: 'partner_confirm' as const },
    { type: 'weekly' as const, title: 'Mind Match', detail: 'See where your thoughts meet', xpReward: 180, verification: 'self_report' as const },
    { type: 'deep' as const, title: 'Deep Talk', detail: 'A question worth staying up for', xpReward: 260, verification: 'self_report' as const },
    { type: 'monthly' as const, title: 'Team Us', detail: 'Complete a real-life mission together', xpReward: 500, verification: 'location_checkin' as const },
    { type: 'location' as const, title: 'New Spot', detail: 'Visit somewhere neither of you has been', xpReward: 150, verification: 'location_checkin' as const },
    { type: 'emotional' as const, title: 'Say It Straight', detail: 'Share a feeling you have been holding back', xpReward: 200, verification: 'partner_confirm' as const },
  ];

  for (const template of missionTemplates) {
    const existing = await prisma.missionTemplate.findFirst({ where: { title: template.title } });
    if (!existing) {
      await prisma.missionTemplate.create({ data: { id: uuid(), ...template } });
    }
  }

  console.log('Seeding demo couple...');
  const demoEmail1 = 'luna@demo.snickylink.app';
  const demoEmail2 = 'atlas@demo.snickylink.app';
  const passwordHash = await bcrypt.hash('password123', 12);

  let userOne = await prisma.user.findUnique({ where: { email: demoEmail1 } });
  if (!userOne) {
    userOne = await prisma.user.create({
      data: { id: uuid(), email: demoEmail1, passwordHash, displayName: 'Luna', avatarInitials: 'LU', city: 'Mumbai', country: 'India' },
    });
  }

  let userTwo = await prisma.user.findUnique({ where: { email: demoEmail2 } });
  if (!userTwo) {
    userTwo = await prisma.user.create({
      data: { id: uuid(), email: demoEmail2, passwordHash, displayName: 'Atlas', avatarInitials: 'AT', city: 'Mumbai', country: 'India' },
    });
  }

  let couple = await prisma.couple.findFirst({ where: { userOneId: userOne.id } });
  if (!couple) {
    couple = await prisma.couple.create({
      data: {
        id: uuid(),
        coupleName: 'Luna & Atlas',
        inviteCode: 'SNICK-DEMO1',
        userOneId: userOne.id,
        userTwoId: userTwo.id,
        city: 'Mumbai',
        country: 'India',
        xp: 2840,
        level: 14,
        streak: 12,
        lastActiveDate: new Date(),
      },
    });
  }

  console.log('Seeding demo community posts...');
  const posts = [
    { tag: 'Couple Wins', title: 'We finally learned how to disagree without turning it into a whole thing.', body: 'It sounds small, but pausing for ten minutes and coming back softer has completely changed our evenings.' },
    { tag: 'Advice', title: 'What is a green flag you did not recognize at first?', body: 'Mine was someone who asks for space clearly instead of disappearing.', isAnonymous: true },
    { tag: 'Stories', title: 'The five-minute tradition that saved our busy weeks.', body: 'Every Sunday we each share one high, one low, and one thing we are looking forward to.' },
  ];

  for (const post of posts) {
    const existing = await prisma.post.findFirst({ where: { title: post.title } });
    if (!existing) {
      await prisma.post.create({ data: { id: uuid(), authorId: userOne.id, coupleId: couple.id, ...post } });
    }
  }

  console.log('Seed complete. Demo login: luna@demo.snickylink.app / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
