import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import MagneticButton from "@/components/MagneticButton";
import ParticleBackground from "@/components/ParticleBackground";

const ConvinceSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<{ x: number; y: number; color: 'accent' | 'primary'; radius: number }[]>([]);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    // Less sensitive reveal: hysteresis between show/hide
    let visibleState = false;
    const showThreshold = 0.5; // show when at least 50% in view
    const hideThreshold = 0.28; // but don't hide until it drops well below
    const thresholds: number[] = [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1];
    const io = new IntersectionObserver((entries) => {
      const entry = entries[0];
      const ratio = entry.intersectionRatio;
      if (!visibleState && entry.isIntersecting && ratio >= showThreshold) {
        visibleState = true;
        setIsVisible(true);
      } else if (visibleState && ratio <= hideThreshold) {
        visibleState = false;
        setIsVisible(false);
      }
    }, { threshold: thresholds, rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Interactive dots highlight overlay (matches background pattern)
  useEffect(() => {
    const sectionEl = sectionRef.current;
    const canvas = canvasRef.current;
    if (!sectionEl || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gridSize = 80; // must match CSS backgroundSize
    const devicePixelRatio = window.devicePixelRatio || 1;
    
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
      canvas.width = Math.max(1, Math.floor(rect.width * devicePixelRatio));
      canvas.height = Math.max(1, Math.floor(rect.height * devicePixelRatio));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      // Recompute colors in case theme variables changed
      accentColor = `hsl(${getComputedStyle(sectionEl).getPropertyValue('--accent').trim()})`;
      primaryColor = `hsl(${getComputedStyle(sectionEl).getPropertyValue('--primary').trim()})`;
      computeDots(rect.width, rect.height);
      // Draw once after resize to clear stale content
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    resize();

    let smoothX = 0;
    let smoothY = 0;
    let hasSmooth = false;
    let fade = 0;
    const influence = 80;
    const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const target = mouseRef.current;
      if (target) {
        if (!hasSmooth) { smoothX = target.x; smoothY = target.y; hasSmooth = true; }
        else { smoothX += (target.x - smoothX) * 0.04; smoothY += (target.y - smoothY) * 0.04; }
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative py-8 lg:py-12 overflow-hidden bg-gradient-to-br from-slate-900/50 via-background to-slate-900/50">
      {/* Moving glow background */}
      <div className="absolute inset-0">
        {/* Orb 1 */}
        <div 
          className="absolute w-64 h-64 bg-gradient-to-r from-accent/30 to-primary/20 rounded-full blur-[110px] opacity-55 mix-blend-screen"
          style={{
            animation: 'float1 7s ease-in-out infinite',
            top: '18%',
            left: '18%'
          }}
        />

        {/* Orb 2 */}
        <div 
          className="absolute w-56 h-56 bg-gradient-to-r from-primary/25 to-accent/15 rounded-full blur-[100px] opacity-5 0 mix-blend-screen"
          style={{
            animation: 'float2 11s ease-in-out infinite',
            top: '62%',
            left: '72%'
          }}
        />

        {/* Orb 3 */}
        <div 
          className="absolute w-72 h-72 bg-gradient-to-r from-accent/22 to-primary/12 rounded-full blur-[120px] opacity-45 mix-blend-screen"
          style={{
            animation: 'float3 9s ease-in-out infinite',
            top: '42%',
            left: '8%'
          }}
        />

        {/* Orbiting glow */}
        <div
          className="absolute top-1/2 left-1/2 w-80 h-80 rounded-full blur-[80px] opacity-70 mix-blend-screen"
          style={{
            background: 'radial-gradient(circle, hsl(var(--accent) / 0.35) 0%, transparent 60%)',
            transform: 'translate(-50%, -50%)',
            animation: 'orbit 14s linear infinite'
          }}
        />
        
        {/* Center glow */}
        <div 
          className="absolute top-1/2 left-1/2 w-[45rem] h-[45rem] rounded-full blur-[110px] transform -translate-x-1/2 -translate-y-1/2"
          style={{
            background: 'radial-gradient(closest-side, hsl(var(--accent) / 0.35), transparent 62%)',
            animation: 'pulse 6s ease-in-out infinite'
          }}
        />
        {/* Vignette to focus center */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, transparent 48%, rgba(0,0,0,0.30) 100%)'
          }}
        />

        {/* Top fade to blend with FAQ */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-background/70 via-background/40 to-transparent" />
      </div>
      
      {/* Global CSS animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes float1 {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
            25% { transform: translate(120px, -80px) scale(1.2); opacity: 0.75; }
            50% { transform: translate(180px, 90px) scale(0.92); opacity: 0.6; }
            75% { transform: translate(60px, 150px) scale(1.1); opacity: 0.7; }
          }
          @keyframes float2 {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.45; }
            33% { transform: translate(-130px, -100px) scale(1.25); opacity: 0.7; }
            66% { transform: translate(100px, -150px) scale(0.95); opacity: 0.45; }
          }
          @keyframes float3 {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.35; }
            50% { transform: translate(200px, -100px) scale(1.45); opacity: 0.6; }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
            50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.25); }
          }
          @keyframes orbit {
            0% { transform: translate(-50%, -50%) rotate(0deg) translateX(140px) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg) translateX(140px) rotate(-360deg); }
          }
        `
      }} />

      <div className={`relative z-20 max-w-3xl mx-auto px-6 lg:px-8 text-center transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold leading-tight tracking-tight mb-6">
            Are you <span className="text-accent italic">convinced</span> yet?
          </h2>
        </div>

        <div className="flex justify-center">
          <MagneticButton strength={0.15}>
            <Button 
              size="sm" 
              className="bg-accent/10 hover:bg-accent/20 text-accent font-medium px-6 py-3 rounded-full border border-accent/20 hover:border-accent/40 transition-all duration-200 hover:scale-105 relative overflow-hidden group shadow-lg shadow-accent/20"
              asChild
            >
              <a href="https://whop.com/jack-of-all-trades-official" target="_blank" rel="noopener noreferrer" className="flex items-center relative z-10">
                <span className="relative z-10">Try Now</span>
                <div className="ml-2 flex items-center justify-center w-5 h-5 rounded-full bg-accent/20 group-hover:bg-accent/30 transition-colors duration-300 relative z-10">
                  <ArrowUpRight className="h-3 w-3 group-hover:rotate-45 transition-transform duration-300" />
                </div>
              </a>
            </Button>
          </MagneticButton>
        </div>
      </div>
      
      {/* Bottom spacing */}
      <div className="h-16 lg:h-20"></div>
    </section>
  );
};

export default ConvinceSection;
