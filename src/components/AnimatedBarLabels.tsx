/* eslint-disable react-refresh/only-export-components */
import { useCallback, useMemo, useState } from "react";

type TickOrientation = "x" | "y";

type AnimatedAxisTickProps = {
  x?: number;
  y?: number;
  payload?: { value?: unknown };
  orientation: TickOrientation;
  activeLabel: string | null;
  onActiveChange: (label: string | null) => void;
  barColor: string;
  contrastColor?: string;
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

  return `${label.slice(0, Math.max(1, maxLength - 1))}…`;
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
  activeLabel,
  onActiveChange,
  barColor,
  contrastColor = "hsl(var(--primary-foreground))",
  maxLength,
}: AnimatedAxisTickProps) {
  const label = String(payload?.value ?? "");
  const abbreviated = abbreviateChartLabel(label, maxLength);
  const isActive = activeLabel === label;
  const textAnchor = orientation === "y" ? "end" : "middle";
  const labelX = orientation === "y" ? -8 : 0;
  const labelY = orientation === "y" ? 4 : 16;
  const pillX = orientation === "y" ? 8 : 0;
  const pillY = orientation === "y" ? -12 : -18;
  const pillWidth = Math.max(72, Math.min(260, label.length * 7.2 + 24));
  const pillTextX = orientation === "y" ? pillX + 12 : 0;
  const pillRectX = orientation === "y" ? pillX : -pillWidth / 2;

  return (
    <g
      transform={`translate(${x},${y})`}
      onMouseEnter={() => onActiveChange(label)}
      onMouseLeave={() => onActiveChange(null)}
      className="chart-abbrev-label"
      style={{ cursor: label === abbreviated ? "default" : "help" }}
    >
      <text
        x={labelX}
        y={labelY}
        textAnchor={textAnchor}
        fill="hsl(var(--muted-foreground))"
        fontSize={12}
      >
        {abbreviated}
      </text>
      <g
        className={isActive ? "chart-abbrev-label__full chart-abbrev-label__full--active" : "chart-abbrev-label__full"}
        pointerEvents="none"
      >
        <rect
          x={pillRectX}
          y={pillY}
          width={pillWidth}
          height={24}
          rx={5}
          fill={barColor}
          stroke="hsl(var(--background))"
          strokeWidth={1}
        />
        <text
          x={pillTextX}
          y={pillY + 16}
          textAnchor={orientation === "y" ? "start" : "middle"}
          fill={contrastColor}
          fontSize={12}
          fontWeight={600}
        >
          {label}
        </text>
      </g>
    </g>
  );
}

export function useAnimatedBarLabels({
  labelKey,
  orientation,
  barColor,
  contrastColor,
  maxLength,
}: UseAnimatedBarLabelsOptions) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const tick = useCallback(
    (props: Record<string, unknown>) => (
      <AnimatedAxisTick
        {...props}
        orientation={orientation}
        activeLabel={activeLabel}
        onActiveChange={setActiveLabel}
        barColor={barColor}
        contrastColor={contrastColor}
        maxLength={maxLength}
      />
    ),
    [activeLabel, barColor, contrastColor, maxLength, orientation],
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
