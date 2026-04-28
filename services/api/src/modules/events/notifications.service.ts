import { sendEventNotificationEmailSafe } from '../../common/email.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';

type Recipient = {
  id: string;
  email: string;
  name?: string | null;
};

type EventForEmail = {
  id: string;
  title: string;
  slug: string;
};

const PARTICIPANT_STATUS_COPY: Record<string, string> = {
  PENDING: 'заявка отправлена на рассмотрение',
  ACTIVE: 'участие подтверждено',
  RESERVE: 'вы добавлены в резерв',
  REJECTED: 'заявка отклонена',
  CANCELLED: 'участие отменено',
  REMOVED: 'участие удалено',
};

const TEAM_MEMBER_STATUS_COPY: Record<string, string> = {
  PENDING: 'заявка в команду ожидает решения',
  ACTIVE: 'участник добавлен в команду',
  REJECTED: 'заявка в команду отклонена',
  REMOVED: 'участник удалён из команды',
  LEFT: 'участник вышел из команды',
};

export async function notifyParticipantApplicationSubmitted(
  eventId: string,
  userId: string,
  status: string,
) {
  const data = await getEventAndUser(eventId, userId);
  if (!data) return;

  const statusText = PARTICIPANT_STATUS_COPY[status] ?? status;
  await sendToRecipients({
    event: data.event,
    recipients: [data.user],
    subject: `RDEvents: ${data.event.title} — заявка обновлена`,
    title: `Заявка на мероприятие: ${data.event.title}`,
    body: [
      `Здравствуйте${formatName(data.user)}.`,
      `Статус вашей заявки: ${statusText}.`,
      'Любое дальнейшее изменение статуса будет отправлено отдельным письмом.',
    ],
    action: 'participant_application_submitted_email',
  });
}

export async function notifyParticipantStatusChanged(
  eventId: string,
  userId: string,
  status: string,
  notes?: string | null,
) {
  const data = await getEventAndUser(eventId, userId);
  if (!data) return;

  const statusText = PARTICIPANT_STATUS_COPY[status] ?? status;
  await sendToRecipients({
    event: data.event,
    recipients: [data.user],
    subject: `RDEvents: ${data.event.title} — статус участия изменён`,
    title: `Статус участия изменён`,
    body: [
      `Мероприятие: ${data.event.title}.`,
      `Новый статус: ${statusText}.`,
      ...(notes ? [`Комментарий организатора: ${notes}`] : []),
    ],
    action: 'participant_status_changed_email',
  });
}

export async function notifyParticipantAnswersUpdated(eventId: string, userId: string) {
  const data = await getEventAndUser(eventId, userId);
  if (!data) return;

  await sendToRecipients({
    event: data.event,
    recipients: [data.user],
    subject: `RDEvents: ${data.event.title} — анкета сохранена`,
    title: 'Анкета мероприятия обновлена',
    body: [
      `Мероприятие: ${data.event.title}.`,
      'Мы сохранили изменения в вашей анкете.',
    ],
    action: 'participant_answers_updated_email',
  });
}

export async function notifyTeamCreated(eventId: string, teamId: string) {
  const data = await getTeamEmailData(eventId, teamId);
  if (!data) return;

  await sendToRecipients({
    event: data.event,
    recipients: [data.captain],
    subject: `RDEvents: ${data.event.title} — команда создана`,
    title: `Команда "${data.team.name}" создана`,
    body: [
      `Мероприятие: ${data.event.title}.`,
      `Статус команды: ${data.team.status}.`,
      data.team.joinCode ? `Код приглашения: ${data.team.joinCode}.` : 'Код приглашения не требуется для открытого вступления.',
    ],
    action: 'team_created_email',
  });
}

export async function notifyTeamUpdated(eventId: string, teamId: string) {
  const data = await getTeamEmailData(eventId, teamId);
  if (!data) return;

  await sendToRecipients({
    event: data.event,
    recipients: getActiveTeamRecipients(data),
    subject: `RDEvents: ${data.event.title} — команда обновлена`,
    title: `Команда "${data.team.name}" обновлена`,
    body: [
      `Мероприятие: ${data.event.title}.`,
      'Название или описание команды изменено.',
    ],
    action: 'team_updated_email',
  });
}

export async function notifyTeamMemberChanged(
  eventId: string,
  teamId: string,
  memberUserId: string,
  status: string,
) {
  const data = await getTeamEmailData(eventId, teamId);
  if (!data) return;

  const member = data.team.members.find(item => item.user.id === memberUserId)?.user;
  if (!member) return;

  const statusText = TEAM_MEMBER_STATUS_COPY[status] ?? status;
  await sendToRecipients({
    event: data.event,
    recipients: uniqueRecipients([member, data.captain]),
    subject: `RDEvents: ${data.event.title} — состав команды изменён`,
    title: `Состав команды "${data.team.name}" изменён`,
    body: [
      `Мероприятие: ${data.event.title}.`,
      `Участник: ${member.name || member.email}.`,
      `Изменение: ${statusText}.`,
    ],
    action: 'team_member_changed_email',
  });
}

async function getEventAndUser(eventId: string, userId: string): Promise<{ event: EventForEmail; user: Recipient } | null> {
  const [event, user] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { id: true, title: true, slug: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } }),
  ]);

  if (!event || !user) return null;
  return { event, user };
}

async function getTeamEmailData(eventId: string, teamId: string) {
  const team = await prisma.eventTeam.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      eventId: true,
      name: true,
      status: true,
      joinCode: true,
      captainUser: { select: { id: true, email: true, name: true } },
      event: { select: { id: true, title: true, slug: true } },
      members: {
        where: { status: { notIn: ['REMOVED', 'LEFT'] } },
        include: { user: { select: { id: true, email: true, name: true } } },
      },
    },
  });

  if (!team || team.eventId !== eventId) return null;
  return {
    event: team.event,
    team,
    captain: team.captainUser,
  };
}

async function sendToRecipients(input: {
  event: EventForEmail;
  recipients: Recipient[];
  subject: string;
  title: string;
  body: string[];
  action: string;
}) {
  const recipients = uniqueRecipients(input.recipients);
  const actionUrl = buildEventUrl(input.event.slug);

  await Promise.all(recipients.map(recipient => sendEventNotificationEmailSafe({
    to: recipient.email,
    subject: input.subject,
    title: input.title,
    body: input.body,
    actionUrl,
    actionLabel: 'Открыть мероприятие',
  }, {
    userId: recipient.id,
    eventId: input.event.id,
    action: input.action,
  })));
}

function getActiveTeamRecipients(data: NonNullable<Awaited<ReturnType<typeof getTeamEmailData>>>) {
  return uniqueRecipients([
    data.captain,
    ...data.team.members
      .filter(member => member.status === 'ACTIVE')
      .map(member => member.user),
  ]);
}

function uniqueRecipients(recipients: Recipient[]) {
  const byEmail = new Map<string, Recipient>();
  for (const recipient of recipients) {
    if (!recipient.email) continue;
    byEmail.set(recipient.email.toLowerCase(), recipient);
  }
  return [...byEmail.values()];
}

function buildEventUrl(slug: string) {
  const base = (env.CORS_ORIGIN || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');
  return `${base}/ru/events/${slug}`;
}

function formatName(user: Recipient) {
  return user.name ? `, ${user.name}` : '';
}

export async function notifyTeamSubmitted(eventId: string, teamId: string) {
  const data = await getTeamEmailData(eventId, teamId);
  if (!data) return;

  const eventAdmins = await prisma.eventMember.findMany({
    where: { eventId, role: { in: ['EVENT_ADMIN', 'ADMIN'] as any[] }, status: 'ACTIVE' },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  await sendToRecipients({
    event: data.event,
    recipients: eventAdmins.map(m => m.user),
    subject: `RDEvents: ${data.event.title} — команда отправлена на утверждение`,
    title: `Команда "${data.team.name}" отправлена на утверждение`,
    body: [
      `Мероприятие: ${data.event.title}.`,
      `Команда "${data.team.name}" отправила заявку на участие.`,
      'Требуется проверка состава и утверждение.',
    ],
    action: 'team_submitted_email',
  });
}

export async function notifyTeamApproved(eventId: string, teamId: string, decisionReason?: string | null) {
  const data = await getTeamEmailData(eventId, teamId);
  if (!data) return;

  await sendToRecipients({
    event: data.event,
    recipients: [data.captain],
    subject: `RDEvents: ${data.event.title} — команда утверждена`,
    title: `Команда "${data.team.name}" утверждена`,
    body: [
      `Мероприятие: ${data.event.title}.`,
      'Ваша команда утверждена для участия в мероприятии.',
      ...(decisionReason ? [`Комментарий: ${decisionReason}`] : []),
    ],
    action: 'team_approved_email',
  });
}

export async function notifyTeamRejected(eventId: string, teamId: string, decisionReason: string) {
  const data = await getTeamEmailData(eventId, teamId);
  if (!data) return;

  await sendToRecipients({
    event: data.event,
    recipients: [data.captain],
    subject: `RDEvents: ${data.event.title} — заявка команды отклонена`,
    title: `Заявка команды "${data.team.name}" отклонена`,
    body: [
      `Мероприятие: ${data.event.title}.`,
      'Ваша заявка на участие команды отклонена.',
      `Причина: ${decisionReason}`,
    ],
    action: 'team_rejected_email',
  });
}

export async function notifyAdminMemberReplaced(
  eventId: string,
  teamId: string,
  oldUserId: string,
  newUserId: string,
) {
  const data = await getTeamEmailData(eventId, teamId);
  if (!data) return;

  const oldMember = data.team.members.find(m => m.user.id === oldUserId)?.user;
  const newMember = data.team.members.find(m => m.user.id === newUserId)?.user;

  if (oldMember) {
    await sendToRecipients({
      event: data.event,
      recipients: [oldMember],
      subject: `RDEvents: ${data.event.title} — вас заменили в команде`,
      title: 'Замена в команде',
      body: [
        `Мероприятие: ${data.event.title}.`,
        `Вас заменили в команде "${data.team.name}".`,
        'Организатор мероприятия внёс изменения в состав.',
      ],
      action: 'admin_member_replaced_old_email',
    });
  }

  if (newMember) {
    await sendToRecipients({
      event: data.event,
      recipients: [newMember],
      subject: `RDEvents: ${data.event.title} — вас добавили в команду`,
      title: 'Добавление в команду',
      body: [
        `Мероприятие: ${data.event.title}.`,
        `Вас добавили в команду "${data.team.name}".`,
        'Организатор мероприятия внёс изменения в состав.',
      ],
      action: 'admin_member_replaced_new_email',
    });
  }

  await sendToRecipients({
    event: data.event,
    recipients: [data.captain],
    subject: `RDEvents: ${data.event.title} — состав команды изменён`,
    title: `Состав команды "${data.team.name}" изменён`,
    body: [
      `Мероприятие: ${data.event.title}.`,
      'Организатор напрямую изменил состав команды.',
    ],
    action: 'admin_member_replaced_captain_email',
  });
}

export async function notifyAdminCaptainChanged(
  eventId: string,
  teamId: string,
  oldCaptainId: string,
  newCaptainId: string,
) {
  const data = await getTeamEmailData(eventId, teamId);
  if (!data) return;

  const oldCaptain = data.team.members.find(m => m.user.id === oldCaptainId)?.user;
  const newCaptain = data.team.members.find(m => m.user.id === newCaptainId)?.user;

  if (oldCaptain) {
    await sendToRecipients({
      event: data.event,
      recipients: [oldCaptain],
      subject: `RDEvents: ${data.event.title} — вы больше не капитан команды`,
      title: 'Изменение статуса капитана',
      body: [
        `Мероприятие: ${data.event.title}.`,
        `Организатор назначил нового капитана команды "${data.team.name}".`,
        'Вы остаётесь участником команды.',
      ],
      action: 'admin_captain_changed_old_email',
    });
  }

  if (newCaptain) {
    await sendToRecipients({
      event: data.event,
      recipients: [newCaptain],
      subject: `RDEvents: ${data.event.title} — вы назначены капитаном команды`,
      title: 'Назначение капитаном',
      body: [
        `Мероприятие: ${data.event.title}.`,
        `Вас назначили капитаном команды "${data.team.name}".`,
      ],
      action: 'admin_captain_changed_new_email',
    });
  }
}

export async function notifyAdminRosterReplaced(
  eventId: string,
  teamId: string,
  affectedUserIds: string[],
) {
  const data = await getTeamEmailData(eventId, teamId);
  if (!data) return;

  const affectedUsers = data.team.members
    .filter(m => affectedUserIds.includes(m.user.id))
    .map(m => m.user);

  await sendToRecipients({
    event: data.event,
    recipients: [data.captain, ...affectedUsers],
    subject: `RDEvents: ${data.event.title} — состав команды полностью обновлён`,
    title: `Состав команды "${data.team.name}" обновлён`,
    body: [
      `Мероприятие: ${data.event.title}.`,
      'Организатор полностью обновил состав вашей команды.',
    ],
    action: 'admin_roster_replaced_email',
  });
}
