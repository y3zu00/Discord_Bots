import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowUpRight, Menu, X, ChevronDown } from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import joatLogo from "@/assets/joat-logo-nobg.png";
import joatText from "@/assets/joat-text.png";
import ParticleBackground from "@/components/ParticleBackground";

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [authRedirecting, setAuthRedirecting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const smoothScrollTo = (targetY: number, duration = 300) => {
    const startY = window.scrollY;
    const distance = targetY - startY;
    if (distance === 0) return;
    let startTime: number | null = null;
    const easeInOutCubic = (t: number) => (t < 0.5)
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeInOutCubic(progress);
      window.scrollTo(0, Math.round(startY + distance * eased));
      if (elapsed < duration) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const scrollToHash = (hash: string) => {
    const id = hash.replace('#', '');
    const el = document.getElementById(id);
    if (!el) return;
    // Measure only the top bar container height (excludes mobile dropdown panel)
    const navHeight = dropdownRef.current?.getBoundingClientRect().height
      ?? navRef.current?.getBoundingClientRect().height
      ?? 0;
    const extra = 8; // small breathing room
    const top = window.scrollY + el.getBoundingClientRect().top - navHeight - extra;
    smoothScrollTo(Math.max(0, top));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
    <nav ref={navRef} className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-background/95 backdrop-blur-sm' 
        : 'bg-gradient-hero/80'
    }`}>
      {/* Particle Background - only show when at top */}
      {!isScrolled && <ParticleBackground navbarOnly={true} />}
      
      {/* Gradient border bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-background via-primary/50 to-background"></div>
      
      <div className={`max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between transition-all duration-300 ${
        isScrolled ? 'py-2' : 'py-4'
      }`} ref={dropdownRef}>
        {/* Logo and Brand */}
        <a
          href="#home"
          className="flex items-center gap-3"
          aria-label="Go to home"
          onPointerDown={(e) => { e.preventDefault(); scrollToHash('#home'); }}
          onClick={(e) => { e.preventDefault(); scrollToHash('#home'); }}
        >
          <img 
            src={joatLogo} 
            alt="JOAT Logo" 
            className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 object-contain"
          />
          <img 
            src={joatText} 
            alt="Jack Of All Trades" 
            className="h-5 w-auto sm:h-6 sm:w-auto lg:h-8 lg:w-auto object-contain"
          />
        </a>

        {/* Navigation Links and CTA */}
        <div className="flex items-center gap-8">
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6 text-muted-foreground">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group inline-flex items-center gap-1.5 hover:text-foreground transition-colors relative">
                  <span className="relative inline-block">
                    <span className="text-foreground/90">Home</span>
                    <span className="pointer-events-none absolute left-0 -bottom-1 h-0.5 w-0 bg-accent transition-all duration-200 group-hover:w-full" />
                  </span>
                  <span className="relative flex h-5 w-5 items-center justify-center rounded-md bg-foreground/5 group-hover:bg-foreground/10 transition-colors">
                    <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="center" sideOffset={12} className="min-w-[200px] rounded-xl border border-border/30 bg-background/95 backdrop-blur shadow-xl">
                <DropdownMenuItem asChild>
                  <a href="#home" onPointerDown={(e) => { e.preventDefault(); scrollToHash('#home'); }} onClick={(e) => { e.preventDefault(); scrollToHash('#home'); }}>Home</a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="#video-section" onPointerDown={(e) => { e.preventDefault(); scrollToHash('#video-section'); }} onClick={(e) => { e.preventDefault(); scrollToHash('#video-section'); }}>Demo Video</a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="#ai-systems" onPointerDown={(e) => { e.preventDefault(); scrollToHash('#ai-systems'); }} onClick={(e) => { e.preventDefault(); scrollToHash('#ai-systems'); }}>AI Systems</a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="#testimonials" onPointerDown={(e) => { e.preventDefault(); scrollToHash('#testimonials'); }} onClick={(e) => { e.preventDefault(); scrollToHash('#testimonials'); }}>Testimonials</a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="#pricing" onPointerDown={(e) => { e.preventDefault(); scrollToHash('#pricing'); }} onClick={(e) => { e.preventDefault(); scrollToHash('#pricing'); }}>Pricing</a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="#faq" onPointerDown={(e) => { e.preventDefault(); scrollToHash('#faq'); }} onClick={(e) => { e.preventDefault(); scrollToHash('#faq'); }}>FAQ</a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <a href="#products" className="hover:text-foreground transition-colors">
              Products
            </a>
            <a
              href="#login"
              className="hover:text-foreground transition-colors"
              onPointerDown={(e) => { e.preventDefault(); setIsLoginOpen(true); }}
              onClick={(e) => { e.preventDefault(); setIsLoginOpen(true); }}
            >
              Login
            </a>
          </div>
          
          {/* Desktop CTA Button */}
          <Button 
            size="sm"
            className="hidden md:flex bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full px-6"
            onClick={(e) => { e.preventDefault(); const el = document.getElementById('pricing'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }}
          >
            Start Free Trial
            <div className="ml-2 flex items-center justify-center w-6 h-6 rounded-full bg-primary-foreground/20">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </Button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-primary hover:text-primary/80 transition-colors bg-primary/10 hover:bg-primary/20 rounded-lg"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      <div className={`md:hidden absolute top-full left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-primary/30 shadow-xl transition-all duration-300 ease-out ${
        isMobileMenuOpen 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 -translate-y-4 pointer-events-none'
      }`}>
          <div className="px-6 py-6 space-y-1">
            <div className="grid gap-1">
              <div className="grid grid-cols-2 gap-2">
                {[
                  {href:'#home', label:'Home'},
                  {href:'#video-section', label:'Demo Video'},
                  {href:'#ai-systems', label:'AI Systems'},
                  {href:'#testimonials', label:'Testimonials'},
                  {href:'#pricing', label:'Pricing'},
                  {href:'#faq', label:'FAQ'},
                ].map((l) => (
                  <button
                    key={l.href}
                    type="button"
                    className="text-center text-foreground/80 hover:text-primary transition-colors py-2 rounded-md bg-foreground/5 hover:bg-foreground/10"
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (l.href === '#home') {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      } else {
                        scrollToHash(l.href);
                      }
                      setIsMobileMenuOpen(false);
                    }}
                    onClick={(e) => { 
                      e.preventDefault();
                      e.stopPropagation();
                      if (l.href === '#home') {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      } else {
                        scrollToHash(l.href);
                      }
                      setIsMobileMenuOpen(false); 
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
            <a 
              href="#products" 
              className="block text-center text-foreground hover:text-primary transition-colors py-3"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Products
            </a>
            <div className="h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
            <a 
              href="#login" 
              className="block text-center text-foreground hover:text-primary transition-colors py-3"
              onPointerDown={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); setTimeout(() => setIsLoginOpen(true), 0); }}
              onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); setTimeout(() => setIsLoginOpen(true), 0); }}
            >
              Login
            </a>
            <div className="h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
            <div className="pt-4">
              <Button 
                size="sm"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full px-6"
                onClick={(e) => { e.preventDefault(); const el = document.getElementById('pricing'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } setIsMobileMenuOpen(false); }}
              >
                Start Free Trial
                <div className="ml-2 flex items-center justify-center w-6 h-6 rounded-full bg-primary-foreground/20">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </Button>
            </div>
          </div>
        </div>
    </nav>
    {/* Login Dialog */}
    <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
      <DialogContent className="w-[92%] sm:w-auto max-w-sm rounded-2xl border-0 bg-background/95 backdrop-blur shadow-[0_20px_80px_rgba(0,0,0,0.5)] p-7 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 glow-border-animated">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-extrabold tracking-tight">
            Welcome back
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground/80">
            Sign in to continue with your Discord account
          </DialogDescription>
        </DialogHeader>
        <div className="pt-3" />
        <Button
          size="lg"
          className="w-full justify-center rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold py-6 shadow-lg hover:shadow-xl transition-all duration-300"
          onClick={() => {
            try { setIsLoginOpen(false); } catch {}
            setAuthRedirecting(true);
            // Slight delay to allow overlay to paint before navigating
            setTimeout(() => {
              window.location.replace("/api/auth/discord/login");
            }, 10);
          }}
        >
          <span className="mr-2 inline-flex items-center justify-center w-7 h-7 rounded-md bg-white/10">
            <svg viewBox="0 0 24 24" className="w-5 h-5 block" aria-hidden="true">
              <path fill="currentColor" d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          </span>
          Login with Discord
        </Button>
        <div className="mx-auto mt-3 w-28 h-[2px] rounded-full bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
        <p className="text-center text-xs text-muted-foreground/70">
          By continuing, you agree to our Terms and Privacy Policy.
        </p>
      </DialogContent>
    </Dialog>
    {authRedirecting && (
      <div className="fixed inset-0 z-[9999] bg-background" />
    )}
    </>
  );
};

export default Navbar;
