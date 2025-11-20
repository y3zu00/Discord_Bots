import React from "react";

type Plan = "Core" | "Pro" | "Elite" | "Admin" | string;

const PLAN_COLORS: Record<string, string> = {
  Admin: "#f59e0b", // amber-500
  Elite: "#06b6d4", // cyan-500 (turquoise)
  Pro: "#3b82f6",   // blue-500
  Core: "#7c3aed",  // violet-600 (purple)
};

interface PlanBadgeProps {
  label: Plan;
  className?: string;
}

const PlanBadge: React.FC<PlanBadgeProps> = ({ label, className }) => {
  const color = PLAN_COLORS[label] || undefined;
  const shadow = color ? `0 0 6px ${color}99, 0 0 12px ${color}59` : undefined;
  const style: React.CSSProperties = color
    ? { textShadow: shadow, ["--spark-color" as any]: color } // CSS var for particles
    : {};

  // Render small particles that burst from center in random directions
  const particles = Array.from({ length: 12 }).map((_, i) => {
    const theta = Math.random() * Math.PI * 2; // direction
    const dist = 12 + Math.random() * 14;      // travel distance px
    const dx = Math.cos(theta) * dist;
    const dy = Math.sin(theta) * dist;
    const delay = (i * 70) % 560;              // ms
    const duration = 420 + Math.floor(Math.random() * 220); // 420-640ms
    const size = 1 + Math.floor(Math.random() * 2); // 1-2px
    return (
      <span
        key={i}
        className="spark-particle"
        style={{
          animationDelay: `${delay}ms`,
          animationDuration: `${duration}ms`,
          width: size,
          height: size,
          // vector for the animation
          ['--dx' as any]: `${dx}px`,
          ['--dy' as any]: `${dy}px`,
        }}
      />
    );
  });

  return (
    <span className={`relative inline-block font-semibold ${className || ""}`} style={style}>
      {label}
      {color && (
        <span className="pointer-events-none absolute inset-0 overflow-visible">
          {particles}
        </span>
      )}
    </span>
  );
};

export default PlanBadge;


