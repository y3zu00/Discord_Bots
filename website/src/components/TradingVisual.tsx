import React, { useState, useEffect } from "react";
import jackofai from "@/assets/jackofai.png";
import marketanalysis from "@/assets/marketanalysis.png";
import reviewpic from "@/assets/review.png";
import candlesticksDull from "@/assets/candlesticks/candlesticksdull.png";
import candlesticksRegular from "@/assets/candlesticks/candlesticks.png";
import candlesticksGif from "@/assets/candlesticks-unscreen.gif";
import candlesticksReverseGif from "@/assets/candlereverse-unscreen.gif";

const TradingVisual: React.FC = () => {
  const [hovered, setHovered] = useState(false);
  const [animationState, setAnimationState] = useState<'dull' | 'animating' | 'regular' | 'reversing'>('dull');
  const [pageLoaded, setPageLoaded] = useState(false);

  useEffect(() => {
    // Page load animation
    const loadTimer = setTimeout(() => {
      setPageLoaded(true);
    }, 500);
    
    return () => clearTimeout(loadTimer);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (hovered && animationState === 'dull') {
      // Start the forward animation
      setAnimationState('animating');
      
      // After 700ms, switch to regular (static bright)
      timer = setTimeout(() => {
        setAnimationState('regular');
      }, 700);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [hovered]);

  const handleMouseEnter = () => {
    if (animationState === 'dull') {
      setHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setHovered(false);
    
    // Play reverse animation when unhovered
    if (animationState === 'regular') {
      setAnimationState('reversing');
      
      // After 700ms reverse animation, go back to dull
      setTimeout(() => {
        setAnimationState('dull');
      }, 700);
    } else {
      setAnimationState('dull');
    }
  };

  return (
    <div
      className="group relative w-full h-full min-h-[400px] sm:min-h-[500px] lg:min-h-[700px] select-none overflow-visible border-0 outline-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Caption */}
      <p className="absolute top-1 left-1/2 -translate-x-1/2 text-xs italic text-muted-foreground/80 z-0">
        Over 87% Win Rates With Our AI Systems
      </p>

      {/* Premium glow layers behind globe - pulse only on hover - extended to prevent edge clipping */}
      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] sm:w-[380px] sm:h-[380px] lg:w-[520px] lg:h-[520px] rounded-full transition-all duration-700 ${pageLoaded ? 'opacity-100' : 'opacity-0'} ${hovered ? 'bg-accent/25 blur-[110px] opacity-100 animate-pulse-glow' : 'bg-accent/15 blur-[90px] opacity-80'}`} />
      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[230px] h-[230px] sm:w-[310px] sm:h-[310px] lg:w-[400px] lg:h-[400px] rounded-full transition-all duration-700 ${pageLoaded ? 'opacity-100' : 'opacity-0'} ${hovered ? 'bg-accent/20 blur-[70px] opacity-100 animate-pulse-glow' : 'bg-accent/10 blur-[55px] opacity-70'}`} style={{animationDelay: hovered ? '1s' : undefined}} />
      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] sm:w-[240px] sm:h-[240px] lg:w-[310px] lg:h-[310px] rounded-full transition-all duration-700 ${pageLoaded ? 'opacity-100' : 'opacity-0'} ${hovered ? 'bg-accent/15 blur-[40px] opacity-100 animate-pulse-glow' : 'bg-accent/8 blur-[30px] opacity-60'}`} style={{animationDelay: hovered ? '2s' : undefined}} />

      {/* Candlesticks behind globe - state-based animation with page load fade */}
      {animationState === 'dull' && (
        <img
          src={candlesticksDull}
          alt="Candlesticks"
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] lg:w-[450px] lg:h-[450px] object-contain z-5 transition-opacity duration-1000 ${pageLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {animationState === 'animating' && (
        <img
          key={Date.now()}
          src={candlesticksGif}
          alt="Candlesticks animating"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] lg:w-[450px] lg:h-[450px] object-contain z-5"
        />
      )}
      {animationState === 'regular' && (
        <img
          src={candlesticksRegular}
          alt="Candlesticks"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] lg:w-[450px] lg:h-[450px] object-contain z-5"
        />
      )}
      {animationState === 'reversing' && (
        <img
          key={Date.now()}
          src={candlesticksReverseGif}
          alt="Candlesticks reversing"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] lg:w-[450px] lg:h-[450px] object-contain z-5"
        />
      )}

      {/* Central logo with globe - enhanced shadows and rotation */}
      <img
        src={jackofai}
        alt="JOAT Globe"
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] lg:w-[300px] lg:h-[300px] object-contain drop-shadow-2xl z-10 filter brightness-110 transition-transform duration-1000 ${hovered ? 'rotate-12 scale-105' : 'rotate-0 scale-100'}`}
      />

      {/* Market analysis image top-left - enhanced hover effects */}
      <img
        src={marketanalysis}
        alt="Market Analysis"
        className={`absolute top-8 left-2 sm:top-6 sm:left-3 lg:top-9 lg:left-4 w-20 sm:w-28 lg:w-44 rounded-xl drop-shadow-xl transition-all duration-500 z-20 ${hovered ? 'opacity-100 scale-110 rotate-3 shadow-2xl' : 'opacity-100 scale-95 rotate-0 shadow-lg'}`}
      />

      {/* Review image bottom-right - enhanced hover effects */}
      <img
        src={reviewpic}
        alt="Review"
        className={`absolute bottom-8 -right-4 sm:bottom-8 sm:-right-2 lg:bottom-16 lg:right-0 w-30 sm:w-44 lg:w-72 rounded-xl drop-shadow-xl transition-all duration-500 z-20 ${hovered ? 'opacity-100 scale-110 -rotate-3 shadow-2xl' : 'opacity-100 scale-95 rotate-0 shadow-lg'}`}
      />

      {/* Squiggly lines from globe border to badges */}
      <svg className="absolute inset-0 pointer-events-none z-10" viewBox="0 0 600 700" preserveAspectRatio="xMidYMid meet">
        {/* Line to signal badge (top-left) */}
        <path
          d="M 250 197 L 240 187 L 230 177 L 220 167 L 210 157 L 200 147 L 190 137 L 180 132 L 170 127 L 160 122"
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="320"
          style={{ strokeDashoffset: hovered ? 0 : 320, transition: 'stroke-dashoffset 800ms cubic-bezier(0.4,0,0.2,1)' }}
        />
        {/* Line to review badge (bottom-right) */}
        <path
          d="M 400 427 L 410 437 L 420 447 L 430 457 L 440 467 L 450 477 L 460 487 L 470 497 L 480 507 L 490 517"
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="320"
          style={{ strokeDashoffset: hovered ? 0 : 320, transition: 'stroke-dashoffset 800ms cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>

      {/* Premium KPI pill - smaller and underneath */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-full bg-gradient-to-r from-background/80 to-background/60 text-foreground backdrop-blur-xl border border-border/40 shadow-2xl">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-r from-primary/30 to-accent/30 text-primary text-xs font-bold">👥</span>
        <span className="text-xs font-semibold">500+ Traders</span>
        <span className="text-muted-foreground/60">•</span>
        <span className="text-xs font-medium">7‑Day Free Trial</span>
      </div>
    </div>
  );
};

export default TradingVisual;


