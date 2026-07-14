import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const appUser = await prisma.user.upsert({
    where: { phoneNumber: '+15550000001' },
    update: {
      isAppUser: true,
      name: 'Seed Admin',
      passwordHash: await bcrypt.hash('Password123!', 12),
    },
    create: {
      phoneNumber: '+15550000001',
      name: 'Seed Admin',
      isAppUser: true,
      passwordHash: await bcrypt.hash('Password123!', 12),
    },
  });

  const smsUser = await prisma.user.upsert({
    where: { phoneNumber: '+15550000002' },
    update: {
      isAppUser: false,
      name: 'Seed SMS User',
    },
    create: {
      phoneNumber: '+15550000002',
      name: 'Seed SMS User',
      isAppUser: false,
    },
  });

  const group = await prisma.group.upsert({
    where: { id: 'seed-group-core' },
    update: {
      name: 'Seed Core Group',
      description: 'Fixture group for local/dev smoke testing.',
      twilioNumber: process.env.TWILIO_DEFAULT_PHONE_NUMBER || '+18005551234',
    },
    create: {
      id: 'seed-group-core',
      name: 'Seed Core Group',
      description: 'Fixture group for local/dev smoke testing.',
      twilioNumber: process.env.TWILIO_DEFAULT_PHONE_NUMBER || '+18005551234',
    },
  });

  await prisma.groupMember.upsert({
    where: {
      groupId_userId: {
        groupId: group.id,
        userId: appUser.id,
      },
    },
    update: {
      participantType: 'APP_USER',
    },
    create: {
      groupId: group.id,
      userId: appUser.id,
      participantType: 'APP_USER',
    },
  });

  await prisma.groupMember.upsert({
    where: {
      groupId_userId: {
        groupId: group.id,
        userId: smsUser.id,
      },
    },
    update: {
      participantType: 'SMS_USER',
    },
    create: {
      groupId: group.id,
      userId: smsUser.id,
      participantType: 'SMS_USER',
    },
  });

  console.log('Seed complete:', {
    appUserId: appUser.id,
    smsUserId: smsUser.id,
    groupId: group.id,
    twilioNumber: group.twilioNumber,
  });
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
