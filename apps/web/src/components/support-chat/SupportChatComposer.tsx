'use client';

import { FieldInput } from '@/components/ui/signal-primitives';

export function SupportChatComposer({
  value,
  onChange,
  onSend,
  sending,
  disabled,
  placeholder,
  sendLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  disabled?: boolean;
  placeholder: string;
  sendLabel: string;
}) {
  const canSend = value.trim().length > 0 && !sending && !disabled;

  return (
    <div className="support-chat-composer">
      <div className="support-chat-composer__input-wrap">
        <FieldInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || sending}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
        />
      </div>
      <button type="button" className="btn btn-primary btn-sm support-chat-composer__send" onClick={onSend} disabled={!canSend}>
        {sending ? '…' : sendLabel}
      </button>
    </div>
  );
}
