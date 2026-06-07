interface ReportCardProps {
  label: string;
  current: number | string;
  previous: number | string;
  unit?: string;
  isPercentage?: boolean;
  invertColor?: boolean;
}

export default function ReportCard({
  label,
  current,
  previous,
  unit = "",
  isPercentage = false,
  invertColor = false,
}: ReportCardProps) {
  const curr = typeof current === "string" ? parseFloat(current) : current;
  const prev = typeof previous === "string" ? parseFloat(previous) : previous;

  const diff = prev === 0 ? 0 : ((curr - prev) / prev) * 100;
  const isPositive = invertColor ? diff < 0 : diff > 0;
  const isNeutral = diff === 0;

  const formatValue = (v: number) => {
    if (isPercentage) return `${v.toFixed(1)}%`;
    return v.toLocaleString() + unit;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{formatValue(curr)}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm text-gray-400">前週: {formatValue(prev)}</span>
        {!isNeutral && (
          <span
            className={`text-sm font-medium ${
              isPositive ? "text-green-600" : "text-red-600"
            }`}
          >
            {diff > 0 ? "+" : ""}
            {diff.toFixed(1)}%
            {isPositive ? " ↑" : " ↓"}
          </span>
        )}
      </div>
    </div>
  );
}
