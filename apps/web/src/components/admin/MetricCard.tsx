interface MetricCardProps {
  label: string;
  value: number | string;
  accent?: string;
}

export function MetricCard({ label, value, accent }: MetricCardProps) {
  const formatted = typeof value === 'number' ? Number(value).toLocaleString() : value;

  return (
    <div className="metric-card">
      <div className="metric-value" style={accent ? { color: accent } : undefined}>
        {formatted}
      </div>
      <div className="metric-label">{label}</div>
    </div>
  );
}
