import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, ArrowUpRight, Pause, Volume2, VolumeX, Maximize, Settings } from "lucide-react";
import MagneticButton from "@/components/MagneticButton";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const VideoSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Video State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const thresholds: number[] = [0, 0.15, 0.35, 0.5, 0.75, 1];
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const ratio = entry.intersectionRatio;
        setIsVisible(entry.isIntersecting && ratio >= 0.35);
      },
      { threshold: thresholds, rootMargin: "0px 0px -5% 0px" }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Video Control Logic
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (newMuted) {
        setVolume(0);
      } else {
        setVolume(1);
        videoRef.current.volume = 1;
      }
    }
  };

  const handleVolumeChange = (value: number[]) => {
    if (videoRef.current) {
      const newVolume = value[0];
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const handleSpeedChange = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackRate(speed);
    }
  };

  const toggleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Auto-hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2000);
    }
  };

  // Handle fullscreen change to update controls visibility logic if needed
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        // Reset specific fullscreen styles if any were applied
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <section 
      ref={sectionRef}
      id="video-section" 
      className="relative py-12 lg:py-16 bg-gradient-to-b from-background to-background/95 overflow-hidden scroll-mt-28"
    >
      
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, hsl(var(--accent)) 1px, transparent 1px), radial-gradient(circle at 75% 75%, hsl(var(--primary)) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          transform: 'translateZ(0)',
          willChange: 'transform'
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        
        {/* Header Content */}
        <div className={`text-center mb-8 lg:mb-12 transition-all duration-700 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight mb-4">
            <span className={`text-foreground transition-all duration-700 delay-200 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}>Learn How Our</span>
            <br />
            <span className={`text-accent italic transition-all duration-700 delay-300 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}>AI Systems Generate Profits</span>
          </h2>
          
          <p className={`text-base sm:text-lg text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed font-light transition-all duration-700 delay-400 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}>
            Watch our 2-minute demo to see how our AI analyzes markets and delivers real-time signals 
            that have generated over $2.3M in verified profits this month.
          </p>
        </div>

        {/* Video Container */}
        <div className={`relative max-w-4xl mx-auto mb-8 lg:mb-10 transition-all duration-800 delay-500 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          
          {/* Custom Video Player Container */}
          <div 
            ref={containerRef}
            className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-border/20 backdrop-blur-sm group"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
          >
            <video
              ref={videoRef}
              id="demo-video"
              className="w-full h-full object-cover cursor-pointer"
              onClick={togglePlay}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              preload="metadata"
            >
              <source src="/Introducing Jack Of All Trades.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>

            {/* Big Play Button Overlay */}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 z-10">
                <MagneticButton strength={0.4}>
                  <button 
                    onClick={togglePlay}
                    className="group relative w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full bg-gradient-to-br from-primary via-primary to-primary/80 hover:from-primary hover:via-primary hover:to-primary shadow-2xl transition-all duration-500 hover:scale-110 flex items-center justify-center border-2 border-primary/20 hover:border-primary/40"
                  >
                    <Play className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-primary-foreground ml-1 group-hover:scale-110 transition-transform duration-300 drop-shadow-lg fill-current" />
                    
                    {/* Subtle centered hover ring */}
                    <div className="absolute inset-0 rounded-full bg-primary/25 opacity-0 scale-95 transition-all duration-300 ease-out group-hover:opacity-100 group-hover:scale-110" />
                    
                    {/* Soft outer glow */}
                    <div className="absolute -inset-2 rounded-full bg-primary/10 blur-md group-hover:bg-primary/20 transition-all duration-500" />
                  </button>
                </MagneticButton>
              </div>
            )}

            {/* Custom Controls Bar */}
            <div 
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-4 pt-12 transition-opacity duration-300 z-20 ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              {/* Progress Bar */}
              <div className="mb-4 group/slider">
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="cursor-pointer"
                />
              </div>

              {/* Controls Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-4">
                  <button 
                    onClick={togglePlay}
                    className="text-white hover:text-primary transition-colors focus:outline-none p-1"
                  >
                    {isPlaying ? <Pause className="h-5 w-5 sm:h-6 sm:w-6 fill-current" /> : <Play className="h-5 w-5 sm:h-6 sm:w-6 fill-current" />}
                  </button>

                  {/* Volume */}
                  <div className="flex items-center gap-2 group/volume">
                    <button 
                      onClick={toggleMute}
                      className="text-white hover:text-primary transition-colors focus:outline-none p-1"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="h-4 w-4 sm:h-5 sm:w-5" />
                      ) : (
                        <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      )}
                    </button>
                    <div className="w-0 overflow-hidden group-hover/volume:w-16 sm:group-hover/volume:w-24 transition-all duration-300 ease-out">
                      <Slider
                        value={[isMuted ? 0 : volume]}
                        max={1}
                        step={0.1}
                        onValueChange={handleVolumeChange}
                        className="w-16 sm:w-20"
                      />
                    </div>
                  </div>

                  {/* Time Display */}
                  <span className="text-[10px] sm:text-xs text-white/80 font-medium font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                  {/* Playback Speed */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-[10px] sm:text-xs font-bold text-white hover:text-primary transition-colors bg-white/10 px-2 py-1 rounded backdrop-blur-sm border border-white/5">
                        {playbackRate}x
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1 bg-black/90 border-white/10 backdrop-blur-md text-white mb-2">
                      <div className="flex flex-col gap-1">
                        {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => handleSpeedChange(rate)}
                            className={`px-3 py-1.5 text-sm rounded hover:bg-white/20 transition-colors text-left ${
                              playbackRate === rate ? 'text-primary font-bold bg-white/10' : 'text-white/80'
                            }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <button 
                    onClick={toggleFullscreen}
                    className="text-white hover:text-primary transition-colors focus:outline-none p-1"
                  >
                    <Maximize className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Video stats */}
          <div className={`flex flex-wrap items-center justify-center gap-6 mt-6 text-sm text-muted-foreground/70 transition-all duration-700 delay-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <div className="flex items-center gap-2 group cursor-pointer transition-all duration-300 hover:scale-110 hover:text-foreground">
              <div className="w-2 h-2 bg-success rounded-full group-hover:scale-125 group-hover:shadow-lg group-hover:shadow-success/50 transition-all duration-300" />
              <span className="group-hover:font-semibold transition-all duration-300">87% win rate</span>
            </div>
            <div className="flex items-center gap-2 group cursor-pointer transition-all duration-300 hover:scale-110 hover:text-foreground">
              <div className="w-2 h-2 bg-primary rounded-full group-hover:scale-125 group-hover:shadow-lg group-hover:shadow-primary/50 transition-all duration-300" />
              <span className="group-hover:font-semibold transition-all duration-300">Fully automated trading system</span>
            </div>
            <div className="flex items-center gap-2 group cursor-pointer transition-all duration-300 hover:scale-110 hover:text-foreground">
              <div className="w-2 h-2 bg-accent rounded-full group-hover:scale-125 group-hover:shadow-lg group-hover:shadow-accent/50 transition-all duration-300" />
              <span className="group-hover:font-semibold transition-all duration-300">Personalized AI tools</span>
            </div>
          </div>

          {/* Testimonial */}
          <div className={`text-center mt-6 transition-all duration-700 delay-800 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <p className="text-sm text-muted-foreground/80 font-medium">
              ⭐ <span className="text-accent font-semibold">5/5 rating</span> from traders who tried our AI demo
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className={`text-center transition-all duration-700 delay-900 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <MagneticButton strength={0.2}>
              <Button 
                size="lg" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg px-8 py-6 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 relative overflow-hidden group"
              >
                <span className="relative z-10">Start Your Free Trial</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <div className="ml-3 flex items-center justify-center w-8 h-8 rounded-full bg-primary-foreground/20 group-hover:bg-primary-foreground/30 transition-colors duration-300 relative z-10">
                  <ArrowUpRight className="h-5 w-5 group-hover:rotate-45 transition-transform duration-300" />
                </div>
              </Button>
            </MagneticButton>
            
            <MagneticButton strength={0.2}>
              <Button 
                size="lg"
                variant="outline"
                className="bg-background/50 hover:bg-background/80 text-foreground hover:text-foreground border-border/50 hover:border-border font-semibold text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 backdrop-blur-sm relative overflow-hidden group"
                asChild
              >
                <a href="https://discord.gg/sjsJwdZPew" target="_blank" rel="noopener noreferrer" className="flex items-center relative z-10">
                  Join Discord Community
                  <svg className="ml-3 h-6 w-6 group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                  </svg>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                </a>
              </Button>
            </MagneticButton>
          </div>
          
          <p className="text-base text-muted-foreground/70 font-medium">
            Join 500+ traders • 7‑Day Risk‑Free Trial • No Credit Card Required
          </p>
        </div>
      </div>
    </section>
  );
};

export default VideoSection;
