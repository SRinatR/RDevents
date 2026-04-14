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
}) {
  const passwordHash = await argon2.hash(input.password, passwordOptions);
  const user = await prisma.user.create({
    data: {
      email: input.email,
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
      isActive: true,
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

  const socialUser = await prisma.user.create({
    data: {
      email: 'social@example.com',
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

  const eventInputs = [
    {
      slug: 'tech-meetup-tashkent-2026',
      title: 'Tech Meetup Tashkent 2026',
      shortDescription: 'Talks, demos, and networking for local developers and product teams.',
      fullDescription: 'A practical meetup for developers, designers, and product builders. Expect short talks, live demos, and a friendly networking session after the program.',
      category: 'Tech',
      location: 'Tashkent IT Park',
      coverImageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=700&fit=crop',
      capacity: 150,
      startsAt: new Date('2026-05-15T18:00:00Z'),
      endsAt: new Date('2026-05-15T21:00:00Z'),
      registrationDeadline: new Date('2026-05-14T20:00:00Z'),
      requiredProfileFields: ['name', 'phone', 'city', 'telegram'],
      requiredEventFields: ['motivation', 'experience'],
      tags: ['tech', 'meetup', 'networking'],
      isFeatured: true,
    },
    {
      slug: 'community-cleanup-samarkand',
      title: 'Community Cleanup Day',
      shortDescription: 'A city cleanup morning with teams, supplies, and volunteer coordinators.',
      fullDescription: 'Join neighbors and local organizers for a morning of practical community work. Supplies are provided, and volunteers can apply to help coordinate groups.',
      category: 'Community',
      location: 'Registan Square, Samarkand',
      coverImageUrl: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=1200&h=700&fit=crop',
      capacity: 200,
      startsAt: new Date('2026-05-22T08:00:00Z'),
      endsAt: new Date('2026-05-22T13:00:00Z'),
      registrationDeadline: new Date('2026-05-21T18:00:00Z'),
      requiredProfileFields: ['name', 'phone', 'city'],
      requiredEventFields: ['preferredSlot'],
      tags: ['community', 'volunteer', 'environment'],
      isFeatured: true,
    },
    {
      slug: 'startup-weekend-tashkent',
      title: 'Startup Weekend Tashkent',
      shortDescription: 'A weekend sprint to pitch, build, and test startup ideas with mentors.',
      fullDescription: 'Pitch ideas, form teams, build prototypes, and present to a jury of founders and investors. Solo participants are welcome.',
      category: 'Business',
      location: 'InnoLab, Tashkent',
      coverImageUrl: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&h=700&fit=crop',
      capacity: 120,
      startsAt: new Date('2026-06-05T16:00:00Z'),
      endsAt: new Date('2026-06-07T18:00:00Z'),
      registrationDeadline: new Date('2026-06-04T12:00:00Z'),
      requiredProfileFields: ['name', 'phone', 'telegram'],
      requiredEventFields: ['motivation', 'teamPreference'],
      tags: ['startup', 'business', 'pitch'],
      isFeatured: true,
    },
    {
      slug: 'figma-design-workshop',
      title: 'Figma Design Workshop',
      shortDescription: 'Hands-on product design workshop for beginners and junior designers.',
      fullDescription: 'Learn Figma basics, product thinking, rapid wireframing, and simple usability testing in a small group format.',
      category: 'Design',
      location: 'Creative Hub, Tashkent',
      coverImageUrl: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200&h=700&fit=crop',
      capacity: 36,
      startsAt: new Date('2026-06-12T10:00:00Z'),
      endsAt: new Date('2026-06-12T15:00:00Z'),
      registrationDeadline: new Date('2026-06-11T18:00:00Z'),
      tags: ['design', 'figma', 'workshop'],
      isFeatured: false,
    },
    {
      slug: 'modern-art-opening',
      title: 'Modern Art Exhibition Opening',
      shortDescription: 'Opening night for a curated exhibition of emerging Central Asian artists.',
      fullDescription: 'A public opening event with artist talks, guided tours, and a small reception. Participants can register for a guaranteed entry slot.',
      category: 'Arts & Culture',
      location: 'Navruz Gallery, Bukhara',
      coverImageUrl: 'https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=1200&h=700&fit=crop',
      capacity: 80,
      startsAt: new Date('2026-06-18T18:00:00Z'),
      endsAt: new Date('2026-06-18T21:00:00Z'),
      registrationDeadline: new Date('2026-06-17T18:00:00Z'),
      tags: ['art', 'culture', 'gallery'],
      isFeatured: false,
    },
    {
      slug: 'three-on-three-basketball',
      title: '3x3 Basketball Tournament',
      shortDescription: 'Fast-paced community basketball tournament for mixed amateur teams.',
      fullDescription: 'Register as a participant, bring your team, and enjoy a friendly but energetic tournament day with local sports volunteers.',
      category: 'Sports',
      location: 'Dynamo Sports Complex, Tashkent',
      coverImageUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200&h=700&fit=crop',
      capacity: 64,
      startsAt: new Date('2026-06-20T09:00:00Z'),
      endsAt: new Date('2026-06-20T17:00:00Z'),
      registrationDeadline: new Date('2026-06-18T18:00:00Z'),
      requiredProfileFields: ['name', 'phone', 'city'],
      requiredEventFields: ['teamPreference'],
      tags: ['sports', 'basketball', 'community'],
      isFeatured: false,
      isTeamBased: true,
      minTeamSize: 3,
      maxTeamSize: 4,
      allowSoloParticipation: false,
      teamJoinMode: 'BY_CODE' as const,
    },
    {
      slug: 'ai-hackathon-2026',
      title: 'AI Hackathon 2026',
      shortDescription: 'Build next-generation AI tools with your team in 48 hours.',
      fullDescription: 'Join hundreds of developers, designers, and domain experts to build AI-driven prototypes. Teams can be up to 5 members. Mentors will be available, and the best prototype wins $10,000.',
      category: 'Tech',
      location: 'Inha University, Tashkent',
      coverImageUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=700&fit=crop',
      capacity: 300,
      startsAt: new Date('2026-07-15T09:00:00Z'),
      endsAt: new Date('2026-07-17T18:00:00Z'),
      registrationDeadline: new Date('2026-07-12T23:59:00Z'),
      requiredProfileFields: ['name', 'phone', 'telegram'],
      requiredEventFields: ['motivation', 'experience', 'teamPreference'],
      tags: ['ai', 'hackathon', 'competition'],
      isFeatured: true,
      status: EventStatus.PUBLISHED,
      isTeamBased: true,
      minTeamSize: 2,
      maxTeamSize: 5,
      allowSoloParticipation: false,
    },
  ];

  const events = [];
  for (const input of eventInputs) {
    const { registrationDeadline, status: inputStatus, ...rest } = input;
    const status = inputStatus ?? EventStatus.PUBLISHED;
    events.push(await prisma.event.create({
      data: {
        ...rest,
        registrationCloseAt: registrationDeadline,
        status,
        createdById: superAdmin.id,
        publishedAt: status === EventStatus.PUBLISHED ? new Date() : null,
      },
    }));
  }

  await prisma.eventMember.createMany({
    data: [
      {
        eventId: events[0].id,
        userId: eventAdmin.id,
        role: 'EVENT_ADMIN',
        status: 'ACTIVE',
        assignedByUserId: superAdmin.id,
        approvedAt: new Date(),
        notes: 'Primary event admin for the tech meetup.',
      },
      {
        eventId: events[0].id,
        userId: participant.id,
        role: 'PARTICIPANT',
        status: 'ACTIVE',
        assignedByUserId: participant.id,
        approvedAt: new Date(),
      },
      {
        eventId: events[1].id,
        userId: participant.id,
        role: 'PARTICIPANT',
        status: 'ACTIVE',
        assignedByUserId: participant.id,
        approvedAt: new Date(),
      },
      {
        eventId: events[2].id,
        userId: socialUser.id,
        role: 'PARTICIPANT',
        status: 'ACTIVE',
        assignedByUserId: socialUser.id,
        approvedAt: new Date(),
      },
      {
        eventId: events[0].id,
        userId: volunteer.id,
        role: 'VOLUNTEER',
        status: 'PENDING',
        assignedByUserId: volunteer.id,
        notes: 'Can help with registration desk and guest navigation.',
      },
      {
        eventId: events[1].id,
        userId: volunteer.id,
        role: 'VOLUNTEER',
        status: 'ACTIVE',
        assignedByUserId: platformAdmin.id,
        approvedAt: new Date(),
        notes: 'Approved for cleanup team coordination.',
      },
      {
        eventId: events[3].id,
        userId: eventAdmin.id,
        role: 'PARTICIPANT',
        status: 'ACTIVE',
        assignedByUserId: eventAdmin.id,
        approvedAt: new Date(),
      },
      {
        eventId: events[6].id,
        userId: eventAdmin.id,
        role: 'EVENT_ADMIN',
        status: 'ACTIVE',
        assignedByUserId: superAdmin.id,
        approvedAt: new Date(),
        notes: 'Team hackathon admin',
      },
      {
        eventId: events[6].id,
        userId: participant.id,
        role: 'PARTICIPANT',
        status: 'ACTIVE',
        assignedByUserId: participant.id,
        approvedAt: new Date(),
      },
      {
        eventId: events[6].id,
        userId: socialUser.id,
        role: 'PARTICIPANT',
        status: 'ACTIVE',
        assignedByUserId: socialUser.id,
        approvedAt: new Date(),
      },
      {
        eventId: events[5].id,
        userId: eventAdmin.id,
        role: 'PARTICIPANT',
        status: 'ACTIVE',
        assignedByUserId: eventAdmin.id,
        approvedAt: new Date(),
      },
      {
        eventId: events[5].id,
        userId: volunteer.id,
        role: 'PARTICIPANT',
        status: 'ACTIVE',
        assignedByUserId: volunteer.id,
        approvedAt: new Date(),
      },
    ],
  });

  await prisma.eventRegistrationFormSubmission.createMany({
    data: [
      {
        eventId: events[0].id,
        userId: participant.id,
        answersJson: {
          motivation: 'I want to meet local builders and share product engineering lessons.',
          experience: 'Three years in frontend and community meetups.',
        },
        isComplete: true,
      },
      {
        eventId: events[1].id,
        userId: participant.id,
        answersJson: {
          preferredSlot: 'Morning cleanup crew',
        },
        isComplete: true,
      },
      {
        eventId: events[2].id,
        userId: socialUser.id,
        answersJson: {
          motivation: 'I want to validate an early startup idea with mentors.',
          teamPreference: 'Open to joining a product-focused team.',
        },
        isComplete: true,
      },
      {
        eventId: events[5].id,
        userId: eventAdmin.id,
        answersJson: {
          teamPreference: 'Captain',
        },
        isComplete: true,
      },
      {
        eventId: events[5].id,
        userId: volunteer.id,
        answersJson: {
          teamPreference: 'Wing player',
        },
        isComplete: true,
      },
      {
        eventId: events[6].id,
        userId: participant.id,
        answersJson: {
          motivation: 'I want to build a useful AI assistant prototype.',
          experience: 'Full-stack developer with hackathon experience.',
          teamPreference: 'Captain',
        },
        isComplete: true,
      },
      {
        eventId: events[6].id,
        userId: socialUser.id,
        answersJson: {
          motivation: 'Interested in product design for AI workflows.',
          experience: 'Designer with two AI prototype projects.',
          teamPreference: 'Designer / researcher',
        },
        isComplete: true,
      },
    ],
  });

  // Create a team for AI Hackathon
  const hackathonId = events[6].id;
  const team1 = await prisma.eventTeam.create({
    data: {
      eventId: hackathonId,
      name: 'TechTitans',
      joinCode: 'T1T4N5',
      captainUserId: participant.id,
      status: 'ACTIVE',
      maxSize: 5,
    }
  });

  await prisma.eventTeamMember.createMany({
    data: [
      {
        teamId: team1.id,
        userId: participant.id,
        role: 'CAPTAIN',
        status: 'ACTIVE',
        approvedAt: new Date(),
      },
      {
        teamId: team1.id,
        userId: socialUser.id,
        role: 'MEMBER',
        status: 'ACTIVE',
        approvedAt: new Date(),
      }
    ]
  });

  const basketballTeam = await prisma.eventTeam.create({
    data: {
      eventId: events[5].id,
      name: 'Samarkand Shooters',
      joinCode: 'HOOPS3',
      captainUserId: eventAdmin.id,
      status: 'ACTIVE',
      maxSize: 4,
    }
  });

  await prisma.eventTeamMember.createMany({
    data: [
      {
        teamId: basketballTeam.id,
        userId: eventAdmin.id,
        role: 'CAPTAIN',
        status: 'ACTIVE',
        approvedAt: new Date(),
      },
      {
        teamId: basketballTeam.id,
        userId: volunteer.id,
        role: 'MEMBER',
        status: 'ACTIVE',
        approvedAt: new Date(),
      }
    ]
  });

  for (const event of events) {
    const count = await prisma.eventMember.count({
      where: { eventId: event.id, role: 'PARTICIPANT', status: { in: ['ACTIVE'] } },
    });
    await prisma.event.update({ where: { id: event.id }, data: { registrationsCount: count } });
  }

  await prisma.analyticsEvent.createMany({
    data: [
      { type: 'HOME_VIEW', userId: superAdmin.id, locale: 'en', path: '/en' },
      { type: 'HOME_VIEW', userId: participant.id, locale: 'ru', path: '/ru' },
      { type: 'EVENTS_LIST_VIEW', userId: participant.id, locale: 'en', path: '/en/events' },
      { type: 'EVENT_DETAIL_VIEW', userId: participant.id, eventId: events[0].id, locale: 'en' },
      { type: 'EVENT_DETAIL_VIEW', userId: participant.id, eventId: events[0].id, locale: 'en' },
      { type: 'EVENT_DETAIL_VIEW', userId: socialUser.id, eventId: events[2].id, locale: 'ru' },
      { type: 'EVENT_DETAIL_VIEW', eventId: events[1].id, locale: 'en' },
      { type: 'EVENT_REGISTRATION', userId: participant.id, eventId: events[0].id, authProvider: 'EMAIL' },
      { type: 'EVENT_REGISTRATION', userId: socialUser.id, eventId: events[2].id, authProvider: 'GOOGLE' },
      { type: 'USER_REGISTER', userId: participant.id, authProvider: 'EMAIL' },
      { type: 'USER_REGISTER', userId: socialUser.id, authProvider: 'GOOGLE' },
      { type: 'USER_LOGIN', userId: superAdmin.id, authProvider: 'EMAIL' },
      { type: 'USER_LOGIN', userId: platformAdmin.id, authProvider: 'EMAIL' },
      { type: 'USER_LOGIN', userId: socialUser.id, authProvider: 'GOOGLE' },
      { type: 'VOLUNTEER_APPLICATION_SUBMITTED', userId: volunteer.id, eventId: events[0].id },
      { type: 'VOLUNTEER_APPLICATION_APPROVED', userId: volunteer.id, eventId: events[1].id },
      { type: 'TEAM_CREATED', userId: participant.id, eventId: events[6].id },
      { type: 'TEAM_CREATED', userId: eventAdmin.id, eventId: events[5].id },
      { type: 'TEAM_JOIN_REQUESTED', userId: socialUser.id, eventId: events[6].id },
      { type: 'TEAM_MEMBER_APPROVED', userId: socialUser.id, eventId: events[6].id },
      { type: 'EVENT_ADMIN_ASSIGNED', userId: eventAdmin.id, eventId: events[0].id },
    ],
  });

  console.log(`Created ${events.length} events`);
  console.log('Created event-scoped members and analytics events');
  console.log('');
  console.log('Demo credentials:');
  console.log('  Super admin:    admin@example.com / admin123');
  console.log('  Platform admin: platform@example.com / platform123');
  console.log('  Event admin:    organizer@example.com / organizer123');
  console.log('  User:           user@example.com / user123');
  console.log('  Volunteer:      volunteer@example.com / volunteer123');
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
