import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Brain, Code, BookOpen, Newspaper, TrendingUp, HelpCircle, Zap, Target, BarChart3, Radar } from "lucide-react";
import MagneticButton from "@/components/MagneticButton";
import knowledgePfp from "@/assets/JackOfAllKnowledge.png";
import newsPfp from "@/assets/joatnewspfp.png";
import questionsPfp from "@/assets/joatquestions.png";
import signalsPfp from "@/assets/joatsignalspfp.png";
import analysisPfp from "@/assets/joatanalysispfp.png";
import codesPfp from "@/assets/joatcodespfp.png";
import optionsPfp from "@/assets/jackofalloptions.png";
import whaleBotPfp from "@/assets/jackofallwhales.png";
import sharinganGif from "@/assets/sharingan-ringan.gif";
import redsnowGif from "@/assets/redsnow2.mp4";
import tradingviewLogo from "@/assets/tradingviewlogo.png";
import joatLogo from "@/assets/joat-logo-nobg.png";
import joatText from "@/assets/joat-text.png";
import whaleLogo from "@/assets/whalefinderpro.png";
import skywhalesGif from "@/assets/skywhales.gif";
import rezerowhalesGif from "@/assets/rezerowhales.mp4";
import iceElvesPfp from "@/assets/ice-elves.png";
import iceElvesBg from "@/assets/ice-elves.mp4";
import ghostedNightPfp from "@/assets/ghostednight.png";
import ghostedNightBg from "@/assets/ghostednight.gif";

const AISystemsSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<{ x: number; y: number; color: 'accent' | 'primary'; radius: number }[]>([]);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Canvas-based highlight that brightens ONLY the existing background dots
  useEffect(() => {
    const sectionEl = sectionRef.current;
    const canvas = canvasRef.current;
    if (!sectionEl || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gridSize = 80; // must match CSS backgroundSize

    let accentColor = `hsl(${getComputedStyle(sectionEl).getPropertyValue('--accent').trim()})`;
    let primaryColor = `hsl(${getComputedStyle(sectionEl).getPropertyValue('--primary').trim()})`;

    const computeDots = (w: number, h: number) => {
      const dots: { x: number; y: number; color: 'accent' | 'primary'; radius: number }[] = [];
      for (let y = 0; y <= h; y += gridSize) {
        for (let x = 0; x <= w; x += gridSize) {
          // Same relative positions as the CSS radial-gradient pattern
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
      // Recompute colors in case theme variables changed
      accentColor = `hsl(${getComputedStyle(sectionEl).getPropertyValue('--accent').trim()})`;
      primaryColor = `hsl(${getComputedStyle(sectionEl).getPropertyValue('--primary').trim()})`;
      computeDots(rect.width, rect.height);
      // Draw once after resize to clear stale content
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    // Smoothed cursor tracking and eased highlight for a cleaner look
    const influence = 80; // pixels, smaller area for a tighter look
    let smoothX = 0;
    let smoothY = 0;
    let hasSmooth = false;
    let fade = 0; // 0..1

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
          // Lerp towards the cursor for a subtle delay
          smoothX += (target.x - smoothX) * 0.08;
          smoothY += (target.y - smoothY) * 0.08;
        }
        fade = Math.min(1, fade + 0.08);
      } else {
        // Fade out when the cursor leaves
        fade *= 0.85;
      }

      if (fade > 0.01) {
        ctx.filter = 'blur(0.4px)';
        for (const dot of dotsRef.current) {
          const dx = smoothX - dot.x;
          const dy = smoothY - dot.y;
          const dist = Math.hypot(dx, dy);
          if (dist < influence) {
            const t = 1 - dist / influence; // 0..1
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
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    const onLeave = () => {
      mouseRef.current = null;
    };

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

  const systems = [
    {
      name: "Analysis",
      icon: Brain,
      description: "Send a picture of any market chart and get instant AI-powered analysis with entry/exit points, trend analysis, and risk assessment.",
      features: ["Chart Analysis", "Entry/Exit Points", "Risk Assessment", "Trend Detection"],
      color: "from-blue-500 to-cyan-500",
      status: "active",
      image: analysisPfp,
    },
    {
      name: "Codes",
      icon: Code,
      description: "Get expert Pine Script coding help. Our AI assists with strategy development, debugging, and optimization for TradingView indicators.",
      features: ["Pine Script Help", "Strategy Development", "Code Debugging", "Optimization"],
      color: "from-purple-500 to-pink-500",
      status: "active",
      image: codesPfp,
    },
    {
      name: "Knowledge",
      icon: BookOpen,
      description: "Your personal AI trading mentor with comprehensive course knowledge. Get instant answers on trading strategies, risk management, technical analysis, and market psychology.",
      features: ["Course Knowledge", "Strategy Guidance", "Risk Management", "Technical Analysis"],
      color: "from-green-500 to-emerald-500",
      status: "active",
      image: knowledgePfp,
    },
    {
      name: "News",
      icon: Newspaper,
      description: "Stay updated with real-time market news and analysis. Our AI filters and summarizes the most relevant market-moving information.",
      features: ["Real-time News", "Market Analysis", "News Filtering", "Impact Assessment"],
      color: "from-orange-500 to-red-500",
      status: "active",
      image: newsPfp,
    },
    {
      name: "Signals",
      icon: TrendingUp,
      description: "Professional-grade trading signals with 87% win rate. Get daily automated signals, portfolio tracking, watchlists, price alerts, and interactive charts with multi-timeframe analysis.",
      features: ["Daily Signals", "87% Win Rate", "Portfolio Tracking", "Interactive Charts"],
      color: "from-yellow-500 to-orange-500",
      status: "active",
      image: signalsPfp,
    },
    {
      name: "Questions",
      icon: HelpCircle,
      description: "Get daily trading questions delivered to your inbox. Challenge yourself with intermediate to advanced questions covering technical analysis, risk management, and market psychology.",
      features: ["Daily Questions", "Intermediate-Advanced", "Knowledge Testing", "Trading Challenges"],
      color: "from-indigo-500 to-purple-500",
      status: "active",
      image: questionsPfp,
    },
    {
      name: "Options",
      icon: Zap,
      description: "Real-time options-flow intelligence with multi-venue sweeps, dark-pool context, and auto threads so traders can react with confidence.",
      features: ["Sweep Detection", "Dark Pool Overlay", "Interactive Discord Controls", "Backtests & Reports"],
      color: "from-amber-400 via-orange-500 to-red-500",
      status: "active",
      image: optionsPfp,
    },
    {
      name: "Whale Bot",
      icon: Radar,
      description: "Discord-native AI agent for whale surveillance, dual-AI analysis, arbitrage scanning, and institutional portfolio intelligence across crypto and equities.",
      features: ["Live Whale Alerts", "Dual AI Insight", "Portfolio Deep Dives", "Arbitrage Scanner"],
      color: "from-sky-400 via-cyan-500 to-blue-700",
      status: "active",
      image: whaleBotPfp,
    },
    {
      name: "AI Indicator",
      icon: BarChart3,
      product: "Big Whale Finder PRO",
      platform: "tradingview",
      description: "Detects institutional ‘whale’ activity using volume anomalies, wick-to-body analysis, BWF‑Index, and zone tracking. Highlights accumulation/distribution, iceberg orders, and trend context.",
      features: ["Whale Detection", "Accumulation/Distribution Zones", "BWF‑Index", "Iceberg Orders"],
      color: "from-sky-500 via-blue-500 to-cyan-500",
      status: "active",
      image: whaleLogo,
      backgroundImage: rezerowhalesGif,
      backgroundOverlay: "linear-gradient(135deg, rgba(15,23,42,0.35), rgba(56,189,248,0.35))",
      textTone: "light",
    },
    {
      name: "AI Indicator",
      icon: BarChart3,
      product: "Sharingan Market Vision Pro",
      platform: "tradingview",
      description: "Ultimate all-in-one TradingView indicator: Market Structure, Liquidity, FVG, Order Blocks, Volume Delta, and Smart Money analysis with exceptional precision.",
      features: ["Market Structure", "Liquidity Analysis", "Order Blocks", "Volume Delta"],
      color: "from-red-500 to-red-600",
      status: "active",
      image: sharinganGif,
      backgroundImage: redsnowGif,
      backgroundOverlay: "linear-gradient(135deg, rgba(127,29,29,0.55), rgba(239,68,68,0.35))",
      textTone: "light",
    },
    {
      name: "AI Indicator",
      icon: BarChart3,
      product: "Ice Elves Winter Arrow",
      platform: "tradingview",
      description: "Winter-themed SMC suite blending Koncorde volume intelligence, Laguerre filters, Williams %R, and adaptive ML risk scoring into one clean overlay.",
      features: ["SMC + Liquidity Suite", "Koncorde Volume Dashboard", "Laguerre & %R Filters", "Adaptive Risk Matrix"],
      color: "from-cyan-400 via-sky-500 to-blue-600",
      status: "active",
      image: iceElvesPfp,
      backgroundImage: iceElvesBg,
      backgroundOverlay: "linear-gradient(135deg, rgba(0,61,92,0.65), rgba(0,212,255,0.35))",
      textTone: "light",
    },
    {
      name: "AI Strategy",
      icon: BarChart3,
      product: "Ghosted Night",
      platform: "tradingview",
      description: "Precision smart money playbook that scores confluence modules, tracks VWAP/liquidity, and waits for Ghost Impulse momentum before firing entries.",
      features: ["Module Score Panel", "Ghost Impulse Entries", "VWAP + Liquidity Filter", "Auto Risk/Targets"],
      color: "from-purple-600 via-indigo-500 to-slate-800",
      status: "active",
      image: ghostedNightPfp,
      backgroundImage: ghostedNightBg,
      backgroundOverlay: "linear-gradient(135deg, rgba(15,6,24,0.65), rgba(124,58,237,0.45))",
      textTone: "light",
    },
    {
      name: "And Much More...",
      icon: Brain,
      description: "10+ TradingView indicators, 5+ institutional-grade AI strategies, and nonstop bot drops — all shipping through JOAT + Whop.",
      features: ["10+ Premium Indicators", "5+ AI Strategies", "Weekly Bot Drops", "Managed via Whop"],
      color: "from-amber-400 via-pink-500 to-indigo-600",
      status: "active",
      image: joatLogo,
      centerOnDesktop: true,
      showcase: true,
    },
  ];

  const comingSoon = [
    {
      name: "JackTheSniper",
      icon: Target,
      description: "Advanced memecoin sniper bot for identifying and capitalizing on early-stage opportunities in the crypto market with lightning-fast execution.",
      features: ["Memecoin Detection", "Early Entry", "Risk Management", "Lightning Execution"],
      color: "from-pink-500 to-rose-500",
      status: "coming-soon",
      image: null
    },
    {
      name: "AI Trading Bot",
      icon: Zap,
      description: "Fully automated AI trading bot that executes trades based on our proprietary algorithms, portfolio management, and advanced risk control systems.",
      features: ["Automated Trading", "AI Algorithms", "Portfolio Management", "Risk Control"],
      color: "from-cyan-500 to-blue-500",
      status: "coming-soon",
      image: null
    }
  ];

  return (
    <section 
      id="ai-systems"
      ref={sectionRef}
      className="relative py-16 lg:py-20 bg-gradient-to-br from-slate-900/50 via-background to-slate-900/50 overflow-hidden scroll-mt-28"
    >
      {/* Top divider gradient */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent/30 to-transparent opacity-60" />

      {/* Enhanced background pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
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
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ mixBlendMode: 'screen' }}
      />
      
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/3 to-transparent"></div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        
        {/* Header */}
        <div className={`text-center mb-12 lg:mb-16 transition-all duration-700 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            <span className="text-foreground">Our AI Systems</span>
            <br />
            <span className="text-accent italic">Jack Of All Trading</span>
          </h2>
          
          <p className="text-lg sm:text-xl text-muted-foreground/80 max-w-3xl mx-auto leading-relaxed font-light">
            8+ powerful AI-powered tools designed to give you every advantage in the markets. 
            From chart analysis to coding help, we've got you covered.
          </p>
        </div>

        {/* Active Systems Grid */}
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-12 transition-all duration-500 delay-300 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          {systems.map((system, index) => {
            const IconComponent = system.icon;
            const isTradingView = (system as any).platform === 'tradingview';
            const productName = (system as any).product || system.name;
            const backgroundImage = (system as any).backgroundImage as string | undefined;
            const backgroundOverlay = (system as any).backgroundOverlay as string | undefined;
            const textOnDark = (system as any).textTone === "light";
            const centerOnDesktop = (system as any).centerOnDesktop;
            const isShowcase = (system as any).showcase;
            return (
              <div
                key={`${productName}-${index}`}
                className={`group relative ${
                  backgroundImage ? '' : 'bg-card/50 backdrop-blur-sm'
                } rounded-2xl overflow-hidden p-6 lg:p-8 border border-border/20 hover:border-border/40 transition-all duration-150 hover:scale-105 hover:shadow-2xl ${
                  centerOnDesktop ? 'lg:col-start-2' : ''
                } ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ 
                  transitionDelay: `${200 + index * 80}ms`,
                }}
              >
                {backgroundImage ? (
                  <>
                    {backgroundImage.endsWith('.mp4') ? (
                      <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 rounded-2xl z-[1] pointer-events-none object-cover w-full h-full"
                        src={backgroundImage}
                      />
                    ) : (
                      <div
                        className="absolute inset-0 rounded-2xl z-[1] pointer-events-none"
                        style={{
                          backgroundImage: `url(${backgroundImage})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'top center',
                          backgroundRepeat: 'no-repeat',
                        }}
                      />
                    )}
                    <div
                      className="absolute inset-0 rounded-2xl z-[2] opacity-0 group-hover:opacity-30 transition-opacity duration-150 pointer-events-none"
                      style={{ background: backgroundOverlay || 'linear-gradient(to bottom right, rgba(15,23,42,0.4), rgba(14,116,144,0.25))' }}
                    />
                  </>
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${system.color} opacity-5 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl z-10 pointer-events-none`} />
                )}

                {/* Hover ring glow */}
                <div 
                  className="absolute inset-0 rounded-2xl z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none ring-1 ring-accent/20" 
                  style={{
                    boxShadow: textOnDark
                      ? '0 0 40px rgba(255,255,255,0.15) inset, 0 0 40px rgba(255,255,255,0.12)'
                      : '0 0 40px hsl(var(--accent) / 0.2) inset, 0 0 40px hsl(var(--accent) / 0.2)',
                  }}
                />
                
                
                {/* Icon */}
                <div
                  className={`relative mb-4 w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:-rotate-1 transition-transform duration-150 overflow-hidden z-20 ${
                    isShowcase ? 'mx-auto bg-transparent' : `bg-gradient-to-br ${system.color}`
                  }`}
                >
                  {system.image ? (
                    <img 
                      src={system.image} 
                      alt={`${system.name} Bot`}
                      className={`w-full h-full ${isShowcase ? 'object-contain p-1 drop-shadow-[0_3px_12px_rgba(0,0,0,0.35)]' : 'object-cover'} rounded-xl`}
                    />
                  ) : (
                    <IconComponent className="h-6 w-6 text-white" />
                  )}
                </div>

                {/* Content */}
                <div className={`mb-3 z-20 relative ${isShowcase ? 'text-center' : ''}`}>
                  {system.name !== "AI Indicator" && !isShowcase && (
                    <div className="text-xs font-semibold text-accent/80 mb-1 tracking-wide">
                      JACK OF ALL
                    </div>
                  )}
                  <h3
                    className={`text-xl font-bold ${
                      textOnDark ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]' : 'text-foreground'
                    } transition-colors duration-300 z-20 relative`}
                  >
                    {system.name}
                    <span className={`absolute left-0 -bottom-1 h-0.5 w-0 transition-all duration-150 ${
                      textOnDark ? 'bg-white/70' : 'bg-accent'
                    } group-hover:w-12`} />
                  </h3>
                </div>
                
                {isTradingView ? (
                  <p className={`${textOnDark ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]' : 'text-muted-foreground/80'} text-sm leading-relaxed mb-4 z-20 relative ${isShowcase ? 'text-center' : ''}`}>
                    <span className="font-semibold">{productName}</span> — {system.description}
                  </p>
                ) : (
                  <p className={`text-muted-foreground/80 text-sm leading-relaxed mb-4 z-20 relative ${isShowcase ? 'text-center' : ''}`}>
                    {system.description}
                  </p>
                )}

                {/* Features */}
                <div className={`space-y-2 z-20 relative ${isShowcase ? 'text-center' : ''}`}>
                  {system.features.map((feature, featureIndex) => (
                    <div
                      key={featureIndex}
                      className={`flex items-center gap-2 text-xs ${
                        textOnDark ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]' : 'text-muted-foreground/70'
                      } ${isShowcase ? 'justify-center' : ''}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${system.color} opacity-70 transition-all duration-150 group-hover:opacity-100 group-hover:scale-110`} />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Showcase overlay */}
                {isShowcase && (
                  <>
                    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <div className="px-4 py-3 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-white/15 text-white font-semibold tracking-wide text-base shadow-xl">
                        +Even more coming soon...
                      </div>
                    </div>
                    <div className="absolute inset-0 z-20 pointer-events-none transition duration-200 group-hover:backdrop-blur-sm"></div>
                  </>
                )}

                {/* Status badge */}
                <div className="absolute top-4 right-4 z-20">
                  {isShowcase ? null : (system.name === "Knowledge" || system.name === "News" || system.name === "Signals") ? (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-semibold bg-blue-500/10 border-blue-500/30 text-blue-400">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                        </svg>
                        <span>Discord</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-foreground/70 text-[10px] font-semibold">+</span>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-semibold bg-accent/10 border-accent/30 text-accent">
                          <img src={joatLogo} alt="JOAT" className="h-3 w-3 object-contain" />
                          <span>Platform</span>
                        </div>
                      </div>
                    </div>
                  ) : isTradingView ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-semibold bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                      <img src={tradingviewLogo} alt="TradingView" className="w-3.5 h-3.5 object-contain" />
                      <span>TradingView</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-semibold bg-blue-500/10 border-blue-500/30 text-blue-400">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                      <span>Discord</span>
                    </div>
                  )}
                </div>

                {/* Fade content on hover for showcase */}
                {isShowcase && (
                  <div className="absolute inset-0 z-10 pointer-events-none transition duration-200 group-hover:bg-black/40"></div>
                )}
              </div>
            );
          })}
        </div>

        {/* Status badge (moved outside to avoid duplication) */}
        {/* Coming Soon */}
        <div className={`text-center transition-all duration-600 delay-800 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}>
          <p className="text-sm text-muted-foreground/80 italic">More Coming Soon...</p>
        </div>
      </div>
    </section>
  );
};

export default AISystemsSection;
