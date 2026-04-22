'use client';

import type { SupportAttachment } from './support.types';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SupportAttachmentList({ attachments }: { attachments: SupportAttachment[] }) {
  if (!attachments.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
      {attachments.map((att) =>
        IMAGE_TYPES.has(att.mimeType) ? (
          <a key={att.id} href={att.publicUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block' }}>
            {att.publicUrl.startsWith('data:') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={att.publicUrl}
                alt={att.filename}
                style={{ maxWidth: '220px', maxHeight: '180px', borderRadius: '8px', objectFit: 'cover', display: 'block', border: '1px solid var(--color-border-soft)' }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={att.publicUrl}
                alt={att.filename}
                loading="lazy"
                decoding="async"
                style={{ maxWidth: '220px', maxHeight: '180px', borderRadius: '8px', objectFit: 'cover', display: 'block', border: '1px solid var(--color-border-soft)' }}
              />
            )}
          </a>
        ) : (
          <a
            key={att.id}
            href={att.publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '8px',
              background: 'var(--color-bg-subtle)',
              border: '1px solid var(--color-border)',
              fontSize: '0.8125rem',
              color: 'var(--color-primary)',
              textDecoration: 'none',
              maxWidth: '100%',
            }}
          >
            <FileIcon />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>{formatBytes(att.sizeBytes)}</span>
          </a>
        ),
      )}
    </div>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}