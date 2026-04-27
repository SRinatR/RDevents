import { createUnsubscribeToken } from './unsubscribe-token.service.js';

const KNOWN_VARIABLES = new Set([
  'name',
  'email',
  'firstName',
  'lastName',
  'profileUrl',
  'unsubscribeUrl',
  'eventTitle',
  'eventDate',
  'eventLocation',
  'eventUrl',
  'teamName',
  'registrationStatus',
]);

export type RenderVariables = Record<string, string | number | null | undefined>;

export type RenderedEmailContent = {
  subject: string;
  preheader: string | null;
  text: string;
  html: string;
  warnings: string[];
  unknownVariables: string[];
};

export function extractEmailVariables(...values: Array<string | null | undefined>) {
  const variables = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const match of value.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)) {
      variables.add(match[1] ?? '');
    }
  }
  return [...variables].filter(Boolean);
}

export function renderTemplate(value: string | null | undefined, variables: RenderVariables) {
  const warnings: string[] = [];
  const unknownVariables: string[] = [];
  const rendered = String(value ?? '').replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_full, key: string) => {
    if (!KNOWN_VARIABLES.has(key)) {
      unknownVariables.push(key);
      warnings.push(`Unknown variable: ${key}`);
    }

    const replacement = variables[key];
    return replacement === null || replacement === undefined ? '' : String(replacement);
  });

  return {
    rendered,
    warnings,
    unknownVariables: [...new Set(unknownVariables)],
  };
}

export function renderEmailContent(input: {
  subject: string;
  preheader?: string | null;
  textBody: string;
  htmlBody: string;
  variables: RenderVariables;
}): RenderedEmailContent {
  const subject = renderTemplate(input.subject, input.variables);
  const preheader = renderTemplate(input.preheader ?? '', input.variables);
  const text = renderTemplate(input.textBody, input.variables);
  const html = renderTemplate(input.htmlBody, input.variables);
  const unknownVariables = [...new Set([
    ...subject.unknownVariables,
    ...preheader.unknownVariables,
    ...text.unknownVariables,
    ...html.unknownVariables,
  ])];

  return {
    subject: subject.rendered,
    preheader: preheader.rendered || null,
    text: text.rendered,
    html: html.rendered,
    warnings: [...new Set([
      ...subject.warnings,
      ...preheader.warnings,
      ...text.warnings,
      ...html.warnings,
    ])],
    unknownVariables,
  };
}

export function requiresUnsubscribeVariable(type: string) {
  return ['MARKETING', 'EVENT_ANNOUNCEMENT'].includes(type);
}

export function hasUnsubscribeVariable(input: { htmlBody?: string | null; textBody?: string | null }) {
  return extractEmailVariables(input.htmlBody, input.textBody).includes('unsubscribeUrl');
}

export function buildDefaultRecipientVariables(input: {
  userId?: string | null;
  email: string;
  name?: string | null;
  broadcastId?: string | null;
  topic?: string | null;
}) {
  const appUrl = (process.env['APP_URL'] ?? 'http://localhost:3000').replace(/\/$/, '');
  const name = input.name?.trim() || input.email;
  const parts = name.split(/\s+/).filter(Boolean);

  const token = createUnsubscribeToken({
    email: input.email,
    userId: input.userId ?? null,
    broadcastId: input.broadcastId ?? null,
    topic: input.topic ?? 'MARKETING',
  });

  const unsubscribeUrl = `${appUrl}/ru/unsubscribe?token=${encodeURIComponent(token)}`;

  return {
    name,
    email: input.email,
    firstName: parts[0] ?? name,
    lastName: parts.slice(1).join(' '),
    profileUrl: input.userId ? `${appUrl}/ru/admin/users/${input.userId}` : '',
    unsubscribeUrl,
  };
}
