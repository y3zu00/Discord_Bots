import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TourAction = {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary";
};

export type TourStep = {
  id: string;
  title: string;
  description: string;
  target?: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
  extraContent?: React.ReactNode;
  actions?: TourAction[];
  primaryLabel?: string;
};

type OnboardingTourProps = {
  steps: TourStep[];
  currentStep: number;
  isOpen: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onFinish: () => void;
};

const HIGHLIGHT_PADDING = 12;
const OVERLAY_COLOR = "rgba(10, 13, 23, 0.78)";

const isBrowser = typeof window !== "undefined";

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  steps,
  currentStep,
  isOpen,
  onNext,
  onPrev,
  onSkip,
  onFinish,
}) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState(() => ({
    width: isBrowser ? window.innerWidth : 0,
    height: isBrowser ? window.innerHeight : 0,
  }));

  const activeStep = steps[currentStep];

  const updateRect = useCallback(() => {
    if (!isBrowser || !isOpen) {
      setTargetRect(null);
      return;
    }
    const step = steps[currentStep];
    if (!step) {
      setTargetRect(null);
      return;
    }

    if (step.target) {
      const el = document.querySelector(step.target) as HTMLElement | null;
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setTargetRect(rect);
          return;
        }
      }
    }

    setTargetRect(null);
  }, [currentStep, isOpen, steps]);

  useEffect(() => {
    if (!isBrowser) return;
    setContainer(document.body);
  }, []);

  useLayoutEffect(() => {
    if (!isBrowser) return;
    const raf = requestAnimationFrame(() => {
      updateRect();
    });
    return () => cancelAnimationFrame(raf);
  }, [updateRect]);

  useEffect(() => {
    if (!isBrowser) return;
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      updateRect();
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [updateRect]);

  useEffect(() => {
    if (!isOpen) return;
    updateRect();
  }, [isOpen, updateRect, activeStep?.target]);

  useEffect(() => {
    if (!isBrowser || !isOpen) return;
    const target = activeStep?.target ? document.querySelector(activeStep.target) : null;
    if (!target) return;
    const observer = new MutationObserver(() => updateRect());
    observer.observe(target, { attributes: true, childList: true, subtree: true });
    return () => observer.disconnect();
  }, [activeStep?.target, isOpen, updateRect]);

  const highlightRect = useMemo(() => {
    if (!targetRect || !isBrowser) return null;
    const top = Math.max(0, targetRect.top - HIGHLIGHT_PADDING);
    const left = Math.max(0, targetRect.left - HIGHLIGHT_PADDING);
    const right = Math.min(viewport.width, targetRect.right + HIGHLIGHT_PADDING);
    const bottom = Math.min(viewport.height, targetRect.bottom + HIGHLIGHT_PADDING);
    return {
      top,
      left,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }, [targetRect, viewport]);

  const overlaySegments = useMemo(() => {
    if (!highlightRect) {
      return [
        {
          key: "full",
          style: { top: 0, left: 0, width: "100%", height: "100%" as const },
        },
      ];
    }

    const segments: { key: string; style: React.CSSProperties }[] = [];
    const highlightBottom = highlightRect.top + highlightRect.height;
    const highlightRight = highlightRect.left + highlightRect.width;

    if (highlightRect.top > 0) {
      segments.push({
        key: "top",
        style: {
          top: 0,
          left: 0,
          width: "100%",
          height: highlightRect.top,
        },
      });
    }

    const bottomHeight = Math.max(0, viewport.height - highlightBottom);
    if (bottomHeight > 0) {
      segments.push({
        key: "bottom",
        style: {
          top: highlightBottom,
          left: 0,
          width: "100%",
          height: bottomHeight,
        },
      });
    }

    if (highlightRect.left > 0) {
      segments.push({
        key: "left",
        style: {
          top: highlightRect.top,
          left: 0,
          width: highlightRect.left,
          height: highlightRect.height,
        },
      });
    }

    const rightWidth = Math.max(0, viewport.width - highlightRight);
    if (rightWidth > 0) {
      segments.push({
        key: "right",
        style: {
          top: highlightRect.top,
          left: highlightRight,
          width: rightWidth,
          height: highlightRect.height,
        },
      });
    }

    return segments;
  }, [highlightRect, viewport]);

  const tooltipStyle = useMemo(() => {
    const margin = 24;
    const tooltipWidth = Math.min(420, viewport.width * 0.9);
    const tooltipHeight = 200; // Approximate height
    
    if (!highlightRect || !activeStep) {
      return {
        top: viewport.height / 2,
        left: viewport.width / 2,
        transform: "translate(-50%, -50%)",
      };
    }

    const centerX = highlightRect.left + highlightRect.width / 2;
    const centerY = highlightRect.top + highlightRect.height / 2;

    let top = highlightRect.top + highlightRect.height + margin;
    let left = centerX;
    let transform = "translate(-50%, 0)";
    let preferredPosition = activeStep.position;

    // Check if preferred position would cause overflow, and adjust
    switch (activeStep.position) {
      case "top":
        top = highlightRect.top - margin;
        transform = "translate(-50%, -100%)";
        // If not enough space above, use bottom instead
        if (top - tooltipHeight < margin) {
          top = highlightRect.top + highlightRect.height + margin;
          transform = "translate(-50%, 0)";
          preferredPosition = "bottom";
        }
        break;
      case "left":
        left = highlightRect.left - margin;
        top = centerY;
        transform = "translate(-100%, -50%)";
        // If not enough space on left, use right or bottom instead
        if (left - tooltipWidth < margin) {
          const rightEdge = highlightRect.left + highlightRect.width;
          if (rightEdge + margin + tooltipWidth <= viewport.width - margin) {
            // Use right side if there's space
            left = rightEdge + margin;
            transform = "translate(0, -50%)";
            preferredPosition = "right";
          } else {
            // Use bottom if right side is also cramped
            left = Math.min(centerX, viewport.width - tooltipWidth / 2 - margin);
            top = highlightRect.top + highlightRect.height + margin;
            transform = "translate(-50%, 0)";
            preferredPosition = "bottom";
          }
        }
        break;
      case "right":
        left = highlightRect.left + highlightRect.width + margin;
        top = centerY;
        transform = "translate(0, -50%)";
        // If not enough space on right, use left or bottom instead
        if (left + tooltipWidth > viewport.width - margin) {
          if (highlightRect.left - margin - tooltipWidth >= margin) {
            // Use left side if there's space
            left = highlightRect.left - margin;
            transform = "translate(-100%, -50%)";
            preferredPosition = "left";
          } else {
            // Use bottom if left side is also cramped
            left = Math.min(centerX, viewport.width - tooltipWidth / 2 - margin);
            top = highlightRect.top + highlightRect.height + margin;
            transform = "translate(-50%, 0)";
            preferredPosition = "bottom";
          }
        }
        break;
      case "center":
        top = centerY;
        left = centerX;
        transform = "translate(-50%, -50%)";
        break;
      case "bottom":
      default:
        top = highlightRect.top + highlightRect.height + margin;
        left = centerX;
        transform = "translate(-50%, 0)";
        break;
    }

    // Final clamp to ensure tooltip stays within viewport bounds
    top = clamp(top, margin, viewport.height - tooltipHeight - margin);
    
    // For horizontal positioning, account for tooltip width based on transform
    if (transform.includes("-100%")) {
      // Left-aligned: tooltip extends left from the position
      // Ensure left edge (left - tooltipWidth) doesn't go negative
      left = Math.max(margin + tooltipWidth, left);
      // Ensure right edge doesn't overflow
      left = Math.min(left, viewport.width - margin);
    } else if (transform.includes("translate(0")) {
      // Right-aligned: tooltip extends right from the position
      // Ensure right edge (left + tooltipWidth) doesn't overflow
      left = Math.min(left, viewport.width - tooltipWidth - margin);
      // Ensure left edge doesn't go negative
      left = Math.max(margin, left);
    } else {
      // Center-aligned: tooltip is centered on the position
      // Ensure tooltip doesn't overflow on either side
      left = clamp(left, tooltipWidth / 2 + margin, viewport.width - tooltipWidth / 2 - margin);
    }

    return { top, left, transform };
  }, [highlightRect, activeStep, viewport]);

  if (!container || !isOpen || !activeStep) return null;

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const primaryLabel = activeStep.primaryLabel ?? (isLastStep ? "Finish" : "Next");

  const handlePrimary = () => {
    if (isLastStep) {
      onFinish();
    } else {
      onNext();
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      onPrev();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[3000]">
      <div className="absolute inset-0 pointer-events-auto">
        {overlaySegments.map((segment) => (
          <div
            key={segment.key}
            className="absolute transition-all duration-200"
            style={{ ...segment.style, backgroundColor: OVERLAY_COLOR }}
          />
        ))}
      </div>

      {highlightRect && highlightRect.width > 0 && highlightRect.height > 0 && (
        <div
          className="pointer-events-none absolute rounded-2xl border border-primary/70 transition-all duration-200"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
            backgroundColor: "rgba(59, 130, 246, 0.08)",
            boxShadow: "0 24px 64px rgba(8, 11, 22, 0.35)",
          }}
        />
      )}

      <div className="absolute right-6 top-6 pointer-events-auto">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip tour
        </Button>
      </div>

      <div className="absolute inset-0 pointer-events-none">
        <div
          className={cn(
            "pointer-events-auto absolute w-[min(90vw,420px)] rounded-xl border border-border bg-background/95 shadow-2xl transition-all duration-200",
            "focus:outline-none"
          )}
          style={{
            position: "absolute",
            top: tooltipStyle.top,
            left: tooltipStyle.left,
            transform: tooltipStyle.transform,
          }}
        >
          <div className="p-5 space-y-4">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Step {currentStep + 1} of {steps.length}
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">{activeStep.title}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{activeStep.description}</p>
              {activeStep.extraContent && (
                <div className="text-sm text-muted-foreground">{activeStep.extraContent}</div>
              )}
              {activeStep.actions && activeStep.actions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {activeStep.actions.map((action) => (
                    <Button
                      key={action.label}
                      size="sm"
                      variant={action.variant ?? "outline"}
                      onClick={action.onClick}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                disabled={isFirstStep}
              >
                Previous
              </Button>
              <div className="flex gap-2">
                {!isLastStep && (
                  <Button variant="ghost" size="sm" onClick={onSkip}>
                    Skip
                  </Button>
                )}
                <Button size="sm" onClick={handlePrimary}>
                  {primaryLabel}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    container
  );
};

export default OnboardingTour;
