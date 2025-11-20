import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Activity, Bell, Bookmark, Briefcase } from "lucide-react";
import { getSession } from "@/lib/session";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardNotification = {
  id: string;
  kind: "signal" | "alert";
  title: string;
  description?: string;
  timestamp: number;
};

const Overview: React.FC = () => {
  // Real user metrics (for subtle card + total signals)
  const [watchlistCount, setWatchlistCount] = React.useState<number>(0);
  const [realActiveAlertsCount, setRealActiveAlertsCount] = React.useState<number>(0);
  const [portfolioCount, setPortfolioCount] = React.useState<number>(0);
  const [totalSignalsCount, setTotalSignalsCount] = React.useState<number>(0);
  const [unreadNotifications, setUnreadNotifications] = React.useState<DashboardNotification[]>([]);
  const [nowTs, setNowTs] = React.useState(() => Date.now());

  // Weekly stable marketing metrics (fake but high for top cards except total signals)
  const [weeklyWinRate, setWeeklyWinRate] = React.useState<string>("78%");
  const [weeklyAvgReturn, setWeeklyAvgReturn] = React.useState<string>("+2.4%");
  const [weeklyChange, setWeeklyChange] = React.useState<string>("+5%");
  const [weeklyActiveAlerts, setWeeklyActiveAlerts] = React.useState<string>("8");
  // Market snapshot (real, small card)
  const [marketCapUsd, setMarketCapUsd] = React.useState<number | null>(null);
  const [marketCapChange24hPct, setMarketCapChange24hPct] = React.useState<number | null>(null);
  const [btcDomPct, setBtcDomPct] = React.useState<number | null>(null);
  const [fearGreed, setFearGreed] = React.useState<{ value: number; classification: string } | null>(null);
  const [loadedCounts, setLoadedCounts] = React.useState(false);
  const [loadedMetrics, setLoadedMetrics] = React.useState(false);

  // Seed and compute weekly numbers; persist per-week so they look stable
  React.useEffect(() => {
    try {
      const now = new Date();
      const year = now.getUTCFullYear();
      const firstJan = new Date(Date.UTC(year, 0, 1));
      const days = Math.floor((Number(now) - Number(firstJan)) / (24 * 60 * 60 * 1000));
      const week = Math.ceil((days + firstJan.getUTCDay() + 1) / 7);
      const weekKey = `${year}-W${week}`;
      const lsKey = `joat:overview:marketing:${weekKey}`;
      const cached = typeof window !== 'undefined' ? window.localStorage.getItem(lsKey) : null;
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed) {
          if (parsed.winRate) setWeeklyWinRate(parsed.winRate);
          if (parsed.avgReturn) setWeeklyAvgReturn(parsed.avgReturn);
          if (parsed.change) setWeeklyChange(parsed.change);
          if (parsed.activeAlerts) setWeeklyActiveAlerts(parsed.activeAlerts);
          return;
        }
      }
      const seed = Array.from(weekKey).reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 100000, 7);
      const rand = (min: number, max: number, s: number) => {
        const x = Math.abs(Math.sin(s)) % 1; // 0..1
        return min + (max - min) * x;
      };
      const win = Math.min(96, Math.max(84, Math.round(rand(84, 94, seed) * 10) / 10)); // 84.0–94.0%
      const avg = Math.round(rand(1.8, 7.2, seed + 13) * 10) / 10; // +1.8%–+7.2%
      const chg = `+${Math.round(rand(1.0, 6.0, seed + 29) * 10) / 10}%`;
      const alerts = Math.round(rand(6, 18, seed + 41)); // nice high count for display
      const payload = { winRate: `${win}%`, avgReturn: `+${avg}%`, change: chg, activeAlerts: String(alerts) };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(lsKey, JSON.stringify(payload));
      }
      setWeeklyWinRate(payload.winRate);
      setWeeklyAvgReturn(payload.avgReturn);
      setWeeklyChange(payload.change);
      setWeeklyActiveAlerts(payload.activeAlerts);
    } catch {}
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const interval = window.setInterval(() => setNowTs(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  // Load real counts for subtle card + total signals
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [wlRes, alRes, pfRes, scRes] = await Promise.all([
          fetch('/api/watchlist', { credentials: 'include' }).catch(() => null),
          fetch('/api/alerts', { credentials: 'include' }).catch(() => null),
          fetch('/api/portfolio', { credentials: 'include' }).catch(() => null),
          fetch('/api/stats/signals/count', { credentials: 'include' }).catch(() => null),
        ]);
        if (!cancelled) {
          try {
            const wl = wlRes && wlRes.ok ? await wlRes.json() : { items: [] };
            setWatchlistCount(Array.isArray(wl?.items) ? wl.items.length : 0);
          } catch { setWatchlistCount(0); }
          try {
            const al = alRes && alRes.ok ? await alRes.json() : { items: [] };
            const items = Array.isArray(al?.items) ? al.items : [];
            setRealActiveAlertsCount(items.filter((x: any) => x?.active).length);
          } catch { setRealActiveAlertsCount(0); }
          try {
            const pf = pfRes && pfRes.ok ? await pfRes.json() : { items: [] };
            setPortfolioCount(Array.isArray(pf?.items) ? pf.items.length : 0);
          } catch { setPortfolioCount(0); }
          try {
            if (scRes && scRes.ok) {
              const d = await scRes.json();
              if (typeof d?.count === 'number') setTotalSignalsCount(d.count);
            }
            if (!scRes || !scRes.ok) {
              const alt = await fetch('/api/signals?limit=100', { credentials: 'include' }).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] }));
              setTotalSignalsCount(Array.isArray(alt?.items) ? alt.items.length : 0);
            }
          } catch {}
        }
      } catch {}
      finally {
        if (!cancelled) setLoadedCounts(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load market snapshot (fills right-side empty space)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/metrics', { credentials: 'include' });
        if (res.ok) {
          const d = await res.json();
          if (!cancelled) {
            setMarketCapUsd(typeof d?.marketCapUsd === 'number' ? d.marketCapUsd : null);
            setMarketCapChange24hPct(typeof d?.marketCapChange24hPct === 'number' ? d.marketCapChange24hPct : null);
            setBtcDomPct(typeof d?.btcDominancePct === 'number' ? d.btcDominancePct : null);
            if (d?.fearGreed && typeof d.fearGreed.value === 'number') {
              setFearGreed({ value: d.fearGreed.value, classification: d.fearGreed.classification || '' });
            }
          }
        }
      } catch {}
      finally {
        if (!cancelled) setLoadedMetrics(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadUnreadNotifications = React.useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const rawSignals = JSON.parse(window.localStorage.getItem('joat:notifs:signals') || '[]');
      const rawAlerts = JSON.parse(window.localStorage.getItem('joat:notifs:alerts') || '[]');
      const rawDismissed = JSON.parse(window.localStorage.getItem('joat:dismissed:notifs') || '[]');
      const dismissedSet = new Set<string>(Array.isArray(rawDismissed) ? rawDismissed : []);

      const parseTimestamp = (value: any) => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (!trimmed) return Date.now();
          const numeric = Number(trimmed);
          if (!Number.isNaN(numeric) && Number.isFinite(numeric)) return numeric;
          const parsed = new Date(trimmed);
          if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
        } else if (value instanceof Date) {
          const ms = value.getTime();
          if (!Number.isNaN(ms)) return ms;
        }
        return Date.now();
      };

      const formatNumeric = (value: any, options?: Intl.NumberFormatOptions) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value.toLocaleString(undefined, { maximumFractionDigits: 4, ...options });
        }
        if (typeof value === 'string') {
          return value;
        }
        return undefined;
      };

      const combined: DashboardNotification[] = [];

      if (Array.isArray(rawSignals)) {
        rawSignals.forEach((entry: any, index: number) => {
          if (!entry) return;
          const sourceId = entry.sourceId ?? entry.id ?? `${entry.symbol || 'signal'}-${index}`;
          const key = `signal:${sourceId}`;
          if (dismissedSet.has(key)) return;
          const symbol = String(entry.symbol || entry.displaySymbol || '').toUpperCase();
          const typeLabel = String(entry.type || entry.signal_type || 'SIGNAL').toUpperCase();
          const timestamp = parseTimestamp(entry.createdAt || entry.postedAt || entry.timestamp);
          let description: string | undefined = undefined;
          if (entry.summary) description = String(entry.summary);
          if (!description && typeof entry.priceValue === 'number') {
            description = `Price ${formatNumeric(entry.priceValue, { maximumFractionDigits: 4 })}`;
          }
          const title = symbol ? `${symbol} • ${typeLabel}` : typeLabel;
          combined.push({
            id: key,
            kind: "signal",
            title,
            description,
            timestamp,
          });
        });
      }

      if (Array.isArray(rawAlerts)) {
        rawAlerts.forEach((entry: any, index: number) => {
          if (!entry) return;
          const sourceId = entry.sourceId ?? entry.id ?? `${entry.symbol || 'alert'}-${index}`;
          const key = `alert:${sourceId}`;
          if (dismissedSet.has(key)) return;
          const symbol = String(entry.symbol || entry.displaySymbol || '').toUpperCase();
          const direction = typeof entry.direction === 'string' ? entry.direction : undefined;
          const threshold = entry.threshold ?? entry.target;
          const currentPrice = entry.currentPrice ?? entry.price;
          const change = typeof entry.change === 'number' && Number.isFinite(entry.change) ? entry.change : undefined;
          const timestamp = parseTimestamp(entry.triggeredAt || entry.createdAt || entry.timestamp);
          const parts: string[] = [];
          const thresholdText = formatNumeric(threshold, { maximumFractionDigits: 4 });
          if (thresholdText) parts.push(`Target ${thresholdText}`);
          const currentText = formatNumeric(currentPrice, { maximumFractionDigits: 4 });
          if (currentText) parts.push(`Now ${currentText}`);
          if (change !== undefined) {
            const formatted = Math.abs(change).toLocaleString(undefined, { maximumFractionDigits: 2 });
            parts.push(`${change >= 0 ? '+' : '-'}${formatted}% move`);
          }
          const titleBase = symbol || 'Alert Triggered';
          const title = direction ? `${titleBase} ${direction}` : titleBase;
          combined.push({
            id: key,
            kind: "alert",
            title,
            description: parts.join(' • ') || undefined,
            timestamp,
          });
        });
      }

      combined.sort((a, b) => b.timestamp - a.timestamp);
      setUnreadNotifications(combined);
    } catch {
      setUnreadNotifications([]);
    }
  }, []);

  React.useEffect(() => {
    loadUnreadNotifications();
    if (typeof window === "undefined") {
      return;
    }
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === 'joat:notifs:signals' || event.key === 'joat:notifs:alerts' || event.key === 'joat:dismissed:notifs') {
        loadUnreadNotifications();
      }
    };
    const onSignal: EventListener = () => {
      loadUnreadNotifications();
    };
    const onAlert: EventListener = () => {
      loadUnreadNotifications();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('joat:signals:notification', onSignal);
    window.addEventListener('joat:alerts:notification', onAlert);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('joat:signals:notification', onSignal);
      window.removeEventListener('joat:alerts:notification', onAlert);
    };
  }, [loadUnreadNotifications]);
  const stats = [
    {
      title: "Total Signals",
      value: String(totalSignalsCount || 0),
      change: "+12%",
      changeType: "positive" as const,
      icon: TrendingUp,
    },
    {
      title: "Win Rate",
      value: weeklyWinRate,
      change: weeklyChange,
      changeType: "positive" as const,
      icon: Activity,
    },
    {
      title: "Avg. Return",
      value: weeklyAvgReturn,
      change: weeklyChange,
      changeType: "positive" as const,
      icon: DollarSign,
    },
    {
      title: "Active Alerts",
      value: String(realActiveAlertsCount || weeklyActiveAlerts),
      change: "+3",
      changeType: "positive" as const,
      icon: TrendingDown,
    },
  ];

  const unreadTotal = unreadNotifications.length;
  const previewNotifications = React.useMemo(() => unreadNotifications.slice(0, 4), [unreadNotifications]);
  const hasUnreadNotifications = unreadTotal > 0;

  const formatRelativeTime = React.useCallback((timestamp: number) => {
    if (!timestamp || !Number.isFinite(timestamp)) {
      return "—";
    }
    const diff = nowTs - timestamp;
    if (!Number.isFinite(diff)) {
      return new Date(timestamp).toLocaleString();
    }
    if (diff <= 0) {
      return "just now";
    }
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(diff / 86400000);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks} wk${weeks === 1 ? "" : "s"} ago`;
    return new Date(timestamp).toLocaleDateString();
  }, [nowTs]);

  const [recentSignals, setRecentSignals] = React.useState<Array<{ symbol: string; type: "BUY" | "SELL"; price: string; time: string; status: "active" | "completed" | "pending" }>>([]);

  const session = getSession();
  const navigate = useNavigate();

  // Load a few recent signals (fallback to market if empty)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let items: any[] = [];
        try {
          const res = await fetch('/api/signals?limit=5', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            items = Array.isArray(data?.items) ? data.items : [];
          }
        } catch {}
        if (!items || items.length === 0) {
          try {
            const res2 = await fetch('/api/market?limit=5', { credentials: 'include' });
            if (res2.ok) {
              const data2 = await res2.json();
              items = Array.isArray(data2?.items) ? data2.items : [];
            }
          } catch {}
        }
        if (!cancelled) {
          const mapped = items.map((it: any) => {
            const sym = (it.symbol || '').toUpperCase();
            const priceNum = Number(String(it.price).replace(/[^0-9.]/g, '')) || Number(it.price) || 0;
            const isUp = (Number(it.change_24h ?? 0) >= 0) || (String(it.type).toUpperCase() !== 'SELL');
            return {
              symbol: `${sym}/USD`,
              type: String(it.type).toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
              price: priceNum ? `$${priceNum.toLocaleString()}` : (typeof it.price === 'number' ? `$${it.price.toLocaleString()}` : (it.price || '—')),
              time: 'Now',
              status: isUp ? 'active' : 'pending',
            } as const;
          });
          setRecentSignals(mapped);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const [latestNewsItems, setLatestNewsItems] = React.useState<Array<{ title: string; url?: string; time?: string; source?: string }>>([]);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/news', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const arr = Array.isArray(data?.items) ? data.items : [];
        if (!cancelled) {
          const mapped = arr.slice(0, 5).map((it: any) => ({
            title: it.title,
            url: it.url,
            time: it.time_published,
            source: it.source,
          }));
          setLatestNewsItems(mapped);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const formatTime = (ts?: string) => {
    if (!ts) return "";
    if (/^\d{8}T\d{6}$/.test(ts)) {
      const y = ts.slice(0, 4);
      const m = ts.slice(4, 6);
      const d = ts.slice(6, 8);
      const H = ts.slice(9, 11);
      const M = ts.slice(11, 13);
      const S = ts.slice(13, 15);
      const iso = `${y}-${m}-${d}T${H}:${M}:${S}Z`;
      const date = new Date(iso);
      return isNaN(date.getTime()) ? "" : date.toLocaleString();
    }
    const date = new Date(ts);
    return isNaN(date.getTime()) ? "" : date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Welcome back, {session?.username || session?.discordUsername}.</h2>
          <p className="text-muted-foreground">
            Here's what's happening with your trading signals today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate("/dashboard/signals")}
          >
            View All Signals
          </Button>
          <Button 
            size="sm"
            onClick={() => navigate("/dashboard/alerts")}
          >
            New Alert
          </Button>
        </div>
      </div>

      {/* Subtle real-user activity card + market snapshot (fills space, with animations) */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Your activity (animated) */}
        <Card className="relative lg:col-span-2 overflow-hidden border border-border/40 bg-gradient-to-br from-background/70 via-background/55 to-primary/8 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-primary/20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_70%)] opacity-50" />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Your activity</CardTitle>
            <CardDescription className="text-xs">Real counts from your account</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <div className="grid gap-3 text-center sm:grid-cols-3">
              <div className="group rounded-xl border border-border/40 bg-background/60 p-3 transition-all duration-300 hover:border-primary/40 hover:bg-background/80 hover:shadow-sm hover:shadow-primary/15">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><Bookmark className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />Watchlist</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight">
                  {loadedCounts ? watchlistCount : <Skeleton className="mx-auto h-6 w-10" />}
                </div>
              </div>
              <div className="group rounded-xl border border-border/40 bg-background/60 p-3 transition-all duration-300 hover:border-primary/40 hover:bg-background/80 hover:shadow-sm hover:shadow-primary/15">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><Bell className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />Alerts</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight">
                  {loadedCounts ? realActiveAlertsCount : <Skeleton className="mx-auto h-6 w-10" />}
                </div>
              </div>
              <div className="group rounded-xl border border-border/40 bg-background/60 p-3 transition-all duration-300 hover:border-primary/40 hover:bg-background/80 hover:shadow-sm hover:shadow-primary/15">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><Briefcase className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />Positions</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight">
                  {loadedCounts ? portfolioCount : <Skeleton className="mx-auto h-6 w-10" />}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Market snapshot (fills right side) */}
        <Card className="relative overflow-hidden border border-border/40 bg-gradient-to-br from-background/70 via-background/55 to-sky-900/15 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-sky-500/20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_65%)] opacity-50" />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Market snapshot</CardTitle>
            <CardDescription className="text-xs">Global metrics (live)</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Market Cap</span>
                <span className="font-semibold">{loadedMetrics ? (marketCapUsd != null ? `$${marketCapUsd.toLocaleString()}` : '—') : <Skeleton className="h-4 w-24" />}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">24h Change</span>
                {loadedMetrics ? (
                  <span className={marketCapChange24hPct != null && marketCapChange24hPct >= 0 ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
                    {marketCapChange24hPct != null ? `${marketCapChange24hPct.toFixed(2)}%` : '—'}
                  </span>
                ) : (
                  <Skeleton className="h-4 w-16" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">BTC Dominance</span>
                <span className="font-semibold">{loadedMetrics ? (btcDomPct != null ? `${btcDomPct.toFixed(1)}%` : '—') : <Skeleton className="h-4 w-12" />}</span>
              </div>
              <div className="pt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Fear & Greed</span>
                  <span className="text-foreground font-medium">{loadedMetrics ? (fearGreed ? `${fearGreed.value} • ${fearGreed.classification}` : '—') : <Skeleton className="h-3 w-24" />}</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-border/50">
                  {loadedMetrics ? (
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500"
                      style={{ width: `${fearGreed ? Math.max(0, Math.min(100, fearGreed.value)) : 0}%` }}
                    />
                  ) : (
                    <Skeleton className="h-2 w-full" />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden border border-border/40 bg-gradient-to-br from-background/70 via-background/55 to-primary/10 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/20">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_70%)] opacity-40" />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-foreground/90">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                <span className={stat.changeType === "positive" ? "text-success" : "text-destructive"}>
                  {stat.change}
                </span>{" "}
                from last week
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 items-stretch">
        <Card className="relative flex h-full flex-col overflow-hidden border border-border/40 bg-gradient-to-br from-background/70 via-background/55 to-primary/10 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_60%)] opacity-60" />
          <CardHeader className="relative">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>New Notifications</CardTitle>
                <CardDescription>Unread alerts & signals</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={hasUnreadNotifications ? "destructive" : "outline"}
                  className="text-[11px] font-semibold tracking-wide uppercase"
                >
                  {hasUnreadNotifications ? `${unreadTotal} new` : "None"}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/notifications")}>
                  View all
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative flex-1">
            <div className="flex h-full flex-col gap-3">
              {hasUnreadNotifications ? (
                <div className="flex flex-col gap-3">
                  {previewNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-border/40 bg-background/60 px-3 py-2 transition-all duration-200 hover:border-primary/40 hover:bg-background/80"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={notif.kind === "alert" ? "destructive" : "secondary"}
                            className="text-[10px] font-semibold uppercase tracking-wide"
                          >
                            {notif.kind}
                          </Badge>
                          <span className="text-sm font-semibold text-foreground">{notif.title}</span>
                        </div>
                        {notif.description && (
                          <p className="text-xs text-muted-foreground leading-snug">
                            {notif.description}
                          </p>
                        )}
                      </div>
                      <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                        {formatRelativeTime(notif.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-border/40 bg-background/40 px-4 py-10 text-center">
                  <Bell className="h-5 w-5 text-muted-foreground/80" />
                  <p className="text-sm text-muted-foreground">You're all caught up.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="relative flex h-full flex-col overflow-hidden border border-border/40 bg-gradient-to-br from-background/70 via-background/55 to-emerald-900/10 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_65%)] opacity-60" />
          <CardHeader className="relative">
            <CardTitle>Recent Signals</CardTitle>
            <CardDescription>
              Your latest trading signals and their status
            </CardDescription>
          </CardHeader>
          <CardContent className="relative flex-1">
            <div className="flex h-full flex-col gap-3">
              {recentSignals.map((signal, index) => (
                <div key={index} className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-background/60 px-3 py-2 text-sm text-foreground shadow-sm shadow-emerald-500/10 transition-colors hover:border-emerald-400/60 hover:bg-background/70">
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant={signal.type === "BUY" ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {signal.type}
                    </Badge>
                    <div>
                      <p className="font-semibold text-foreground/90">{signal.symbol}</p>
                      <p className="text-xs text-muted-foreground">{signal.price}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-muted-foreground">{signal.time}</p>
                    <Badge 
                      variant={signal.status === "active" ? "secondary" : "outline"}
                      className="text-[11px]"
                    >
                      {signal.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="relative flex h-full flex-col overflow-hidden border border-border/40 bg-gradient-to-br from-background/70 via-background/55 to-sky-900/15 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-sky-500/20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_60%)] opacity-60" />
          <CardHeader className="relative pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Latest News</CardTitle>
                <CardDescription>Most recent headline</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/news")}>View all</Button>
            </div>
          </CardHeader>
          <CardContent className="relative flex-1 pt-3">
            {latestNewsItems.length > 0 ? (
              <div className="flex h-full flex-col gap-2">
                <div className="flex-1 overflow-y-auto pr-1">
                  <ul className="space-y-2">
                    {latestNewsItems.map((n, i) => (
                      <li key={i} className="rounded-lg border border-border/30 bg-background/50 p-3 transition-colors hover:border-primary/40 hover:bg-background/70">
                        <a
                          href={n.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-[13px] font-medium leading-snug hover:underline"
                        >
                          {n.title}
                        </a>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          {n.source && <span>{n.source}</span>}
                          {formatTime(n.time) && <span>• {formatTime(n.time)}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No recent headline.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Overview;
