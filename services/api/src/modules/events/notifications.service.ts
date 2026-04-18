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
