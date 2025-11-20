import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const faqs = [
  {
    question: "Is the 87% win rate accurate?",
    answer: "Yes. Backtested across multiple market conditions. The 87% represents actual performance over 6 months with transparent reporting."
  },
  {
    question: "How does the AI work?",
    answer: "Combines price action, volume analysis, and market sentiment using machine learning to identify high-probability setups with clear entry/exit levels."
  },
  {
    question: "What if I'm a beginner?",
    answer: "Perfect! Start with our free Discord community, then use the AI mentor for personalized guidance. Signals include clear explanations."
  },
  {
    question: "Do I need TradingView Pro?",
    answer: "Our indicators work on TradingView's free plan. Pro features enhance the experience but aren't required."
  },
  {
    question: "How much time daily?",
    answer: "Minimal. Signals delivered once daily with clear entry/exit points. Most traders spend 10-15 minutes managing positions."
  },
  {
    question: "Money-back guarantee?",
    answer: "Yes. Try Pro risk-free for 7 days. Not satisfied? Full refund, no questions asked."
  }
];

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<{ x: number; y: number; color: 'accent' | 'primary'; radius: number }[]>([]);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Interactive dots highlight overlay (exactly like AI Systems)
  useEffect(() => {
    const sectionEl = sectionRef.current;
    const canvas = canvasRef.current;
    if (!sectionEl || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gridSize = 80;
    let accentColor = `hsl(${getComputedStyle(sectionEl).getPropertyValue('--accent').trim()})`;
    let primaryColor = `hsl(${getComputedStyle(sectionEl).getPropertyValue('--primary').trim()})`;

    const computeDots = (w: number, h: number) => {
      const dots: { x: number; y: number; color: 'accent' | 'primary'; radius: number }[] = [];
      for (let y = 0; y <= h; y += gridSize) {
        for (let x = 0; x <= w; x += gridSize) {
          // Match AI Systems/Pricing pattern: top-left (accent), bottom-right (primary)
          dots.push({ x: x + gridSize * 0.2, y: y + gridSize * 0.2, color: 'accent', radius: 2 });
          dots.push({ x: x + gridSize * 0.8, y: y + gridSize * 0.8, color: 'primary', radius: 2 });
          dots.push({ x: x + gridSize * 0.5, y: y + gridSize * 0.5, color: 'accent', radius: 1 });
        }
      }
      dotsRef.current = dots;
    };

    const resize = () => {
      const rect = sectionEl.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      accentColor = `hsl(${getComputedStyle(sectionEl).getPropertyValue('--accent').trim()})`;
      primaryColor = `hsl(${getComputedStyle(sectionEl).getPropertyValue('--primary').trim()})`;
      computeDots(rect.width, rect.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    resize();

    // Match Systems influence and easing
    const influence = 80;
    let smoothX = 0;
    let smoothY = 0;
    let hasSmooth = false;
    let fade = 0;
    const easeOutQuad = (x: number) => 1 - (1 - x) * (1 - x);

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const target = mouseRef.current;
      if (target) {
        if (!hasSmooth) { smoothX = target.x; smoothY = target.y; hasSmooth = true; }
        else { smoothX += (target.x - smoothX) * 0.08; smoothY += (target.y - smoothY) * 0.08; }
        fade = Math.min(1, fade + 0.08);
      } else { fade *= 0.85; }

      if (fade > 0.01) {
        ctx.filter = 'blur(0.4px)';
        for (const dot of dotsRef.current) {
          const dx = smoothX - dot.x; const dy = smoothY - dot.y; const dist = Math.hypot(dx, dy);
          if (dist < influence) {
            const t = 1 - dist / influence;
            const intensity = easeOutQuad(Math.max(0, Math.min(1, t)));
            ctx.globalAlpha = (0.08 + 0.35 * intensity) * fade;
            ctx.fillStyle = dot.color === 'accent' ? accentColor : primaryColor;
            ctx.beginPath(); ctx.arc(dot.x, dot.y, dot.radius + 0.4 * intensity, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.filter = 'none'; ctx.globalAlpha = 1;
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    const onMove = (e: MouseEvent) => {
      const rect = sectionEl.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (!rafRef.current) rafRef.current = requestAnimationFrame(loop);
    };
    const onLeave = () => { mouseRef.current = null; };

    // Initialize sizes/dots once
    resize();

    sectionEl.addEventListener('mousemove', onMove);
    sectionEl.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', resize);
    return () => {
      sectionEl.removeEventListener('mousemove', onMove);
      sectionEl.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', resize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openIndex !== null) {
        setOpenIndex(null);
      }
    };

    if (openIndex !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openIndex]);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" ref={sectionRef} className="relative pt-10 pb-12 lg:pt-[3rem] lg:pb-16 scroll-mt-28 lg:scroll-mt-[110px] overflow-hidden bg-gradient-to-br from-slate-900/50 via-background to-slate-900/50">
      {/* Subtle glow backdrop */}
      <div className="pointer-events-none absolute inset-x-20 top-1/2 -translate-y-1/2 h-32 rounded-full blur-3xl opacity-10 bg-gradient-to-r from-accent/30 via-foreground/20 to-accent/30 z-0" />
      
      {/* Enhanced background pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 20% 20%, hsl(var(--accent)) 2px, transparent 2px), radial-gradient(circle at 80% 80%, hsl(var(--primary)) 2px, transparent 2px), radial-gradient(circle at 50% 50%, hsl(var(--accent)) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          transform: 'translateZ(0)',
          willChange: 'transform'
        }} />
      </div>

      {/* Canvas highlight overlay to brighten background dots near cursor */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        style={{ mixBlendMode: 'screen' }}
      />

      <div className={`relative z-20 max-w-5xl mx-auto px-6 lg:px-8 transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight tracking-tight mb-6">
            <span className="text-foreground">Frequently Asked </span>
            <span className="text-accent">Questions</span>
          </h2>
        </div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="group relative rounded-xl border border-border/15 bg-card/15 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-border/30 hover:bg-card/25 hover:shadow-lg hover:shadow-accent/5"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFAQ(index);
                }}
                className="w-full px-6 py-3 text-left flex items-center justify-between gap-4 hover:bg-card/10 transition-all duration-200"
              >
                <h3 className="text-base sm:text-lg font-medium text-foreground italic pr-4 group-hover:text-accent transition-colors duration-200">
                  {faq.question}
                </h3>
                <div className="flex-shrink-0">
                  {openIndex === index ? (
                    <ChevronUp className="w-5 h-5 text-accent transition-all duration-300 transform rotate-180" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-all duration-300 transform rotate-0" />
                  )}
                </div>
              </button>
              
              <div
                className={`overflow-hidden transition-all duration-500 ease-out ${
                  openIndex === index ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="px-6 pb-4">
                  <div className="h-px bg-gradient-to-r from-transparent via-border/20 to-transparent mb-3" />
                  <p className="text-sm sm:text-base text-muted-foreground/85 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
