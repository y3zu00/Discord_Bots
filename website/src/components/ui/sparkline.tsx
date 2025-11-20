import React from "react";

type SparklineProps = {
  values: number[];
  width?: number; // logical width for viewBox
  height?: number;
  stroke?: string; // CSS color string
  strokeWidth?: number;
  fill?: string; // CSS color string (area fill)
  className?: string;
  animateTick?: boolean; // adds subtle moving dot
  responsive?: boolean; // when true, svg width is 100% and uses viewBox
};

function normalize(values: number[], width: number, height: number) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return [x, y] as const;
  });
  return { points, min, max };
}

const Sparkline: React.FC<SparklineProps> = ({
  values,
  width = 160,
  height = 32,
  stroke = "hsl(var(--accent))",
  strokeWidth = 2,
  fill = "transparent",
  className,
  animateTick = false,
  responsive = false,
}) => {
  const { points } = normalize(values, width, height);
  const path = points.map((p) => p.join(",")).join(" ");

  return (
    <svg
      width={responsive ? "100%" : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      {fill !== "transparent" && (
        <polyline
          points={`0,${height} ${path} ${width},${height}`}
          fill={fill}
          stroke="none"
        />
      )}
      <polyline
        points={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {animateTick && points.length > 0 && (
        <circle r={2.2} fill={stroke}>
          <animateMotion dur="1.6s" repeatCount="indefinite" path={`M ${path}`} />
        </circle>
      )}
    </svg>
  );
};

export default Sparkline;


