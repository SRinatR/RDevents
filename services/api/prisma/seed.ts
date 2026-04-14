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
    {
      slug: 'robotics-lab-orientation',
      title: 'Robotics Lab Orientation',
      shortDescription: 'A published event whose registration opens later, useful for gate testing.',
      fullDescription: 'Students and mentors can preview the new robotics lab, meet coordinators, and learn how upcoming cohorts will be selected. Registration is intentionally not open yet for testing.',
      category: 'Education',
      location: 'Tashkent Robotics Center',
      coverImageUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200&h=700&fit=crop',
      capacity: 60,
      startsAt: new Date('2026-08-10T09:00:00Z'),
      endsAt: new Date('2026-08-10T12:00:00Z'),
      registrationOpensAt: new Date('2026-07-01T09:00:00Z'),
      registrationDeadline: new Date('2026-08-05T18:00:00Z'),
      requiredProfileFields: ['name', 'phone', 'city', 'telegram'],
      requiredEventFields: ['motivation', 'university', 'course'],
      tags: ['education', 'robotics', 'students'],
      isFeatured: false,
    },
    {
      slug: 'sold-out-product-clinic',
      title: 'Sold Out Product Clinic',
      shortDescription: 'A tiny workshop with one seat, already full for capacity testing.',
      fullDescription: 'A deliberately small product critique session. The seed fills the only available seat so the event-full branch can be tested immediately.',
      category: 'Business',
      location: 'Founders Hub, Tashkent',
      coverImageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=700&fit=crop',
      capacity: 1,
      startsAt: new Date('2026-05-30T14:00:00Z'),
      endsAt: new Date('2026-05-30T16:00:00Z'),
      registrationDeadline: new Date('2026-05-29T18:00:00Z'),
      requiredProfileFields: ['name', 'phone'],
      requiredEventFields: ['motivation'],
      tags: ['product', 'clinic', 'sold-out'],
      isFeatured: false,
    },
    {
      slug: 'open-source-sprint-by-request',
      title: 'Open Source Sprint',
      shortDescription: 'A team-based sprint where joining a team requires captain approval.',
      fullDescription: 'Contributors form teams to fix issues, improve documentation, and ship small open-source improvements. Team membership requests stay pending until a captain or event admin approves them.',
      category: 'Tech',
      location: 'Digital City, Tashkent',
      coverImageUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1200&h=700&fit=crop',
      capacity: 80,
      startsAt: new Date('2026-07-25T10:00:00Z'),
      endsAt: new Date('2026-07-26T18:00:00Z'),
      registrationDeadline: new Date('2026-07-22T18:00:00Z'),
      requiredProfileFields: ['name', 'phone', 'telegram'],
      requiredEventFields: ['experience', 'teamPreference'],
      tags: ['open-source', 'teams', 'approval'],
      isTeamBased: true,
      minTeamSize: 2,
      maxTeamSize: 4,
      allowSoloParticipation: false,
      teamJoinMode: 'BY_REQUEST' as const,
      requireAdminApprovalForTeams: true,
      isFeatured: false,
    },
    {
      slug: 'draft-admin-planning-session',
      title: 'Draft Admin Planning Session',
      shortDescription: 'A draft event that should appear in admin tooling but not public listings.',
      fullDescription: 'Internal planning placeholder used to test draft status, admin lists, event editing, and unpublished event visibility rules.',
      category: 'Internal',
      location: 'Online',
      coverImageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&h=700&fit=crop',
      capacity: 25,
      startsAt: new Date('2026-09-01T09:00:00Z'),
      endsAt: new Date('2026-09-01T11:00:00Z'),
      registrationDeadline: new Date('2026-08-25T18:00:00Z'),
      tags: ['draft', 'admin'],
      status: EventStatus.DRAFT,
      isFeatured: false,
    },
    {
      slug: 'cancelled-food-fair',
      title: 'Cancelled Food Fair',
      shortDescription: 'A cancelled event for status badges and admin filters.',
      fullDescription: 'This public food fair was cancelled in the seed data so status colors, admin actions, and unavailable registration states can be checked.',
      category: 'Food',
      location: 'Tashkent City Park',
      coverImageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&h=700&fit=crop',
      capacity: 300,
      startsAt: new Date('2026-05-10T10:00:00Z'),
      endsAt: new Date('2026-05-10T18:00:00Z'),
      registrationDeadline: new Date('2026-05-08T18:00:00Z'),
      tags: ['food', 'cancelled'],
      status: EventStatus.CANCELLED,
      isFeatured: false,
    },
    {
      slug: 'spring-retrospective-completed',
      title: 'Spring Retrospective',
      shortDescription: 'A completed event for archive, analytics, and my-events states.',
      fullDescription: 'A past retrospective event used for completed status, historical analytics, and cabinet pages that show older memberships.',
      category: 'Community',
      location: 'Youth Center, Tashkent',
      coverImageUrl: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1200&h=700&fit=crop',
      capacity: 90,
      startsAt: new Date('2026-04-01T15:00:00Z'),
      endsAt: new Date('2026-04-01T18:00:00Z'),
      registrationDeadline: new Date('2026-03-30T18:00:00Z'),
      tags: ['archive', 'completed'],
      status: EventStatus.COMPLETED,
      isFeatured: false,
    },
  ];

  const events = [];
  for (const input of eventInputs) {
    const { registrationDeadline, status: inputStatus, ...rest } = input;
    const status = inputStatus ?? EventStatus.PUBLISHED;
    events.push(await prisma.event.create({
      data: {
        ...rest,
        registrationDeadline,
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
      {
        eventId: events[6].id,
        userId: teamApplicant.id,
        role: 'PARTICIPANT',
        status: 'ACTIVE',
        assignedByUserId: teamApplicant.id,
        approvedAt: new Date(),
      },
      {
        eventId: events[7].id,
        userId: incompleteUser.id,
        role: 'PARTICIPANT',
        status: 'PENDING',
        assignedByUserId: incompleteUser.id,
        notes: 'Pending profile completion before registration can be approved.',
      },
      {
        eventId: events[8].id,
        userId: participant.id,
        role: 'PARTICIPANT',
        status: 'ACTIVE',
        assignedByUserId: participant.id,
        approvedAt: new Date(),
        notes: 'Fills the only available seat for EVENT_FULL testing.',
      },
      {
        eventId: events[9].id,
        userId: secondEventAdmin.id,
        role: 'EVENT_ADMIN',
        status: 'ACTIVE',
        assignedByUserId: superAdmin.id,
        approvedAt: new Date(),
        notes: 'Manages the team request event.',
      },
      {
        eventId: events[9].id,
        userId: secondEventAdmin.id,
        role: 'PARTICIPANT',
        status: 'ACTIVE',
        assignedByUserId: secondEventAdmin.id,
        approvedAt: new Date(),
      },
      {
        eventId: events[9].id,
        userId: pendingParticipant.id,
        role: 'PARTICIPANT',
        status: 'PENDING',
        assignedByUserId: pendingParticipant.id,
        notes: 'Pending participant membership for admin review screens.',
      },
      {
        eventId: events[2].id,
        userId: reserveParticipant.id,
        role: 'PARTICIPANT',
        status: 'RESERVE',
        assignedByUserId: reserveParticipant.id,
        notes: 'Waitlist / reserve state.',
      },
      {
        eventId: events[1].id,
        userId: rejectedParticipant.id,
        role: 'PARTICIPANT',
        status: 'REJECTED',
        assignedByUserId: platformAdmin.id,
        rejectedAt: new Date(),
        notes: 'Rejected participant state.',
      },
      {
        eventId: events[4].id,
        userId: pendingParticipant.id,
        role: 'PARTICIPANT',
        status: 'CANCELLED',
        assignedByUserId: pendingParticipant.id,
        notes: 'Cancelled by participant.',
      },
      {
        eventId: events[12].id,
        userId: socialUser.id,
        role: 'PARTICIPANT',
        status: 'ACTIVE',
        assignedByUserId: socialUser.id,
        approvedAt: new Date('2026-03-29T12:00:00Z'),
      },
      {
        eventId: events[6].id,
        userId: pendingParticipant.id,
        role: 'VOLUNTEER',
        status: 'PENDING',
        assignedByUserId: pendingParticipant.id,
        notes: 'Pending volunteer application for the hackathon.',
      },
      {
        eventId: events[1].id,
        userId: rejectedParticipant.id,
        role: 'VOLUNTEER',
        status: 'REJECTED',
        assignedByUserId: platformAdmin.id,
        rejectedAt: new Date(),
        notes: 'Rejected volunteer application.',
      },
      {
        eventId: events[0].id,
        userId: reserveParticipant.id,
        role: 'VOLUNTEER',
        status: 'REMOVED',
        assignedByUserId: superAdmin.id,
        removedAt: new Date(),
        notes: 'Removed volunteer record for filter testing.',
      },
      {
        eventId: events[8].id,
        userId: volunteer.id,
        role: 'VOLUNTEER',
        status: 'PENDING',
        assignedByUserId: volunteer.id,
        notes: 'Volunteer request on a full participant event.',
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
      {
        eventId: events[6].id,
        userId: teamApplicant.id,
        answersJson: {
          motivation: 'I want to help build the backend for an AI prototype.',
          experience: 'Node.js and PostgreSQL contributor.',
          teamPreference: 'Backend engineer',
        },
        isComplete: true,
      },
      {
        eventId: events[7].id,
        userId: incompleteUser.id,
        answersJson: {
          motivation: 'I want to see what robotics projects are planned.',
        },
        isComplete: false,
      },
      {
        eventId: events[8].id,
        userId: participant.id,
        answersJson: {
          motivation: 'I want direct product feedback from mentors.',
        },
        isComplete: true,
      },
      {
        eventId: events[9].id,
        userId: secondEventAdmin.id,
        answersJson: {
          experience: 'Maintainer for several community repos.',
          teamPreference: 'Captain',
        },
        isComplete: true,
      },
      {
        eventId: events[9].id,
        userId: teamApplicant.id,
        answersJson: {
          experience: 'Frontend and documentation contributions.',
          teamPreference: 'Join an existing team',
        },
        isComplete: true,
      },
      {
        eventId: events[2].id,
        userId: reserveParticipant.id,
        answersJson: {
          motivation: 'I want to practice pitching with a team.',
          teamPreference: 'Reserve member',
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
      slug: 'tech-titans',
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
      slug: 'samarkand-shooters',
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

  const requestTeam = await prisma.eventTeam.create({
    data: {
      eventId: events[9].id,
      name: 'Approval Queue Crew',
      slug: 'approval-queue-crew',
      joinCode: 'QUEUE1',
      description: 'Team with a pending member request for BY_REQUEST flow testing.',
      captainUserId: secondEventAdmin.id,
      status: 'ACTIVE',
      maxSize: 4,
    },
  });

  await prisma.eventTeamMember.createMany({
    data: [
      {
        teamId: requestTeam.id,
        userId: secondEventAdmin.id,
        role: 'CAPTAIN',
        status: 'ACTIVE',
        approvedAt: new Date(),
      },
      {
        teamId: requestTeam.id,
        userId: teamApplicant.id,
        role: 'MEMBER',
        status: 'PENDING',
      },
      {
        teamId: requestTeam.id,
        userId: rejectedParticipant.id,
        role: 'MEMBER',
        status: 'REJECTED',
      },
    ],
  });

  const designMindsTeam = await prisma.eventTeam.create({
    data: {
      eventId: hackathonId,
      name: 'Design Minds',
      slug: 'design-minds',
      joinCode: 'DESIGN',
      description: 'Second active hackathon team with a pending member.',
      captainUserId: teamApplicant.id,
      status: 'ACTIVE',
      maxSize: 5,
    },
  });

  await prisma.eventTeamMember.createMany({
    data: [
      {
        teamId: designMindsTeam.id,
        userId: teamApplicant.id,
        role: 'CAPTAIN',
        status: 'ACTIVE',
        approvedAt: new Date(),
      },
      {
        teamId: designMindsTeam.id,
        userId: reserveParticipant.id,
        role: 'MEMBER',
        status: 'PENDING',
      },
    ],
  });

  const pendingTeam = await prisma.eventTeam.create({
    data: {
      eventId: events[9].id,
      name: 'Pending Approval Team',
      slug: 'pending-approval-team',
      joinCode: 'PEND99',
      description: 'Team record waiting for admin approval.',
      captainUserId: pendingParticipant.id,
      status: 'PENDING',
      maxSize: 4,
    },
  });

  await prisma.eventTeamMember.create({
    data: {
      teamId: pendingTeam.id,
      userId: pendingParticipant.id,
      role: 'CAPTAIN',
      status: 'ACTIVE',
      approvedAt: new Date(),
    },
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
      { type: 'EVENT_DETAIL_VIEW', userId: incompleteUser.id, eventId: events[7].id, locale: 'en' },
      { type: 'REGISTER_CLICK', userId: incompleteUser.id, eventId: events[7].id, locale: 'en' },
      { type: 'EVENT_DETAIL_VIEW', userId: participant.id, eventId: events[8].id, locale: 'ru' },
      { type: 'EVENT_REGISTRATION', userId: participant.id, eventId: events[8].id, authProvider: 'EMAIL' },
      { type: 'EVENT_DETAIL_VIEW', userId: teamApplicant.id, eventId: events[9].id, locale: 'en' },
      { type: 'TEAM_CREATED', userId: secondEventAdmin.id, eventId: events[9].id },
      { type: 'TEAM_CREATED', userId: pendingParticipant.id, eventId: events[9].id },
      { type: 'TEAM_JOIN_REQUESTED', userId: teamApplicant.id, eventId: events[9].id },
      { type: 'VOLUNTEER_APPLICATION_SUBMITTED', userId: pendingParticipant.id, eventId: events[6].id },
      { type: 'VOLUNTEER_APPLICATION_REJECTED', userId: rejectedParticipant.id, eventId: events[1].id },
      { type: 'EVENT_ADMIN_ASSIGNED', userId: secondEventAdmin.id, eventId: events[9].id },
      { type: 'USER_LOGIN', userId: socialUser.id, authProvider: 'YANDEX' },
      { type: 'PROVIDER_USED', userId: socialUser.id, authProvider: 'TELEGRAM' },
    ],
  });

  console.log(`Created ${events.length} events`);
  console.log('Created event-scoped members and analytics events');
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
