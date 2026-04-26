import { describe, expect, it } from 'vitest';
import { renderEmailContent } from '../email/email-renderer.service.js';
import { buildDefaultRecipientVariables } from '../email/email-renderer.service.js';

describe('email-renderer.service', () => {
  describe('renderEmailContent', () => {
    it('renders known variables', () => {
      const result = renderEmailContent({
        subject: 'Hello {{name}}',
        textBody: 'Dear {{firstName}}',
        htmlBody: '<p>Hi {{name}}!</p>',
        variables: {
          name: 'John',
          firstName: 'John',
        },
      });

      expect(result.subject).toBe('Hello John');
      expect(result.text).toBe('Dear John');
      expect(result.html).toBe('<p>Hi John!</p>');
      expect(result.warnings).toHaveLength(0);
    });

    it('reports unknown variables', () => {
      const result = renderEmailContent({
        subject: 'Hello {{unknownVar}}',
        textBody: 'Body',
        htmlBody: '<p>HTML</p>',
        variables: { name: 'John' },
      });

      expect(result.warnings).toContain('Unknown variable: unknownVar');
      expect(result.unknownVariables).toContain('unknownVar');
    });

    it('renders multiple variables', () => {
      const result = renderEmailContent({
        subject: '{{greeting}} {{name}}',
        textBody: 'Email: {{email}}\nProfile: {{profileUrl}}',
        htmlBody: '<p>{{name}}</p><a href="{{unsubscribeUrl}}">Unsubscribe</a>',
        variables: {
          greeting: 'Hello',
          name: 'Jane',
          email: 'jane@test.com',
          profileUrl: 'https://example.com/profile',
          unsubscribeUrl: 'https://example.com/unsubscribe',
        },
      });

      expect(result.subject).toBe('Hello Jane');
      expect(result.text).toContain('jane@test.com');
      expect(result.html).toContain('https://example.com/unsubscribe');
    });

    it('handles missing variables gracefully', () => {
      const result = renderEmailContent({
        subject: '{{name}}',
        textBody: '{{body}}',
        htmlBody: '<p>{{content}}</p>',
        variables: { name: 'Test' },
      });

      expect(result.subject).toBe('Test');
      expect(result.text).toBe('');
      expect(result.html).toBe('<p></p>');
    });
  });

  describe('buildDefaultRecipientVariables', () => {
    it('creates variables with email', () => {
      const vars = buildDefaultRecipientVariables({
        email: 'user@example.com',
      });

      expect(vars.email).toBe('user@example.com');
      expect(vars.name).toBe('user@example.com');
      expect(vars.unsubscribeUrl).toContain('/unsubscribe?token=');
    });

    it('uses name when provided', () => {
      const vars = buildDefaultRecipientVariables({
        email: 'user@example.com',
        name: 'John Doe',
      });

      expect(vars.name).toBe('John Doe');
      expect(vars.firstName).toBe('John');
      expect(vars.lastName).toBe('Doe');
    });

    it('includes userId in profileUrl when provided', () => {
      const vars = buildDefaultRecipientVariables({
        email: 'user@example.com',
        userId: 'user-123',
      });

      expect(vars.profileUrl).toContain('user-123');
    });

    it('generates unsubscribe token with broadcastId', () => {
      const vars = buildDefaultRecipientVariables({
        email: 'user@example.com',
        broadcastId: 'broadcast-456',
        topic: 'MARKETING',
      });

      expect(vars.unsubscribeUrl).toContain('/unsubscribe?token=');
      expect(vars.unsubscribeUrl).not.toContain('token=preview');
    });

    it('handles empty name', () => {
      const vars = buildDefaultRecipientVariables({
        email: 'test@example.com',
        name: '',
      });

      expect(vars.name).toBe('test@example.com');
    });
  });
});
