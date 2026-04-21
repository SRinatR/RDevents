export const EVENT_STATUS_LABELS: Record<string, { ru: string; en: string }> = {
  PUBLISHED: { ru: 'Опубликовано', en: 'Published' },
  DRAFT: { ru: 'Черновик', en: 'Draft' },
  ACTIVE: { ru: 'Активно', en: 'Active' },
  COMPLETED: { ru: 'Завершено', en: 'Completed' },
  CANCELLED: { ru: 'Отменено', en: 'Cancelled' },
  ARCHIVED: { ru: 'Архив', en: 'Archived' },
};

export const REGISTRATION_STATUS_LABELS: Record<string, { ru: string; en: string }> = {
  DRAFT: { ru: 'Черновик', en: 'Draft' },
  SUBMITTED: { ru: 'Подана', en: 'Submitted' },
  UNDER_REVIEW: { ru: 'На рассмотрении', en: 'Under review' },
  CONFIRMED: { ru: 'Подтверждена', en: 'Confirmed' },
  REJECTED: { ru: 'Отклонена', en: 'Rejected' },
  RESERVE: { ru: 'В резерве', en: 'Reserve' },
  WITHDRAWN: { ru: 'Отозвана', en: 'Withdrawn' },
};

export const TEAM_STATUS_LABELS: Record<string, { ru: string; en: string }> = {
  OPEN: { ru: 'Открыта', en: 'Open' },
  CLOSED: { ru: 'Закрыта', en: 'Closed' },
  FULL: { ru: 'Заполнена', en: 'Full' },
  SUBMITTED: { ru: 'Подана', en: 'Submitted' },
  APPROVED: { ru: 'Одобрена', en: 'Approved' },
  REJECTED: { ru: 'Отклонена', en: 'Rejected' },
  DRAFT: { ru: 'Черновик', en: 'Draft' },
};

export const ROLE_LABELS: Record<string, { ru: string; en: string }> = {
  PARTICIPANT: { ru: 'Участник', en: 'Participant' },
  VOLUNTEER: { ru: 'Волонтёр', en: 'Volunteer' },
  CAPTAIN: { ru: 'Капитан', en: 'Captain' },
  ADMIN: { ru: 'Администратор', en: 'Administrator' },
  EVENT_ADMIN: { ru: 'Администратор события', en: 'Event admin' },
  ORGANIZER: { ru: 'Организатор', en: 'Organizer' },
};

export const DEADLINE_TYPE_LABELS: Record<string, { ru: string; en: string }> = {
  REGISTRATION_OPEN: { ru: 'Открытие регистрации', en: 'Registration opens' },
  REGISTRATION_CLOSE: { ru: 'Закрытие регистрации', en: 'Registration closes' },
  REGISTRATION_DEADLINE: { ru: 'Окончание регистрации', en: 'Registration deadline' },
  TEAM_SUBMIT_DEADLINE: { ru: 'Подача команды', en: 'Team submission deadline' },
  DOCUMENT_UPLOAD_DEADLINE: { ru: 'Загрузка документов', en: 'Document upload deadline' },
  CHECK_IN: { ru: 'Заезд / регистрация', en: 'Check-in' },
  EVENT_START: { ru: 'Начало события', en: 'Event starts' },
  EVENT_END: { ru: 'Завершение события', en: 'Event ends' },
  CUSTOM: { ru: 'Важная дата', en: 'Important date' },
};

export const QUICK_ACTION_LABELS: Record<string, { ru: string; en: string; icon: string }> = {
  OPEN_PROFILE_REQUIREMENTS: { 
    ru: 'Заполнить профиль', 
    en: 'Complete profile', 
    icon: '👤' 
  },
  COMPLETE_EVENT_FORM: { 
    ru: 'Заполнить анкету события', 
    en: 'Complete event form', 
    icon: '📋' 
  },
  ACCEPT_TEAM_INVITATION: { 
    ru: 'Принять приглашение в команду', 
    en: 'Accept team invitation', 
    icon: '📬' 
  },
  CREATE_OR_JOIN_TEAM: { 
    ru: 'Создать или вступить в команду', 
    en: 'Create or join team', 
    icon: '👥' 
  },
  OPEN_TEAM: { 
    ru: 'Открыть команду', 
    en: 'Open team', 
    icon: '🏆' 
  },
  EDIT_TEAM: { 
    ru: 'Редактировать команду', 
    en: 'Edit team', 
    icon: '✏️' 
  },
  OPEN_CALENDAR: { 
    ru: 'Добавить в календарь', 
    en: 'Add to calendar', 
    icon: '📅' 
  },
  OPEN_SUPPORT: { 
    ru: 'Обратиться в поддержку', 
    en: 'Contact support', 
    icon: '💬' 
  },
};

export function getEventStatusLabel(status: string, locale: string): string {
  const labels = EVENT_STATUS_LABELS[status];
  return labels 
    ? labels[locale === 'ru' ? 'ru' : 'en']
    : status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

export function getRoleLabel(role: string, locale: string): string {
  const labels = ROLE_LABELS[role];
  return labels 
    ? labels[locale === 'ru' ? 'ru' : 'en']
    : role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

export function getDeadlineTypeLabel(type: string, locale: string): string {
  const labels = DEADLINE_TYPE_LABELS[type];
  return labels 
    ? labels[locale === 'ru' ? 'ru' : 'en']
    : type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

export function getRegistrationStatusLabel(status: string, locale: string): string {
  const labels = REGISTRATION_STATUS_LABELS[status];
  return labels 
    ? labels[locale === 'ru' ? 'ru' : 'en']
    : status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

export function getTeamStatusLabel(status: string, locale: string): string {
  const labels = TEAM_STATUS_LABELS[status];
  return labels 
    ? labels[locale === 'ru' ? 'ru' : 'en']
    : status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

export function formatEventDateRange(startsAt: string, endsAt: string, locale: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  
  const isSameDay = start.toDateString() === end.toDateString();
  
  const dateFormatter = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  
  const timeFormatter = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const preposition = locale === 'ru' ? 'в' : 'at';

  if (isSameDay) {
    return `${dateFormatter.format(start)} ${preposition} ${timeFormatter.format(start)}`;
  }
  
  return `${dateFormatter.format(start)} — ${dateFormatter.format(end)}`;
}

export function formatDeadlineDate(dateStr: string, locale: string): { date: string; time: string; isPast: boolean; isToday: boolean; isTomorrow: boolean } {
  const date = new Date(dateStr);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const deadlineStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const isPast = date < now;
  const isToday = deadlineStart.getTime() === todayStart.getTime();
  const isTomorrow = deadlineStart.getTime() === tomorrowStart.getTime();
  
  const dateFormatter = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
  
  const timeFormatter = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  let dateLabel = dateFormatter.format(date);
  if (isToday) {
    dateLabel = locale === 'ru' ? 'Сегодня' : 'Today';
  } else if (isTomorrow) {
    dateLabel = locale === 'ru' ? 'Завтра' : 'Tomorrow';
  }

  return {
    date: dateLabel,
    time: timeFormatter.format(date),
    isPast,
    isToday,
    isTomorrow,
  };
}
