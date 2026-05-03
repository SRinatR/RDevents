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

async function seedReferenceData() {
  await prisma.referenceCountry.createMany({
    data: [
      { code: 'UZ', nameRu: 'Узбекистан', nameEn: 'Uzbekistan' },
      { code: 'RU', nameRu: 'Россия', nameEn: 'Russia' },
      { code: 'KZ', nameRu: 'Казахстан', nameEn: 'Kazakhstan' },
      { code: 'KG', nameRu: 'Кыргызстан', nameEn: 'Kyrgyzstan' },
      { code: 'TJ', nameRu: 'Таджикистан', nameEn: 'Tajikistan' },
      { code: 'TM', nameRu: 'Туркменистан', nameEn: 'Turkmenistan' },
      { code: 'BY', nameRu: 'Беларусь', nameEn: 'Belarus' },
      { code: 'OTHER', nameRu: 'Другая страна', nameEn: 'Other country' },
    ],
    skipDuplicates: true,
  });

  await prisma.referenceUzRegion.createMany({
    data: [
      { id: 'reg_tashkent_city', code: 'TASHKENT_CITY', nameRu: 'г. Ташкент', nameEn: 'Tashkent city', sortOrder: 10 },
      { id: 'reg_tashkent_region', code: 'TASHKENT_REGION', nameRu: 'Ташкентская область', nameEn: 'Tashkent region', sortOrder: 20 },
      { id: 'reg_samarkand', code: 'SAMARKAND', nameRu: 'Самаркандская область', nameEn: 'Samarkand region', sortOrder: 30 },
    ],
    skipDuplicates: true,
  });

  await prisma.referenceUzDistrict.createMany({
    data: [
      { id: 'dist_yunusabad', regionId: 'reg_tashkent_city', code: 'YUNUSABAD', nameRu: 'Юнусабадский район', nameEn: 'Yunusabad district', sortOrder: 10 },
      { id: 'dist_mirzo_ulugbek', regionId: 'reg_tashkent_city', code: 'MIRZO_ULUGBEK', nameRu: 'Мирзо-Улугбекский район', nameEn: 'Mirzo Ulugbek district', sortOrder: 20 },
      { id: 'dist_chilanzar', regionId: 'reg_tashkent_city', code: 'CHILANZAR', nameRu: 'Чиланзарский район', nameEn: 'Chilanzar district', sortOrder: 30 },
      { id: 'dist_samarkand_city', regionId: 'reg_samarkand', code: 'SAMARKAND_CITY', nameRu: 'г. Самарканд', nameEn: 'Samarkand city', sortOrder: 10 },
    ],
    skipDuplicates: true,
  });

  await prisma.referenceUzSettlement.createMany({
    data: [
      { id: 'set_yunusabad_1', districtId: 'dist_yunusabad', code: 'YUNUSABAD_1', nameRu: 'Юнусабад', nameEn: 'Yunusabad', type: 'city_area', sortOrder: 10 },
      { id: 'set_mirzo_ulugbek_1', districtId: 'dist_mirzo_ulugbek', code: 'MIRZO_ULUGBEK_1', nameRu: 'Мирзо-Улугбек', nameEn: 'Mirzo Ulugbek', type: 'city_area', sortOrder: 10 },
      { id: 'set_chilanzar_1', districtId: 'dist_chilanzar', code: 'CHILANZAR_1', nameRu: 'Чиланзар', nameEn: 'Chilanzar', type: 'city_area', sortOrder: 10 },
      { id: 'set_samarkand_city_1', districtId: 'dist_samarkand_city', code: 'SAMARKAND_CITY_1', nameRu: 'Самарканд', nameEn: 'Samarkand', type: 'city', sortOrder: 10 },
    ],
    skipDuplicates: true,
  });
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run development seed in production.');
  }

  console.log('Seeding database...');

  await prisma.analyticsEvent.deleteMany();
  await prisma.eventTeamMember.deleteMany();
  await prisma.eventTeam.deleteMany();
  await prisma.eventMember.deleteMany();
  await prisma.event.deleteMany();
  await prisma.userAccount.deleteMany();
  await prisma.user.deleteMany();
  await seedReferenceData();

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

  await createUser({
    email: 'incomplete@example.com',
    password: 'incomplete123',
    name: 'Incomplete Profile',
    bio: 'Missing phone, city, telegram, and birth date for registration requirement tests.',
  });

  await createUser({
    email: 'teamjoiner@example.com',
    password: 'teamjoiner123',
    name: 'Team Joiner',
    city: 'Tashkent',
    phone: '+998 90 000 10 11',
    telegram: '@team_joiner',
    birthDate: new Date('2001-01-11T00:00:00Z'),
    bio: 'Demo account for team join request flows.',
  });

  await createUser({
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
      fullDescription: `Квест создаётся как живое путешествие по русской культуре. Участники получают «Паспорт гостя Русского дома» и проходят шесть культурных пространств. Каждая станция раскрывает отдельную грань общей идеи — дом как место языка, традиций, музыки, творчества, общения и характера.`,
      category: 'Community',
      location: 'Центральный Парк имени Мирзо Улугбека',
      coverImageUrl: '/dom-gde-zhivet-rossiya.jpg',
      capacity: 60,
      startsAt: new Date('2026-05-03T07:30:00Z'),
      endsAt: new Date('2026-05-03T12:30:00Z'),
      registrationDeadline: new Date('2026-05-01T18:00:00Z'),
      registrationEnabled: true,
      volunteerApplicationsEnabled: true,
      minTeamSize: 5,
      maxTeamSize: 5,
      allowSoloParticipation: false,
      isTeamBased: true,
      requireParticipantApproval: false,
      requireAdminApprovalForTeams: true,
      teamJoinMode: 'EMAIL_INVITE',
      requiredProfileFields: [
        'lastNameCyrillic',
        'firstNameCyrillic',
        'middleNameCyrillic',
        'lastNameLatin',
        'firstNameLatin',
        'middleNameLatin',
        'birthDate',
        'phone',
        'telegram',
        'regionId',
        'districtId',
        'settlementId',
        'gender',
      ],
      tags: ['квест', 'культура', 'русский-дом'],
      contactEmail: 'Uzb@vsezapobedu.com',
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
