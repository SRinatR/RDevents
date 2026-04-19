import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricCard } from './signal-primitives';

describe('MetricCard', () => {
  it('renders label and formatted numeric value', () => {
    render(<MetricCard label="Views" value={12345} />);

    expect(screen.getByText('Views')).toBeInTheDocument();
    expect(screen.getByText('12,345')).toBeInTheDocument();
  });
});
