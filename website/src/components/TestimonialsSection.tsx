import React, { useEffect, useRef, useState } from "react";
import whopLogo from "@/assets/whop.jpg";

const testimonials = [
  { 
    name: "Evan R", 
    role: "Day Trader", 
    quote: "I stopped forcing trades and just started waiting for setups that make sense. Way less stress, way better results." 
  },
  { 
    name: "Maya T.", 
    role: "Swing Trader", 
    quote: "Crazy how much smoother things got once I actually slowed down and trusted my plan. No more overthinking every move." 
  },
  { 
    name: "Chris", 
    role: "Pine Coder", 
    quote: "I used to spend hours fixing tiny script bugs — now everything flows. Feels good to actually code and trade in peace." 
  },
  { 
    name: "Lena K.", 
    role: "Futures Trader", 
    quote: "Used to chase every breakout I saw. Now I wait for clean setups and my PnL finally looks like I know what I’m doing." 
  },
  { 
    name: "omar", 
    role: "Scalper", 
    quote: "Entries hit cleaner, exits are tighter, and I’m not second guessing myself anymore. Feels dialed in." 
  },
  { 
    name: "Priya V.", 
    role: "Crypto Trader", 
    quote: "Trading doesn’t feel like chaos now. I’ve got structure, rhythm, and way more confidence in my decisions." 
  },
  { 
    name: "Daniel M", 
    role: "Options Trader", 
    quote: "Finally started taking risk management seriously. I’m actually keeping profits instead of giving them right back." 
  },
  { 
    name: "Sophia", 
    role: "Equities", 
    quote: "Used to spend half my morning catching up on news. Now I’m ready to go in five minutes and focused on the charts." 
  },
  { 
    name: "Marco P.", 
    role: "FX Trader", 
    quote: "Having a routine changed everything. I show up, do my prep, and stick to the plan — no more random trading." 
  },
  { 
    name: "Jakeee H", 
    role: "Analyst", 
    quote: "I actually understand why I take each trade now. Once that clicked, everything started making way more sense." 
  },
  { 
    name: "Tom B.", 
    role: "Swing/Intraday", 
    quote: "Watchlists and alerts keep me from overtrading. Less screen time, more quality setups, best deal ever." 
  },
  { 
    name: "Andrew", 
    role: "Index Futures", 
    quote: "The feedback I got was blunt but real. It forced me to clean up my habits and trade way smarter." 
  },
];


const metrics = [
  { label: "Active traders", value: "500+" },
  { label: "Avg. feedback", value: "5/5" },
  { label: "Win rate", value: "87%" },
];

const TestimonialsSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setIsVisible(true);
        });
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="testimonials" ref={sectionRef} className="relative py-16 lg:py-20 overflow-hidden scroll-mt-28">
      {/* Top glow divider */}
      <div className="pointer-events-none absolute top-0 left-0 right-0">
        <div className="h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
        <div className="mx-10 h-10 bg-gradient-to-r from-accent/30 via-foreground/15 to-accent/30 blur-2xl opacity-25" />
      </div>
      {/* Background grid tint */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, hsl(var(--accent)) 2px, transparent 2px), radial-gradient(circle at 80% 80%, hsl(var(--primary)) 2px, transparent 2px), radial-gradient(circle at 50% 50%, hsl(var(--accent)) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div
          className={`text-center mb-8 lg:mb-12 transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-3">
            <span className="bg-gradient-to-r from-accent via-foreground to-accent bg-clip-text text-transparent">Trusted by real traders</span>
          </h2>
          <div className="relative inline-block">
            <p className="text-muted-foreground/80 max-w-2xl mx-auto text-sm sm:text-base italic">
              Social proof that our AI systems deliver consistent, practical edge — from
              signals to education to tooling.
            </p>
            {/* Shine removed to avoid visible white line */}
          </div>
        </div>

        {/* Metrics */}
        <div
          className={`flex flex-wrap items-center justify-center gap-3 sm:gap-6 mb-6 transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {metrics.map((m, idx) => (
            idx === 1 ? (
              <div key={m.label} className="flex flex-col items-center justify-center px-4 py-2 rounded-xl bg-card/60 border border-border/20 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-sm overflow-hidden">
                    <img src={whopLogo} alt="Whop" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-foreground font-semibold">Whop</span>
                </div>
                <div className="text-xs sm:text-sm text-accent font-extrabold mt-1">5/5 stars</div>
              </div>
            ) : (
              <div key={m.label} className="relative group px-3 py-2 rounded-full bg-accent/10 text-accent text-xs sm:text-sm font-semibold overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2">
                  <span className="text-base sm:text-sm font-extrabold text-foreground/90">{m.value}</span>
                  <span className="text-foreground/70 font-normal">{m.label}</span>
                </div>
                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-r from-transparent via-foreground/5 to-transparent" />
              </div>
            )
          ))}
        </div>

        {/* Testimonials carousel (two rows, counter-scrolling, seamless) */}
        <style>{`@keyframes marquee { 0%{ transform: translateX(0);} 100%{ transform: translateX(-50%);} } @keyframes marquee-rev { 0%{ transform: translateX(-50%);} 100%{ transform: translateX(0);} }`}</style>
        <div className={`space-y-4 relative overflow-hidden transition-all duration-500 delay-100 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
            {[0,1].map((row) => {
              const rotated = row === 0 ? testimonials : [...testimonials.slice(3), ...testimonials.slice(0,3)];
              const track = [...rotated, ...rotated];
              return (
                <div key={row} className="relative group h-[130px] sm:h-[140px]" style={{ maskImage: 'linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,1) 8%, rgba(0,0,0,1) 92%, rgba(0,0,0,0))' }}>
                  <div className={`absolute inset-y-0 left-0 flex gap-3 w-max ${row === 0 ? 'animate-[marquee_52s_linear_infinite]' : 'animate-[marquee-rev_56s_linear_infinite]'} group-hover:[animation-play-state:paused] will-change-transform`}>
                    {track.map((t, i) => (
                      <div key={`${row}-${i}`} className="min-w-[220px] max-w-[260px] group/item relative rounded-2xl border border-border/20 bg-card/50 p-3 hover:border-border/40 transition-all duration-200 hover:shadow-2xl">
                        <div className="flex items-center gap-1 mb-1 text-accent">
                          {[0,1,2,3,4].map((s) => (
                            <svg key={s} className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                            </svg>
                          ))}
                          <span className="text-[10px] text-muted-foreground/70 ml-2">Verified reviewer</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground/90 leading-relaxed mb-1 italic">“{t.quote}”</div>
                        <div className="text-[11px] font-semibold text-foreground">{t.name}</div>
                        <div className="absolute inset-0 rounded-2xl ring-1 ring-accent/10 opacity-0 group-hover/item:opacity-100 transition-opacity duration-150 pointer-events-none" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
