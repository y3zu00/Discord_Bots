import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Zap, Crown, Shield, Star } from "lucide-react";

const plans = [
  {
    name: "Free",
    priceMonthly: "$0",
    priceYearly: "$0",
    originalMonthly: null,
    originalYearly: null,
    tagline: "Discord",
    description: "Perfect for traders just starting out",
    features: [
      "Discord community access",
      "Chat with pro traders",
      "Free PDFs, books, + much more",
      "Market discussion channels",
    ],
    includesAll: null,
    cta: {
      label: "Join Now",
      href: "https://whop.com/jack-of-all-trades-official",
    },
    tone: "primary",
    icon: Shield,
  },
  {
    name: "Core",
    priceMonthly: "$29.99",
    priceYearly: "$299.90",
    originalMonthly: "$39.99",
    originalYearly: "$359.90",
    tagline: "Discord + Platform",
    description: "Ideal for those ready to trade with AI",
    features: [
      "AI-powered daily signals",
      "Custom watchlist & price alerts",
      "Live market news feed",
      "Daily questions bot & answer archive",
      "TradingView screener + dashboard widgets",
      "Priority support",
      "Monthly giveaways (1 ticket)",
    ],
    includesAll: null,
    cta: {
      label: "Try Now",
      href: "https://whop.com/jack-of-all-trades-official",
    },
    tone: "primary",
    icon: Zap,
  },
  {
    name: "Pro",
    priceMonthly: "$69.99",
    priceYearly: "$699.90",
    originalMonthly: "$99.99",
    originalYearly: "$839.90",
    tagline: "Discord + Platform",
    description: "Best for traders seeking mastery",
    features: [
      "AI Mentor (chat + deep analysis)",
      "Advanced education courses",
      "Pine Script code assistant",
      "Ghosted Night AI strategy access",
      "AI options bot (flow intelligence)",
      "Market analysis bot (chart upload)",
      "Indicator library access",
      "Monthly giveaways (2 tickets)",
    ],
    includesAll: "Core",
    cta: {
      label: "Try Now",
      href: "https://whop.com/jack-of-all-trades-official",
    },
    popular: true,
    tone: "accent",
    icon: Star,
  },
  {
    name: "Elite",
    priceMonthly: "$399.99",
    priceYearly: "$4,399.90",
    originalMonthly: "$599.99",
    originalYearly: "$5,999.90",
    tagline: "Discord + Platform + VIP",
    description: "Perfect for VIPs & high-volume traders",
    features: [
      "1-on-1 live mentorship",
      "VIP-only channels",
      "Unlimited memecoin snipes",
      "AI Whale Bot (Discord agent)",
      "Early access to features",
      "Monthly giveaways (5 tickets)",
    ],
    includesAll: "Pro",
    cta: {
      label: "Book a Call",
      href: "https://calendly.com/",
    },
    tone: "elite",
    icon: Crown,
  },
];

const toneToClasses = (tone?: string) => {
  if (tone === "accent") return { pill: "bg-amber-500/10 text-amber-400" };
  if (tone === "elite") return { pill: "bg-cyan-500/10 text-cyan-400" };
  return { pill: "bg-blue-500/10 text-blue-400" };
};

const PricingSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<{ x: number; y: number; color: 'accent' | 'primary'; radius: number }[]>([]);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const thresholds: number[] = [0, 0.15, 0.35, 0.5, 0.75, 1];
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const ratio = entry.intersectionRatio;
        setIsVisible(entry.isIntersecting && ratio >= 0.35);
      },
      { threshold: thresholds, rootMargin: "0px 0px -20% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Interactive dots highlight overlay
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
        if (!hasSmooth) {
          smoothX = target.x;
          smoothY = target.y;
          hasSmooth = true;
        } else {
          smoothX += (target.x - smoothX) * 0.04;
          smoothY += (target.y - smoothY) * 0.04;
        }
        fade = Math.min(1, fade + 0.08);
      } else {
        fade *= 0.85;
      }

      if (fade > 0.01) {
        ctx.filter = 'blur(0.4px)';
        for (const dot of dotsRef.current) {
          const dx = smoothX - dot.x;
          const dy = smoothY - dot.y;
          const dist = Math.hypot(dx, dy);
          if (dist < influence) {
            const t = 1 - dist / influence;
            const intensity = easeOutQuad(Math.max(0, Math.min(1, t)));
            ctx.globalAlpha = (0.08 + 0.35 * intensity) * fade;
            ctx.fillStyle = dot.color === 'accent' ? accentColor : primaryColor;
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, dot.radius + 0.4 * intensity, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    const onMove = (e: MouseEvent) => {
      const rect = sectionEl.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (!rafRef.current) rafRef.current = requestAnimationFrame(loop);
    };
    const onLeave = () => { mouseRef.current = null; };

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

  return (
    <section id="pricing" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden bg-gradient-to-br from-[#0b1220] via-background to-[#0b1220] scroll-mt-28">
      {/* Top glow divider */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 z-30">
        <div className="h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
        <div className="mx-10 h-10 bg-gradient-to-r from-accent/30 via-foreground/15 to-accent/30 blur-2xl opacity-25" />
      </div>

      {/* Subtle grid background with glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 20% 20%, hsl(var(--accent)) 2px, transparent 2px), radial-gradient(circle at 80% 80%, hsl(var(--primary)) 2px, transparent 2px), radial-gradient(circle at 50% 50%, hsl(var(--accent)) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(12,20,35,0.5),transparent_60%)]" />
      </div>

      {/* Canvas highlight overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        style={{ mixBlendMode: 'screen' }}
      />

      <div className="relative z-20 container mx-auto px-4 sm:px-6 lg:px-8 max-w-[1600px]">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">Pricing</h2>
          <div className="mx-auto w-28 h-[2px] rounded-full bg-gradient-to-r from-transparent via-accent/50 to-transparent mb-6" />
          <p className="text-base text-muted-foreground/80 max-w-2xl mx-auto mb-8">
            Start free. Upgrade when you're ready. Cancel anytime.
          </p>
          
          {/* Toggle */}
          <div className="inline-flex items-center relative rounded-lg border border-blue-500/20 bg-background/80 backdrop-blur-xl p-1 shadow-lg">
            <button
              onClick={() => setBilling('monthly')}
              className={`relative z-10 px-8 py-3 rounded-md font-semibold text-sm transition-all duration-300 ${billing==='monthly' ? 'bg-blue-500 text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`relative z-10 px-8 py-3 rounded-md font-semibold text-sm transition-all duration-300 ${billing==='yearly' ? 'bg-blue-500 text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Yearly
              <span className="ml-2 text-[10px] text-green-400 font-bold">Save 17%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {plans.map((p, idx) => {
            const tone = toneToClasses(p.tone);
            const Icon = p.icon;
            const originalPrice = billing === 'monthly' ? p.originalMonthly : p.originalYearly;
            return (
              <div
                key={p.name}
                className={`group relative rounded-2xl border p-6 sm:p-8 flex flex-col transition-all duration-300 hover:-translate-y-1 min-h-[520px] sm:min-h-[580px] ${
                  p.popular
                    ? 'border-yellow-500/40 bg-card/60 shadow-[0_16px_48px_rgba(234,179,8,0.12)] hover:shadow-[0_20px_60px_rgba(234,179,8,0.18)] glow-border-animated'
                    : 'border-border/20 bg-card/40 shadow-[0_12px_36px_rgba(0,0,0,0.3)] hover:shadow-[0_16px_44px_rgba(0,0,0,0.4)]'
                } backdrop-blur-xl animate-fade-up`}
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                {/* Subtle hover glow */}
                <div className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500 ${
                  p.name === 'Elite' ? 'from-cyan-500/15 to-teal-500/15' : p.popular ? 'from-yellow-500/15 to-amber-500/15' : 'from-blue-500/15 to-cyan-500/15'
                }`} />
                
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <div className="relative px-4 py-1 text-[10px] font-bold rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black shadow-lg">
                      MOST POPULAR
                    </div>
                  </div>
                )}

                {/* Plan name & tagline */}
                <div className="mb-4 sm:mb-5">
                  <h3 className={`text-xl sm:text-2xl font-extrabold mb-1 ${p.popular ? 'text-yellow-400' : p.name==='Elite' ? 'text-cyan-400' : 'text-foreground'}`}>
                    {p.name}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground/70 uppercase tracking-wide font-semibold">{p.tagline}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2">{p.description}</p>
                </div>

                {/* Price */}
                <div className="mb-5 sm:mb-6">
                  {originalPrice && (
                    <div className="text-xs sm:text-sm text-muted-foreground/60 line-through mb-1">{originalPrice}</div>
                  )}
                  <div className="flex items-baseline gap-2">
                    <span className={`text-4xl sm:text-5xl font-extrabold tabular-nums ${p.popular ? 'text-yellow-400' : p.name==='Elite' ? 'text-cyan-400' : 'text-foreground'}`}>
                      {billing==='monthly' ? p.priceMonthly : p.priceYearly}
                    </span>
                    <span className="text-xs sm:text-sm text-muted-foreground font-medium">{billing==='monthly' ? '/month' : '/year'}</span>
                  </div>
                  {billing==='yearly' && p.name !== 'Free' && (
                    <div className="mt-2 text-[10px] sm:text-[11px] inline-flex items-center gap-1 rounded-md px-2 py-1 bg-green-500/10 text-green-400 ring-1 ring-green-500/20">
                      <Check className="h-3 w-3" />
                      <span>2 months free</span>
                    </div>
                  )}
                </div>

                {/* Features */}
                <div className="mb-6 sm:mb-8 flex-1">
                  <ul className="space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-xs sm:text-[13px] text-foreground/90">
                        <span className={`flex-shrink-0 w-1 h-1 rounded-full ${p.name==='Elite' ? 'bg-cyan-400' : p.popular ? 'bg-yellow-400' : 'bg-blue-400'}`} />
                        <span className="leading-relaxed">{f}</span>
                      </li>
                    ))}
                  </ul>
                  {p.includesAll && (
                    <div className="mt-3 sm:mt-4 pt-3 border-t border-border/30">
                      <p className="text-[10px] sm:text-[11px] text-muted-foreground/60 italic">+ Everything in {p.includesAll}</p>
                    </div>
                  )}
                </div>

                {/* CTA */}
                <a
                  href={p.cta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group mt-auto relative inline-flex w-full items-center justify-center gap-2 px-5 sm:px-6 py-3 sm:py-4 rounded-xl text-sm sm:text-base font-bold transition-all duration-300 overflow-hidden ${
                    p.name === 'Elite'
                      ? 'text-white bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 shadow-lg shadow-cyan-500/20'
                      : p.popular
                        ? 'text-black bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 shadow-lg shadow-yellow-500/20'
                        : 'text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 shadow-lg shadow-blue-500/15'
                  }`}
                >
                  <span className="relative z-10">{p.cta.label}</span>
                  <ArrowUpRight className="relative z-10 w-4 sm:w-5 h-4 sm:h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
                </a>

                {/* Subtle hover ring */}
                <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} style={{ 
                  boxShadow: p.popular 
                    ? '0 0 0 1px rgba(234,179,8,0.3), 0 0 40px rgba(234,179,8,0.15) inset'
                    : p.name === 'Elite'
                      ? '0 0 0 1px rgba(6,182,212,0.3), 0 0 40px rgba(6,182,212,0.12) inset'
                      : '0 0 0 1px rgba(59,130,246,0.25), 0 0 35px rgba(59,130,246,0.1) inset'
                }} />
              </div>
            );
          })}
        </div>

        {/* Optional: Add comparison table or trust badges below */}
      </div>
    </section>
  );
};

export default PricingSection;
