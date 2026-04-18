/// <reference types="node" />
import { AuthProvider, EventStatus, PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import pg from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL?.replace('localhost', '127.0.0.1');
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const passwordOptions: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

async function createUser(input: {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  city?: string;
  phone?: string;
  telegram?: string;
  birthDate?: Date;
  bio?: string;
  avatarUrl?: string;
  isActive?: boolean;
}) {
  const passwordHash = await argon2.hash(input.password, passwordOptions);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      firstNameLatin: input.name,
      fullNameLatin: input.name,
      fullNameCyrillic: input.name,
      passwordHash,
      role: input.role ?? UserRole.USER,
      city: input.city,
      phone: input.phone,
      telegram: input.telegram,
      birthDate: input.birthDate,
      bio: input.bio,
      avatarUrl: input.avatarUrl,
      isActive: input.isActive ?? true,
      registeredAt: new Date(),
    },
  });

  await prisma.userAccount.create({
    data: {
      userId: user.id,
      provider: AuthProvider.EMAIL,
      providerAccountId: input.email,
      providerEmail: input.email,
    },
  });

  return user;
}

async function main() {
  console.log('Seeding database...');

  await prisma.analyticsEvent.deleteMany();
  await prisma.eventTeamMember.deleteMany();
  await prisma.eventTeam.deleteMany();
  await prisma.eventMember.deleteMany();
  await prisma.event.deleteMany();
  await prisma.userAccount.deleteMany();
  await prisma.user.deleteMany();

  const superAdmin = await createUser({
    email: 'admin@example.com',
    password: 'admin123',
    name: 'Super Admin',
    role: UserRole.SUPER_ADMIN,
    city: 'Tashkent',
    phone: '+998 90 000 10 01',
    telegram: '@super_admin',
    birthDate: new Date('1989-04-10T00:00:00Z'),
    bio: 'Platform owner with global access.',
  });

  const platformAdmin = await createUser({
    email: 'platform@example.com',
    password: 'platform123',
    name: 'Platform Manager',
    role: UserRole.PLATFORM_ADMIN,
    city: 'Tashkent',
    phone: '+998 90 000 10 02',
    telegram: '@platform_manager',
    birthDate: new Date('1991-02-18T00:00:00Z'),
    bio: 'Platform admin who helps manage events and analytics.',
  });

  const eventAdmin = await createUser({
    email: 'organizer@example.com',
    password: 'organizer123',
    name: 'Event Organizer',
    city: 'Samarkand',
    phone: '+998 90 000 10 03',
    telegram: '@event_organizer',
    birthDate: new Date('1992-09-05T00:00:00Z'),
    bio: 'User with admin rights for specific events only.',
  });

  const participant = await createUser({
    email: 'user@example.com',
    password: 'user123',
    name: 'John Participant',
    city: 'Tashkent',
    phone: '+998 90 000 10 04',
    telegram: '@john_participant',
    birthDate: new Date('1998-01-20T00:00:00Z'),
    bio: 'Regular participant account for demo flow.',
  });

  const volunteer = await createUser({
    email: 'volunteer@example.com',
    password: 'volunteer123',
    name: 'Jane Volunteer',
    city: 'Bukhara',
    phone: '+998 90 000 10 05',
    telegram: '@jane_volunteer',
    birthDate: new Date('1997-07-14T00:00:00Z'),
    bio: 'Regular user who applies to volunteer for specific events.',
  });

  const secondEventAdmin = await createUser({
    email: 'manager@example.com',
    password: 'manager123',
    name: 'Regional Manager',
    city: 'Andijan',
    phone: '+998 90 000 10 07',
    telegram: '@regional_manager',
    birthDate: new Date('1990-12-12T00:00:00Z'),
    bio: 'Event admin assigned to regional and team-review events.',
  });

  const pendingParticipant = await createUser({
    email: 'pending@example.com',
    password: 'pending123',
    name: 'Pending Participant',
    city: 'Tashkent',
    phone: '+998 90 000 10 08',
    telegram: '@pending_participant',
    birthDate: new Date('2000-03-21T00:00:00Z'),
    bio: 'Demo account with pending event and volunteer applications.',
  });

  const reserveParticipant = await createUser({
    email: 'reserve@example.com',
    password: 'reserve123',
    name: 'Reserve Participant',
    city: 'Fergana',
    phone: '+998 90 000 10 09',
    telegram: '@reserve_participant',
    birthDate: new Date('1999-08-16T00:00:00Z'),
    bio: 'Demo account for reserve and waitlist states.',
  });

  const rejectedParticipant = await createUser({
    email: 'rejected@example.com',
    password: 'rejected123',
    name: 'Rejected Participant',
    city: 'Namangan',
    phone: '+998 90 000 10 10',
    telegram: '@rejected_participant',
    birthDate: new Date('1995-05-09T00:00:00Z'),
    bio: 'Demo account for rejected application states.',
  });

  const incompleteUser = await createUser({
    email: 'incomplete@example.com',
    password: 'incomplete123',
    name: 'Incomplete Profile',
    bio: 'Missing phone, city, telegram, and birth date for registration requirement tests.',
  });

  const teamApplicant = await createUser({
    email: 'teamjoiner@example.com',
    password: 'teamjoiner123',
    name: 'Team Joiner',
    city: 'Tashkent',
    phone: '+998 90 000 10 11',
    telegram: '@team_joiner',
    birthDate: new Date('2001-01-11T00:00:00Z'),
    bio: 'Demo account for team join request flows.',
  });

  const inactiveUser = await createUser({
    email: 'disabled@example.com',
    password: 'disabled123',
    name: 'Disabled Account',
    city: 'Tashkent',
    phone: '+998 90 000 10 12',
    telegram: '@disabled_account',
    birthDate: new Date('1993-10-03T00:00:00Z'),
    bio: 'Inactive user account for auth rejection checks.',
    isActive: false,
  });

  const socialUser = await prisma.user.create({
    data: {
      email: 'social@example.com',
      name: 'Social Demo User',
      firstNameLatin: 'Social Demo User',
      fullNameLatin: 'Social Demo User',
      fullNameCyrillic: 'Social Demo User',
      role: UserRole.USER,
      isActive: true,
      city: 'Nukus',
      phone: '+998 90 000 10 06',
      telegram: '@social_demo',
      birthDate: new Date('1996-11-03T00:00:00Z'),
      avatarUrl: 'https://i.pravatar.cc/160?img=47',
      registeredAt: new Date(),
    },
  });

  await prisma.userAccount.create({
    data: {
      userId: socialUser.id,
      provider: AuthProvider.GOOGLE,
      providerAccountId: 'google-demo-social',
      providerEmail: 'social@example.com',
      providerUsername: 'Social Demo User',
      providerAvatarUrl: 'https://i.pravatar.cc/160?img=47',
      linkedAt: new Date(),
      lastUsedAt: new Date(),
    },
  });

  await prisma.userAccount.createMany({
    data: [
      {
        userId: socialUser.id,
        provider: AuthProvider.YANDEX,
        providerAccountId: 'yandex-demo-social',
        providerEmail: 'social@example.com',
        providerUsername: 'Social Demo User',
        providerAvatarUrl: 'https://i.pravatar.cc/160?img=47',
        linkedAt: new Date(),
      },
      {
        userId: socialUser.id,
        provider: AuthProvider.TELEGRAM,
        providerAccountId: 'telegram-demo-social',
        providerUsername: 'social_demo',
        providerAvatarUrl: 'https://i.pravatar.cc/160?img=47',
        linkedAt: new Date(),
      },
    ],
  });

  const singleEvent = await prisma.event.create({
    data: {
      slug: 'dom-gde-zhivet-rossiya',
      title: 'Дом, где живёт Россия',
      shortDescription: 'Культурный квест по шести пространствам Русского дома с финальным маршрутом и праздничным награждением.',
      fullDescription: `Квест создаётся как живое путешествие по русской культуре. Участники получают «Паспорт гостя Русского дома» и проходят шесть культурных пространств. Каждая станция раскрывает отдельную грань общей идеи — дом как место языка, традиций, музыки, творчества, общения и характера.

После прохождения всех точек команда открывает финальную страницу маршрута, участвует в награждении и становится частью общего праздничного события к юбилею Русского дома.`,
      category: 'Community',
      location: 'Русский дом в Ташкенте, ул. Нукус, 83',
      coverImageUrl: '/dom-gde-zhivet-rossiya.jpg',
      capacity: 180,
      startsAt: new Date('2026-09-20T10:00:00Z'),
      endsAt: new Date('2026-09-20T15:00:00Z'),
      registrationDeadline: new Date('2026-09-18T18:00:00Z'),
      registrationEnabled: true,
      volunteerApplicationsEnabled: false,
      allowSoloParticipation: true,
      isTeamBased: true,
      tags: ['квест', 'культура', 'русский-дом'],
      contactEmail: 'platform@example.com',
      status: EventStatus.PUBLISHED,
      isFeatured: true,
      publishedAt: new Date(),
      createdById: superAdmin.id,
    },
  });

  await prisma.analyticsEvent.createMany({
    data: [
      { type: 'HOME_VIEW', userId: superAdmin.id, locale: 'en', path: '/en' },
      { type: 'HOME_VIEW', userId: participant.id, locale: 'ru', path: '/ru' },
      { type: 'EVENTS_LIST_VIEW', userId: participant.id, locale: 'en', path: '/en/events' },
      { type: 'EVENT_DETAIL_VIEW', userId: participant.id, eventId: singleEvent.id, locale: 'ru', path: '/ru/events/dom-gde-zhivet-rossiya' },
      { type: 'USER_REGISTER', userId: participant.id, authProvider: 'EMAIL' },
      { type: 'USER_REGISTER', userId: socialUser.id, authProvider: 'GOOGLE' },
      { type: 'USER_LOGIN', userId: superAdmin.id, authProvider: 'EMAIL' },
      { type: 'USER_LOGIN', userId: platformAdmin.id, authProvider: 'EMAIL' },
      { type: 'USER_LOGIN', userId: socialUser.id, authProvider: 'GOOGLE' },
      { type: 'USER_LOGIN', userId: socialUser.id, authProvider: 'YANDEX' },
      { type: 'PROVIDER_USED', userId: socialUser.id, authProvider: 'TELEGRAM' },
    ],
  });

  console.log('Created 1 event');
  console.log(`Seeded event: ${singleEvent.title} (${singleEvent.slug})`);
  console.log('');
  console.log('Demo credentials:');
  console.log('  Super admin:    admin@example.com / admin123');
  console.log('  Platform admin: platform@example.com / platform123');
  console.log('  Event admin:    organizer@example.com / organizer123');
  console.log('  Event manager:  manager@example.com / manager123');
  console.log('  User:           user@example.com / user123');
  console.log('  Volunteer:      volunteer@example.com / volunteer123');
  console.log('  Pending user:   pending@example.com / pending123');
  console.log('  Reserve user:   reserve@example.com / reserve123');
  console.log('  Rejected user:  rejected@example.com / rejected123');
  console.log('  Incomplete:     incomplete@example.com / incomplete123');
  console.log('  Team joiner:    teamjoiner@example.com / teamjoiner123');
  console.log('  Disabled:       disabled@example.com / disabled123');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
