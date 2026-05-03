import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MediaPreview } from './MediaPreview';

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: any) => <img {...props} />,
}));

describe('MediaPreview', () => {
  it('renders a fallback when no media URL is available', () => {
    render(<MediaPreview kind="image" alt="Broken asset" />);

    expect(screen.getByText('Превью недоступно')).toBeInTheDocument();
    expect(screen.getByText('Broken asset')).toBeInTheDocument();
  });
});
