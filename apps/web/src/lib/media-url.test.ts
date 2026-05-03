import { describe, expect, it } from 'vitest';
import { resolveMediaUrl, shouldDisableNextImageOptimization } from './media-url';

describe('media-url', () => {
  it('keeps absolute URLs as-is', () => {
    expect(resolveMediaUrl('https://cdn.example.test/file.jpg')).toBe('https://cdn.example.test/file.jpg');
  });

  it('resolves absolute upload paths against the API base', () => {
    expect(resolveMediaUrl('/uploads/events/photo.jpg')).toBe('http://localhost:4000/uploads/events/photo.jpg');
  });

  it('resolves storage keys through /uploads', () => {
    expect(resolveMediaUrl(null, 'events/event-1/media/photo.jpg')).toBe('http://localhost:4000/uploads/events/event-1/media/photo.jpg');
  });

  it('returns null without a URL or storage key', () => {
    expect(resolveMediaUrl(null, null)).toBeNull();
  });

  it('disables Next image optimization for the local API', () => {
    expect(shouldDisableNextImageOptimization('http://localhost:4000/uploads/photo.jpg')).toBe(true);
  });
});
