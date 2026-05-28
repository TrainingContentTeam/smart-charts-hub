/* eslint-disable react-refresh/only-export-components */
import { useCallback, useMemo, useState } from "react";

type TickOrientation = "x" | "y";

type AnimatedAxisTickProps = {
  x?: number;
  y?: number;
  payload?: { value?: unknown };
  orientation: TickOrientation;
  onActiveChange: (label: string | null) => void;
  maxLength?: number;
};

type UseAnimatedBarLabelsOptions = {
  labelKey: string;
  orientation: TickOrientation;
  barColor: string;
  contrastColor?: string;
  maxLength?: number;
};

export function abbreviateChartLabel(value: unknown, maxLength = 14) {
  const label = String(value ?? "");
  if (label.length <= maxLength) return label;

  const words = label.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const initialism = words.map((word) => word[0]).join("").toUpperCase();
    if (initialism.length >= 2 && initialism.length <= maxLength) return initialism;
  }

  return `${label.slice(0, Math.max(1, maxLength - 3))}...`;
}

function getPayloadLabel(payload: unknown, labelKey: string) {
  const value = (payload as Record<string, unknown> | null)?.[labelKey];
  return value === undefined || value === null ? null : String(value);
}

function AnimatedAxisTick({
  x = 0,
  y = 0,
  payload,
  orientation,
  onActiveChange,
  maxLength,
}: AnimatedAxisTickProps) {
  const label = String(payload?.value ?? "");
  const abbreviated = abbreviateChartLabel(label, maxLength);
  const textAnchor = orientation === "y" ? "end" : "middle";
  const labelX = orientation === "y" ? -8 : 0;
  const labelY = orientation === "y" ? 4 : 16;

  return (
    <g
      transform={`translate(${x},${y})`}
      onMouseEnter={() => onActiveChange(label)}
      onMouseLeave={() => onActiveChange(null)}
      className="chart-abbrev-label"
      style={{ cursor: label === abbreviated ? "default" : "help" }}
    >
      {label !== abbreviated ? <title>{label}</title> : null}
      <text
        x={labelX}
        y={labelY}
        textAnchor={textAnchor}
        fill="hsl(var(--muted-foreground))"
        fontSize={12}
      >
        {abbreviated}
      </text>
    </g>
  );
}

export function useAnimatedBarLabels({
  labelKey,
  orientation,
  maxLength,
}: UseAnimatedBarLabelsOptions) {
  const [, setActiveLabel] = useState<string | null>(null);

  const tick = useCallback(
    (props: Record<string, unknown>) => (
      <AnimatedAxisTick
        {...props}
        orientation={orientation}
        onActiveChange={setActiveLabel}
        maxLength={maxLength}
      />
    ),
    [maxLength, orientation],
  );

  const barHoverProps = useMemo(
    () => ({
      onMouseEnter: (payload: unknown) => setActiveLabel(getPayloadLabel(payload, labelKey)),
      onMouseLeave: () => setActiveLabel(null),
    }),
    [labelKey],
  );

  return { tick, barHoverProps };
}
