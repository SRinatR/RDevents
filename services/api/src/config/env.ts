import 'dotenv/config';

// Typed, validated environment config.
// Fail-fast on startup if required vars are missing.

function require_env(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optional_env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  NODE_ENV: optional_env('NODE_ENV', 'development'),
  PORT: parseInt(optional_env('PORT', '4000'), 10),

  DATABASE_URL: require_env('DATABASE_URL'),

  JWT_ACCESS_SECRET: require_env('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: require_env('JWT_REFRESH_SECRET'),
  JWT_ACCESS_TTL: parseInt(optional_env('JWT_ACCESS_TTL', '900'), 10),
  JWT_REFRESH_TTL: parseInt(optional_env('JWT_REFRESH_TTL', '604800'), 10),
  REGISTRATION_CODE_TTL: parseInt(optional_env('REGISTRATION_CODE_TTL', '360'), 10),
  REGISTRATION_COMPLETION_TTL: parseInt(optional_env('REGISTRATION_COMPLETION_TTL', '1800'), 10),
  REGISTRATION_MAX_ATTEMPTS: parseInt(optional_env('REGISTRATION_MAX_ATTEMPTS', '5'), 10),
  REGISTRATION_RESEND_COOLDOWN: parseInt(optional_env('REGISTRATION_RESEND_COOLDOWN', '60'), 10),

  CORS_ORIGIN: optional_env('CORS_ORIGIN', 'http://localhost:3000'),
  RESEND_API_KEY: process.env['RESEND_API_KEY'] ?? '',
  RESEND_FROM_EMAIL: process.env['RESEND_FROM_EMAIL'] ?? '',
  RESEND_FROM_NAME: optional_env('RESEND_FROM_NAME', 'RDEvents'),
  RESEND_REPLY_TO_EMAIL: process.env['RESEND_REPLY_TO_EMAIL'] ?? '',
  RESEND_WEBHOOK_SECRET: process.env['RESEND_WEBHOOK_SECRET'] ?? '',
  RESEND_WEBHOOK_ENDPOINT: process.env['RESEND_WEBHOOK_ENDPOINT'] ?? '',
  SUPPORT_EMAIL: process.env['SUPPORT_EMAIL'] ?? '',
  APP_URL: optional_env('APP_URL', 'http://localhost:3000'),

  MEDIA_STORAGE_DRIVER: optional_env('MEDIA_STORAGE_DRIVER', 'local'),
  MEDIA_UPLOAD_DIR: optional_env('MEDIA_UPLOAD_DIR', './uploads'),
  MEDIA_PUBLIC_BASE_URL: optional_env(
    'MEDIA_PUBLIC_BASE_URL',
    process.env['NODE_ENV'] === 'production' ? 'https://api.rdevents.uz/uploads' : 'http://localhost:4000/uploads',
  ),
  MAX_AVATAR_UPLOAD_MB: parseInt(optional_env('MAX_AVATAR_UPLOAD_MB', '3'), 10),
  MAX_DOCUMENT_UPLOAD_MB: parseInt(optional_env('MAX_DOCUMENT_UPLOAD_MB', '10'), 10),

  // Social auth — optional, dev mock is used when empty
  GOOGLE_CLIENT_ID: process.env['GOOGLE_CLIENT_ID'] ?? '',
  GOOGLE_CLIENT_SECRET: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
  GOOGLE_REDIRECT_URI: optional_env('GOOGLE_REDIRECT_URI', 'http://localhost:4000/api/auth/google/callback'),

  YANDEX_CLIENT_ID: process.env['YANDEX_CLIENT_ID'] ?? '',
  YANDEX_CLIENT_SECRET: process.env['YANDEX_CLIENT_SECRET'] ?? '',
  YANDEX_REDIRECT_URI: optional_env('YANDEX_REDIRECT_URI', 'http://localhost:4000/api/auth/yandex/callback'),

  TELEGRAM_BOT_TOKEN: process.env['TELEGRAM_BOT_TOKEN'] ?? '',
  TELEGRAM_BOT_USERNAME: process.env['TELEGRAM_BOT_USERNAME'] ?? '',

  get isDev() { return this.NODE_ENV === 'development'; },
  get isProd() { return this.NODE_ENV === 'production'; },
} as const;
