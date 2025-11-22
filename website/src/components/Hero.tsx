import React, { useState } from "react";
import { Check, ChevronDown, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroGraphic from "@/assets/hero-graphic.png";
import underline from "@/assets/underline.png";
import whopLogo from "@/assets/whop.jpg";
import TradingVisual from "@/components/TradingVisual";
import ParticleBackground from "@/components/ParticleBackground";
import MagneticButton from "@/components/MagneticButton";

const Hero = () => {
  const [isRightSideHovered, setIsRightSideHovered] = useState(false);

  return (
    <section id="home" className="relative min-h-screen bg-gradient-hero overflow-hidden pt-20 scroll-mt-28">
      
      {/* Dynamic background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/5 via-transparent to-accent/5 animate-gradient-shift" 
           style={{transform: 'translateZ(0)', willChange: 'transform'}} />
      
      {/* Moving grid pattern */}
      <div className="absolute inset-0 opacity-[0.02] animate-grid-move will-change-transform">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(hsl(var(--chart-grid)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--chart-grid)) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          transform: 'translateZ(0)',
          willChange: 'transform'
        }} />
      </div>

      {/* Background particles - always visible */}
      <ParticleBackground />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-8 lg:py-12 overflow-visible">
        <div className="grid lg:grid-cols-[52%_48%] gap-8 lg:gap-[10px] items-center overflow-visible">
          {/* Left Column - Content */}
          <div className="space-y-8 lg:space-y-10 animate-fade-up">
            {/* Main Headline with Fade-in Animation */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[0.9] tracking-tight">
              <span className="hero-fade-in inline-block">
                <span className="text-foreground">AI You Can </span>
                <span className="text-secondary italic">Trust.</span>
              </span>
              <br />
              <span className="hero-fade-in-delay-1 inline-block">
                <span className="text-foreground">Trades You Can </span>
              <span className="relative inline-block">
                  <span className="text-accent italic font-black drop-shadow-sm">Bank.</span>
                <img 
                  src={underline} 
                  alt="" 
                  className={`absolute -bottom-3.5 left-[-3px] right-0 w-full h-auto scale-110 transition-opacity duration-500 ${isRightSideHovered ? 'opacity-100' : 'opacity-30'}`}
                />
                </span>
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg text-muted-foreground/80 max-w-2xl leading-relaxed font-light">
              All‑in‑one AI stack: team of personalized AI trading tools designed to give you every advantage in the markets.
            </p>

            {/* Value Bullets - Refined */}
            <ul className="space-y-5 max-w-2xl animate-fade-up mt-6" style={{animationDelay: '80ms'}}>
              <li className="flex items-start gap-4 group cursor-pointer transition-all duration-300 hover:translate-x-1">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-success/10 flex items-center justify-center mt-0.5 group-hover:bg-success/20 group-hover:scale-110 transition-all duration-300">
                  <Check className="h-5 w-5 text-success group-hover:scale-110 transition-transform duration-300" strokeWidth={2.5} />
                </div>
                <span className="text-xl text-foreground font-semibold leading-relaxed group-hover:text-success transition-colors duration-300">
                  24/7 research bots, working for your profits
                </span>
              </li>
              <li className="flex items-start gap-4 group cursor-pointer transition-all duration-300 hover:translate-x-1">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-success/10 flex items-center justify-center mt-0.5 group-hover:bg-success/20 group-hover:scale-110 transition-all duration-300">
                  <Check className="h-5 w-5 text-success group-hover:scale-110 transition-transform duration-300" strokeWidth={2.5} />
                </div>
                <span className="text-xl text-foreground font-semibold leading-relaxed group-hover:text-success transition-colors duration-300">
                  AI tuned personally for you and your trading style
                </span>
              </li>
              <li className="flex items-start gap-4 group cursor-pointer transition-all duration-300 hover:translate-x-1">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-success/10 flex items-center justify-center mt-0.5 group-hover:bg-success/20 group-hover:scale-110 transition-all duration-300">
                  <Check className="h-5 w-5 text-success group-hover:scale-110 transition-transform duration-300" strokeWidth={2.5} />
                </div>
                <span className="text-xl text-foreground font-semibold leading-relaxed group-hover:text-success transition-colors duration-300">
                  Pro workflow: every tool you need to trade, all in one place
                </span>
              </li>
            </ul>

            {/* CTAs */}
            <div className="space-y-6 -ml-15 animate-fade-up" style={{animationDelay: '160ms'}}>
              <div className="flex flex-col items-center space-y-3">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                  <MagneticButton strength={0.2}>
                    <Button 
                      size="lg" 
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg px-10 py-6 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 relative overflow-hidden group"
                      asChild
                    >
                      <a href="https://whop.com/jack-of-all-trades-official" target="_blank" rel="noopener noreferrer" className="flex items-center relative z-10">
                        <span className="relative z-10">Start Free Trial</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                        <div className="ml-3 flex items-center justify-center w-8 h-8 rounded-full bg-primary-foreground/20 group-hover:bg-primary-foreground/30 transition-colors duration-300 relative z-10">
                          <ArrowUpRight className="h-5 w-5 group-hover:rotate-45 transition-transform duration-300" />
                        </div>
                      </a>
                    </Button>
                  </MagneticButton>
                  
                  <MagneticButton strength={0.2}>
                    <Button 
                      size="lg"
                      variant="outline"
                      className="bg-background/50 hover:bg-background/80 text-foreground hover:text-foreground border-border/50 hover:border-border font-semibold text-lg px-10 py-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 backdrop-blur-sm relative overflow-hidden group"
                      asChild
                    >
                      <a href="https://discord.gg/sjsJwdZPew" target="_blank" rel="noopener noreferrer" className="flex items-center relative z-10">
                        Join Discord
                        <svg className="ml-3 h-6 w-6 group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                        </svg>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                      </a>
                    </Button>
                  </MagneticButton>
                </div>
                <p className="text-base text-muted-foreground text-center font-medium">7‑Days Risk‑Free</p>
              </div>

              <div className="flex flex-col items-center gap-4">
                <button 
                  className="flex items-center gap-2 text-muted-foreground/70 hover:text-muted-foreground transition-colors group"
                  onClick={() => {
                    const videoSection = document.getElementById('video-section');
                    if (videoSection) {
                      videoSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  <ChevronDown className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
                  <span className="text-sm italic">Watch 2‑min demo</span>
                  <ChevronDown className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
                </button>
                
                {/* Social Proof */}
                <p className="text-sm text-muted-foreground/80 text-center">
                  Trusted by 500+ traders • <span className="text-success font-semibold">$2.3M+</span> in verified profits this month
                </p>
                
                {/* Trust Badge Row */}
                <div className="flex items-center justify-center gap-6 opacity-40 mt-4">
                  <a href="https://whop.com/jack-of-all-trades-official" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-muted-foreground group cursor-pointer transition-all duration-300 hover:opacity-80 hover:scale-105">
                    <div className="w-4 h-4 rounded-sm flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:shadow-lg group-hover:shadow-primary/20">
                      <img src={whopLogo} alt="Whop" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    <span className="transition-colors duration-300 group-hover:text-foreground">Whop</span>
                  </a>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground group cursor-pointer transition-all duration-300 hover:opacity-80 hover:scale-105">
                    <div className="w-4 h-4 bg-indigo-500/20 rounded-sm flex items-center justify-center transition-all duration-300 group-hover:shadow-lg group-hover:shadow-indigo-500/20">
                      <svg className="h-3 w-3 text-indigo-400 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                      </svg>
                    </div>
                    <span className="transition-colors duration-300 group-hover:text-foreground">Discord</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground group cursor-pointer transition-all duration-300 hover:opacity-80 hover:scale-105">
                    <div className="w-4 h-4 bg-green-500/20 rounded-sm flex items-center justify-center transition-all duration-300 group-hover:shadow-lg group-hover:shadow-green-500/20">
                      <Check className="h-2 w-2 text-green-400 transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    <span className="transition-colors duration-300 group-hover:text-foreground">SSL Secured</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Trading Visual (hidden on mobile) */}
          <div 
            className="hidden lg:block relative lg:h-[700px] flex items-stretch justify-end lg:-mr-20 border-0 outline-none overflow-visible"
            onMouseEnter={() => setIsRightSideHovered(true)}
            onMouseLeave={() => setIsRightSideHovered(false)}
          >
            {/* Extended glow layers outside the visual container */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/12 blur-[120px] opacity-60 transition-opacity duration-700 z-0" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-accent/10 blur-[80px] opacity-50 transition-opacity duration-700 z-0" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full bg-accent/8 blur-[50px] opacity-40 transition-opacity duration-700 z-0" />
            
            <div className="relative z-10 w-full h-full flex items-center justify-end border-0 outline-none overflow-visible pr-8">
              <TradingVisual />   
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
