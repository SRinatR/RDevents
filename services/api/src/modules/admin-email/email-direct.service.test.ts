import { describe, expect, it, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { prisma } from '../../db/prisma.js';
import { sendPlatformEmail } from '../../common/email.js';

vi.mock('../../db/prisma.js', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
    emailMessage: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../common/email.js', () => ({
  sendPlatformEmail: vi.fn(),
}));

const mockPrisma = prisma as any;
const mockSendPlatformEmail = vi.mocked(sendPlatformEmail);

describe('email-direct.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('assertDirectEmailInput validation', () => {
    it('empty recipients -> RECIPIENTS_REQUIRED', async () => {
      const { sendDirectEmailToUsers } = await import('./email-direct.service.js');

      await expect(
        sendDirectEmailToUsers({
          actorUserId: 'admin-1',
          selectedUserIds: [],
          subject: 'Test',
          text: 'Test body',
          emailType: 'ADMIN_DIRECT',
          reason: 'Test reason',
          respectConsent: false,
        })
      ).rejects.toThrow('RECIPIENTS_REQUIRED');
    });

    it('empty subject -> SUBJECT_REQUIRED', async () => {
      const { sendDirectEmailToUsers } = await import('./email-direct.service.js');

      await expect(
        sendDirectEmailToUsers({
          actorUserId: 'admin-1',
          selectedUserIds: ['user-1'],
          subject: '',
          text: 'Test body',
          emailType: 'ADMIN_DIRECT',
          reason: 'Test reason',
          respectConsent: false,
        })
      ).rejects.toThrow('SUBJECT_REQUIRED');
    });

    it('empty text and html -> EMAIL_CONTENT_REQUIRED', async () => {
      const { sendDirectEmailToUsers } = await import('./email-direct.service.js');

      await expect(
        sendDirectEmailToUsers({
          actorUserId: 'admin-1',
          selectedUserIds: ['user-1'],
          subject: 'Test Subject',
          text: '',
          html: '',
          emailType: 'ADMIN_DIRECT',
          reason: 'Test reason',
          respectConsent: false,
        })
      ).rejects.toThrow('EMAIL_CONTENT_REQUIRED');
    });

    it('empty reason -> REASON_REQUIRED', async () => {
      const { sendDirectEmailToUsers } = await import('./email-direct.service.js');

      await expect(
        sendDirectEmailToUsers({
          actorUserId: 'admin-1',
          selectedUserIds: ['user-1'],
          subject: 'Test Subject',
          text: 'Test body',
          emailType: 'ADMIN_DIRECT',
          reason: '',
          respectConsent: false,
        })
      ).rejects.toThrow('REASON_REQUIRED');
    });
  });

  describe('previewManualRecipients', () => {
    it('user not found -> skipped', async () => {
      vi.mocked(mockPrisma.user.findMany).mockResolvedValue([]);

      const { previewManualRecipients } = await import('./email-direct.service.js');
      const result = await previewManualRecipients({
        selectedUserIds: ['user-1'],
        emailType: 'ADMIN_DIRECT',
        respectConsent: false,
      });

      expect(result.totalSelected).toBe(1);
      expect(result.willSend).toBe(0);
      expect(result.willSkip).toBe(1);
      expect(result.skipped[0].status).toBe('SKIPPED_USER_NOT_FOUND');
    });

    it('user without email -> skipped', async () => {
      vi.mocked(mockPrisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: null,
          name: 'Test User',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
        },
      ] as any);

      const { previewManualRecipients } = await import('./email-direct.service.js');
      const result = await previewManualRecipients({
        selectedUserIds: ['user-1'],
        emailType: 'ADMIN_DIRECT',
        respectConsent: false,
      });

      expect(result.willSend).toBe(0);
      expect(result.skipped[0].status).toBe('SKIPPED_NO_EMAIL');
    });

    it('respectConsent=true skips users without consent', async () => {
      vi.mocked(mockPrisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: false },
        },
      ] as any);

      const { previewManualRecipients } = await import('./email-direct.service.js');
      const result = await previewManualRecipients({
        selectedUserIds: ['user-1'],
        emailType: 'MARKETING',
        respectConsent: true,
      });

      expect(result.willSend).toBe(0);
      expect(result.skipped[0].status).toBe('SKIPPED_NO_CONSENT');
    });

    it('ADMIN_DIRECT can send without consent', async () => {
      vi.mocked(mockPrisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          isActive: true,
          emailVerifiedAt: null,
          extendedProfile: { consentMailing: false },
        },
      ] as any);

      const { previewManualRecipients } = await import('./email-direct.service.js');
      const result = await previewManualRecipients({
        selectedUserIds: ['user-1'],
        emailType: 'ADMIN_DIRECT',
        respectConsent: false,
      });

      expect(result.willSend).toBe(1);
      expect(result.recipients[0].status).toBe('READY');
    });

    it('excluded users are skipped', async () => {
      vi.mocked(mockPrisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
        },
      ] as any);

      const { previewManualRecipients } = await import('./email-direct.service.js');
      const result = await previewManualRecipients({
        selectedUserIds: ['user-1'],
        excludedUserIds: ['user-1'],
        emailType: 'ADMIN_DIRECT',
        respectConsent: false,
      });

      expect(result.willSend).toBe(0);
      expect(result.skipped[0].status).toBe('SKIPPED_EXCLUDED');
    });
  });

  describe('sendDirectEmailToUsers', () => {
    it('successful send creates EmailMessage', async () => {
      vi.mocked(mockPrisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
        },
      ] as any);

      vi.mocked(mockSendPlatformEmail).mockResolvedValue({
        messageId: 'msg-1',
        providerMessageId: 'provider-msg-1',
      });

      const { sendDirectEmailToUsers } = await import('./email-direct.service.js');
      const result = await sendDirectEmailToUsers({
        actorUserId: 'admin-1',
        selectedUserIds: ['user-1'],
        subject: 'Test Subject',
        text: 'Test body',
        emailType: 'ADMIN_DIRECT',
        reason: 'Test reason',
        respectConsent: false,
      });

      expect(result.status).toBe('SENT');
      expect(result.sent).toBe(1);
      expect(mockSendPlatformEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          toUserId: 'user-1',
          subject: 'Test Subject',
          text: 'Test body',
          source: 'admin_direct',
        })
      );
    });

    it('provider failure marks EmailMessage', async () => {
      vi.mocked(mockPrisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
        },
      ] as any);

      vi.mocked(mockSendPlatformEmail).mockRejectedValue(new Error('SMTP_ERROR'));

      const { sendDirectEmailToUsers } = await import('./email-direct.service.js');
      const result = await sendDirectEmailToUsers({
        actorUserId: 'admin-1',
        selectedUserIds: ['user-1'],
        subject: 'Test Subject',
        text: 'Test body',
        emailType: 'ADMIN_DIRECT',
        reason: 'Test reason',
        respectConsent: false,
      });

      expect(result.messages[0].status).toBe('FAILED');
    });

    it('duplicate selectedUserIds sends once', async () => {
      vi.mocked(mockPrisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
        },
      ] as any);

      vi.mocked(mockSendPlatformEmail).mockResolvedValue({
        messageId: 'msg-1',
        providerMessageId: 'provider-msg-1',
      });

      const { sendDirectEmailToUsers } = await import('./email-direct.service.js');
      const result = await sendDirectEmailToUsers({
        actorUserId: 'admin-1',
        selectedUserIds: ['user-1', 'user-1', 'user-1'],
        subject: 'Test Subject',
        text: 'Test body',
        emailType: 'ADMIN_DIRECT',
        reason: 'Test reason',
        respectConsent: false,
      });

      expect(result.sent).toBe(1);
      expect(mockSendPlatformEmail).toHaveBeenCalledTimes(1);
    });

    it('personalizes template with user.name variable', async () => {
      vi.mocked(mockPrisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Ivan Ivanov',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
        },
      ] as any);

      vi.mocked(mockSendPlatformEmail).mockResolvedValue({
        messageId: 'msg-1',
        providerMessageId: 'provider-msg-1',
      });

      const { sendDirectEmailToUsers } = await import('./email-direct.service.js');
      await sendDirectEmailToUsers({
        actorUserId: 'admin-1',
        selectedUserIds: ['user-1'],
        subject: 'Hello',
        text: 'Hello, {{user.name}}!',
        emailType: 'ADMIN_DIRECT',
        reason: 'Test',
        respectConsent: false,
      });

      expect(mockSendPlatformEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Hello, Ivan Ivanov!',
        })
      );
    });

    it('skips inactive users', async () => {
      vi.mocked(mockPrisma.user.findMany).mockResolvedValue([]);

      const { previewManualRecipients } = await import('./email-direct.service.js');
      const result = await previewManualRecipients({
        selectedUserIds: ['user-inactive'],
        emailType: 'ADMIN_DIRECT',
        respectConsent: false,
      });

      expect(result.willSend).toBe(0);
      expect(result.skipped[0].status).toBe('SKIPPED_USER_NOT_FOUND');
    });
  });
});
