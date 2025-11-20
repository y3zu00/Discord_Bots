import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowUpRight, CheckCircle2, TrendingUp, Store, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import tradingviewLogo from "@/assets/tradingviewlogo.png";
import whopLogo from "@/assets/whop.jpg";
import sharinganGif from "@/assets/sharingan-ringan.gif";
import redsnowGif from "@/assets/redsnow2.mp4";
import whaleFinderBg from "@/assets/rezerowhales.mp4";
import iceElvesBg from "@/assets/ice-elves.mp4";
import ghostedNightBg from "@/assets/ghostednight.gif";
import sharinganSound from "@/assets/sharingan_sound_only.mp3";
import iceArrowSound from "@/assets/ice-arrow.mp3";
import whaleSound from "@/assets/whalesound.mp3";
import ghostWhisperSound from "@/assets/ghostwhisper.mp3";

type IndicatorMeta = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  status: "live" | "coming-soon";
  background: string;
  overlay: string;
  focus: string[];
  features: string[];
  bestFor: string[];
  releaseNote: string;
};

const INDICATORS: IndicatorMeta[] = [
  {
    id: "whale-finder",
    title: "Big Whale Finder PRO",
    subtitle: "Detect institutional ‘whale’ footprints before price explodes.",
    description:
      "Designed directly from our Big Whale Finder PRO signal stack on the landing page. It watches BWF‑Index, wick‑to‑body relationships, iceberg prints, and abnormal delta to surface accumulation / distribution zones in real time.",
    status: "live",
    background: whaleFinderBg,
    overlay: "from-sky-500/70 via-cyan-400/60 to-transparent",
    focus: ["Order Flow", "Volume Delta", "Block Orders"],
    features: [
      "BWF‑Index & absorption heat map overlay",
      "Delta spike + iceberg spoofing callouts",
      "Session-aware alerts piped into Discord & webhooks",
      "Zone painter for accumulation / distribution tracking",
    ],
    bestFor: ["Crypto majors", "US indices", "High beta equities"],
    releaseNote: "Webhook, Discord, and data feeds are live. Pine drawing unlocks immediately when the repo ships.",
  },
  {
    id: "sharingan",
    title: "Sharingan Market Vision Pro",
    subtitle: "All-in-one smart money suite from the landing page hero.",
    description:
      "The Sharingan indicator mirrors the landing visuals exactly: Red Snow background, market structure, liquidity sweeps, FVG + order block logic, and volume delta overlays fused with smart sessions.",
    status: "coming-soon",
    background: redsnowGif,
    overlay: "from-rose-500/70 via-orange-400/50 to-transparent",
    focus: ["Market Structure", "Liquidity", "Volume Delta"],
    features: [
      "Automatic BOS / CHOCH and session killzones",
      "Premium vs discount dealing ranges with mitigation alerts",
      "Order blocks, FVGs, and liquidity sweep tracking",
      "Multi-timeframe confluence meter + probability scoring",
    ],
    bestFor: ["BTC & ETH", "FX majors", "Swing traders"],
    releaseNote: "Final QA in Pine v5. As soon as the code drops, this chart instantly mirrors the landing page look.",
  },
  {
    id: "ice-elves",
    title: "Ice Elves Winter Arrow",
    subtitle: "Premium Frostborne SMC overlay with Koncorde volume intelligence.",
    description:
      "Version 5.0 of Ice Elves fuses BOS/CHoCH, order blocks, FVGs, Koncorde volume, Laguerre filters, dual Williams %R, adaptive risk dashboards, and ML trend scoring into a single winter-themed indicator.",
    status: "live",
    background: iceElvesBg,
    overlay: "from-cyan-400/60 via-blue-500/50 to-transparent",
    focus: ["SMC", "Volume Intel", "Adaptive Risk"],
    features: [
      "Koncorde sharks/minnows + trend composite dashboard",
      "Laguerre ribbons, dual Williams %R, and volatility regimes",
      "SMC toolkit: BOS/CHoCH, OB/FVG, liquidity sweeps, premium/discount",
      "Risk center with ATR/percent stops, RR targets, win-rate tracker",
    ],
    bestFor: ["Futures (ES/NQ)", "Crypto majors", "Scalpers & swing traders"],
    releaseNote: "Pine Script v6 build with 100+ inputs, presets, and alert packs now live.",
  },
  {
    id: "ghosted-night",
    title: "Ghosted Night Strategy",
    subtitle: "Institutional footprint strategy scored by modular confluence.",
    description:
      "Ghosted Night watches trend stacks, HTF confirmation, VWAP/volume, structure, smart-money zones, and momentum before arming. Once the module score hits threshold, Ghost Impulse handles entries with ATR or percent-based risk.",
    status: "coming-soon",
    background: ghostedNightBg,
    overlay: "from-purple-500/60 via-slate-800/60 to-transparent",
    focus: ["Smart Money", "Module Score", "VWAP Liquidity"],
    features: [
      "Six institutional pillars + adjustable Min Modules to Arm",
      "Ghost Panel showing module status, bias, and liquidity readouts",
      "Ghost Impulse trigger with ATR/percent risk + auto targets",
      "Optional OB/FVG drawing, HTF EMA filter, and alerts baked in",
    ],
    bestFor: ["Crypto majors", "Forex pairs", "Equities & futures trend plays"],
    releaseNote: "Strategy v2.0 is staged—panel + signals land as soon as Pine is published.",
  },
];

const HERO_HIGHLIGHTS = [
  { label: "Delivery", value: "TradingView + Discord", icon: TrendingUp },
  { label: "Licensing", value: "Powered by Whop", icon: Store },
  { label: "Build", value: "Pine v5 + Webhooks", icon: Sparkles },
];

const Indicators: React.FC = () => {
  const [selectedId, setSelectedId] = React.useState<string>(INDICATORS[0]?.id ?? "");
  const [showAllIndicators, setShowAllIndicators] = React.useState(false);
  const chartContainerRef = React.useRef<HTMLDivElement>(null);
  const taWidgetRef = React.useRef<HTMLDivElement>(null);
  const sharinganAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const iceArrowAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const whaleAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const ghostWhisperAudioRef = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: "BINANCE:BTCUSD",
      interval: "60",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      calendar: false,
      studies: [],
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, []);

  React.useEffect(() => {
    const container = taWidgetRef.current;
    if (!container) return;
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      interval: "1h",
      width: "100%",
      height: 360,
      isTransparent: true,
      symbol: "BINANCE:BTCUSD",
      showIntervalTabs: true,
      displayMode: "single",
      locale: "en",
      colorTheme: "dark",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, []);

  // Initialize audio element for Sharingan sound
  React.useEffect(() => {
    if (!sharinganAudioRef.current) {
      sharinganAudioRef.current = new Audio(sharinganSound);
      sharinganAudioRef.current.preload = "auto";
    }
    return () => {
      if (sharinganAudioRef.current) {
        sharinganAudioRef.current.pause();
        sharinganAudioRef.current.currentTime = 0;
      }
    };
  }, []);

  // Initialize audio element for Ice Elves sound
  React.useEffect(() => {
    if (!iceArrowAudioRef.current) {
      iceArrowAudioRef.current = new Audio(iceArrowSound);
      iceArrowAudioRef.current.preload = "auto";
    }
    return () => {
      if (iceArrowAudioRef.current) {
        iceArrowAudioRef.current.pause();
        iceArrowAudioRef.current.currentTime = 0;
      }
    };
  }, []);

  // Initialize audio element for Whale Finder sound
  React.useEffect(() => {
    if (!whaleAudioRef.current) {
      whaleAudioRef.current = new Audio(whaleSound);
      whaleAudioRef.current.preload = "auto";
    }
    return () => {
      if (whaleAudioRef.current) {
        whaleAudioRef.current.pause();
        whaleAudioRef.current.currentTime = 0;
      }
    };
  }, []);

  // Initialize audio element for Ghosted Night sound
  React.useEffect(() => {
    if (!ghostWhisperAudioRef.current) {
      ghostWhisperAudioRef.current = new Audio(ghostWhisperSound);
      ghostWhisperAudioRef.current.preload = "auto";
    }
    return () => {
      if (ghostWhisperAudioRef.current) {
        ghostWhisperAudioRef.current.pause();
        ghostWhisperAudioRef.current.currentTime = 0;
      }
    };
  }, []);

  const activeIndicator = React.useMemo(
    () => INDICATORS.find((indicator) => indicator.id === selectedId) ?? INDICATORS[0],
    [selectedId]
  );
  const visibleIndicators = React.useMemo(
    () => (showAllIndicators ? INDICATORS : INDICATORS.slice(0, 2)),
    [showAllIndicators]
  );
  const detailBackgroundStyle = React.useMemo(() => {
    if (!activeIndicator?.background) return undefined;
    if (activeIndicator.background.endsWith('.mp4')) {
      return { hasVideo: true, videoSrc: activeIndicator.background } as any;
    }
    return {
      backgroundImage: `linear-gradient(135deg, rgba(8,9,20,0.85), rgba(8,9,20,0.65)), url(${activeIndicator.background})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    } as React.CSSProperties;
  }, [activeIndicator?.background]);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-[#0f111c] via-[#0c0f1a] to-[#1a0f1f] px-6 py-5 sm:p-7 shadow-[0_30px_120px_-60px_rgba(12,10,32,0.75)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12), transparent 45%), radial-gradient(circle at 80% 0%, rgba(255,112,67,0.15), transparent 55%)",
          }}
        />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <Badge variant="outline" className="w-fit gap-2 border-white/20 bg-white/5 text-white">
              <Sparkles className="h-4 w-4 text-amber-300" />
              TradingView Indicator Lab
            </Badge>
            <h1 className="text-[2rem] font-bold leading-[1.1] sm:text-[2.4rem]">
              Switch between every JOAT indicator without leaving the dashboard.
            </h1>
            <p className="text-sm text-white/70 sm:text-base">
              This mirrors the landing-page glow while plugging into real TradingView widgets. Indicator licensing and downloads
              stay synced through Whop, so when the Pine scripts land the UX is already dialed.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="gap-2 bg-white/90 text-background hover:bg-white">
                <a href="https://www.tradingview.com/widget/#charts" target="_blank" rel="noopener noreferrer">
                  TradingView Widgets
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" asChild>
                <a
                  href="https://www.tradingview.com/support/solutions/43000521824-indicators-and-strategies/?utm_source=joat"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Indicator Docs
                </a>
              </Button>
            </div>
          </div>
          <div className="w-full max-w-lg space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {HERO_HIGHLIGHTS.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur transition duration-300 hover:border-white/40 hover:bg-white/10"
                >
                  <item.icon className="mx-auto mb-2 h-5 w-5 text-amber-300" />
                  <p className="text-xs uppercase tracking-wide text-white/60">{item.label}</p>
                  <p className="text-sm font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/80 backdrop-blur">
              <img src={whopLogo} alt="Whop" className="h-8 w-8 rounded-full border border-white/20 object-cover" />
              <div className="flex-1">
                <p className="font-semibold text-white/90">Indicators delivered via Whop</p>
                <p className="text-[11px] text-white/70">Manage access, billing, and downloads inside our Whop hub.</p>
              </div>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" asChild>
                <a href="https://whop.com/jack-of-all-trades-official" target="_blank" rel="noopener noreferrer">
                  Visit Whop
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
        <div className="space-y-6">
          <Card className="border-white/10 bg-card/80">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center justify-between">
                Indicator Library
                <Badge variant="secondary" className="text-xs">
                  {INDICATORS.length} suites
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Add more indicators by pushing to the <code className="text-[11px]">INDICATORS</code> array—no extra UI work.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleIndicators.map((indicator) => {
                const isActive = indicator.id === activeIndicator?.id;
                const handleIndicatorClick = () => {
                  setSelectedId(indicator.id);
                  // Play sound only for Sharingan indicator
                  if (indicator.id === "sharingan" && sharinganAudioRef.current) {
                    sharinganAudioRef.current.currentTime = 0; // Reset to start
                    sharinganAudioRef.current.play().catch((err) => {
                      // Silently handle autoplay restrictions
                      console.debug("Audio play failed:", err);
                    });
                  }
                  // Play sound only for Ice Elves indicator
                  if (indicator.id === "ice-elves" && iceArrowAudioRef.current) {
                    iceArrowAudioRef.current.currentTime = 0; // Reset to start
                    iceArrowAudioRef.current.play().catch((err) => {
                      // Silently handle autoplay restrictions
                      console.debug("Audio play failed:", err);
                    });
                  }
                  // Play sound only for Whale Finder indicator
                  if (indicator.id === "whale-finder" && whaleAudioRef.current) {
                    whaleAudioRef.current.currentTime = 0; // Reset to start
                    whaleAudioRef.current.play().catch((err) => {
                      // Silently handle autoplay restrictions
                      console.debug("Audio play failed:", err);
                    });
                  }
                  // Play sound only for Ghosted Night indicator
                  if (indicator.id === "ghosted-night" && ghostWhisperAudioRef.current) {
                    ghostWhisperAudioRef.current.currentTime = 0; // Reset to start
                    ghostWhisperAudioRef.current.play().catch((err) => {
                      // Silently handle autoplay restrictions
                      console.debug("Audio play failed:", err);
                    });
                  }
                };
                const isVideoBg = indicator.background.endsWith('.mp4');
                return (
                  <button
                    key={indicator.id}
                    onClick={handleIndicatorClick}
                    className={cn(
                      "group relative isolate w-full overflow-hidden rounded-3xl border px-5 py-5 text-left transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      isActive ? "border-white/40 shadow-lg shadow-amber-500/20" : "border-white/10 hover:border-white/25"
                    )}
                    style={!isVideoBg ? {
                      backgroundImage: `linear-gradient(135deg, rgba(6,7,16,0.85), rgba(6,10,25,0.55)), url(${indicator.background})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    } : undefined}
                  >
                    {isVideoBg && (
                      <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 rounded-3xl z-0 object-cover w-full h-full"
                        src={indicator.background}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-transparent to-black/20 opacity-50 transition duration-500 group-hover:opacity-80 z-[1]" />
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1 text-white relative z-10">
                        <p className="text-xs uppercase tracking-wide text-white/70">
                          {indicator.status === "live" ? "Live" : "Shipping soon"}
                        </p>
                        <p className="text-xl font-semibold">{indicator.title}</p>
                        <p className="text-sm text-white/80">{indicator.subtitle}</p>
                      </div>
                      <Badge
                        variant={isActive ? "default" : "outline"}
                        className={cn(
                          "border-0 text-xs",
                          isActive ? "bg-white/20 text-white" : "bg-white/10 text-white/80"
                        )}
                      >
                        {isActive ? "Active" : "Preview"}
                      </Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 relative z-10">
                      {indicator.focus.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-white/80"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
              <Button
                variant="ghost"
                className="w-full justify-center gap-2 text-white/70 hover:text-white"
                onClick={() => setShowAllIndicators((prev) => !prev)}
              >
                {showAllIndicators ? (
                  <>
                    Show less
                    <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Show all indicators
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card
            className="border-white/10 bg-card/80 overflow-hidden relative"
            style={detailBackgroundStyle && !detailBackgroundStyle.hasVideo ? detailBackgroundStyle : undefined}
          >
            {detailBackgroundStyle?.hasVideo ? (
              <>
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 z-0 object-cover w-full h-full"
                  src={detailBackgroundStyle.videoSrc}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-black/50 to-black/30 pointer-events-none z-[1]" />
              </>
            ) : detailBackgroundStyle ? (
              <div className="absolute inset-0 bg-gradient-to-br from-black/50 to-black/30 pointer-events-none z-[1]" />
            ) : null}
            <CardHeader className="space-y-1">
              <Badge
                variant="outline"
                className={cn(
                  "w-fit border-0 text-xs",
                  activeIndicator?.status === "live" ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"
                )}
              >
                {activeIndicator?.status === "live" ? "Live on TradingView" : "Coming Soon"}
              </Badge>
              <CardTitle className={detailBackgroundStyle ? "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]" : ""}>
                {activeIndicator?.title}
              </CardTitle>
              <p className={cn("text-sm", detailBackgroundStyle ? "text-white/80" : "text-muted-foreground")}>
                {activeIndicator?.description}
              </p>
            </CardHeader>
            <CardContent className="space-y-5 relative z-10">
              <div className="flex flex-wrap gap-2">
                {activeIndicator?.bestFor.map((item) => (
                  <Badge
                    key={item}
                    variant="outline"
                    className={cn(
                      "text-xs",
                      detailBackgroundStyle ? "border-white/30 bg-white/10 text-white" : "border-primary/20 bg-primary/5 text-primary"
                    )}
                  >
                    {item}
                  </Badge>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {activeIndicator?.features.map((feature) => (
                  <div
                    key={feature}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl p-4 text-sm",
                      detailBackgroundStyle
                        ? "border-white/20 bg-black/30 text-white/90 backdrop-blur"
                        : "border border-white/10 bg-white/5 text-white/80"
                    )}
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <p className={cn("text-xs", detailBackgroundStyle ? "text-white/80" : "text-muted-foreground/80")}>
                {activeIndicator?.releaseNote}
              </p>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white/80 sm:justify-between">
                <div className="flex items-center gap-3">
                  <img src={whopLogo} alt="Whop" className="h-8 w-8 rounded-lg border border-white/20 object-cover" />
                  <div>
                    <p className="text-sm font-semibold text-white">Access + billing on Whop</p>
                    <p className="text-xs text-white/70">Activate licenses, download scripts, manage tiers.</p>
                  </div>
                </div>
                <Button size="sm" className="bg-white/80 text-background hover:bg-white" asChild>
                  <a href="https://whop.com/jack-of-all-trades-official" target="_blank" rel="noopener noreferrer">
                    Open Whop Hub
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden border-white/10 bg-card/80">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div>
                <p className="text-sm font-semibold text-white">TradingView Advanced Chart</p>
                <p className="text-xs text-white/70">
                  Preview mode — overlays render the moment Pine scripts ship.
                </p>
              </div>
              <div className="flex items-center gap-2 text-white/60">
                <img src={tradingviewLogo} alt="TradingView" className="h-6 w-6 rounded-full border border-white/20" />
                <span className="text-xs uppercase tracking-wide">BTCUSD</span>
              </div>
            </div>
            <CardContent className="h-[520px] p-0">
              <div ref={chartContainerRef} className="h-full w-full" />
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-card/80">
            <CardHeader className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" />
                Quick Technicals
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                TradingView&apos;s technical analysis widget keeps the preview honest while we wire overlays.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div ref={taWidgetRef} className="tradingview-widget-container">
                <div className="tradingview-widget-container__widget" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Indicators;

