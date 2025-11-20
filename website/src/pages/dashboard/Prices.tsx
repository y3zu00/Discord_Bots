import React, { useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import Sparkline from "@/components/ui/sparkline";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CoinDetails from "@/components/CoinDetails";
import { BookmarkPlus } from "lucide-react";
import { toast } from "sonner";

const CellPct: React.FC<{ v?: number }> = ({ v }) => {
  if (typeof v !== 'number' || !isFinite(v)) return <span className="tabular-nums">—</span>;
  const up = v >= 0;
  return <span className={`tabular-nums font-medium ${up ? 'text-emerald-500' : 'text-red-500'}`}>{v.toFixed(2)}%</span>;
};

const PriceRow = React.memo<{
  r: any;
  i: number;
  setDetailsSym: (sym: string) => void;
  addSymbolToWatchlist: (sym: string) => void;
  addingSymbol: string | null;
  hoveredSymbolRef: React.MutableRefObject<string | null>;
  flashDir?: 'up'|'down'|null;
}>(({ r, i, setDetailsSym, addSymbolToWatchlist, addingSymbol, hoveredSymbolRef, flashDir }) => {
  const symbolUpper = String(r.symbol || '').toUpperCase();
  const handleRowAction = React.useCallback(() => {
    if (!symbolUpper) return;
    setDetailsSym(symbolUpper);
  }, [symbolUpper, setDetailsSym]);

  const handleKey = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleRowAction();
    }
  }, [handleRowAction]);

  return (
    <div
      key={`${r.symbol}-${i}`}
      role="button"
      tabIndex={0}
      onMouseEnter={() => { hoveredSymbolRef.current = symbolUpper; }}
      onMouseLeave={() => { if (hoveredSymbolRef.current === symbolUpper) hoveredSymbolRef.current = null; }}
      onClick={handleRowAction}
      onKeyDown={handleKey}
      className="group relative grid grid-cols-12 items-center gap-4 rounded-xl border-y border-x-0 sm:border border-border/50 bg-background/40 px-2 py-3 transition-[background-color,border-color] duration-150 ease-out hover:border-primary/40 hover:bg-foreground/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
      aria-label={`View details for ${symbolUpper}`}
    >
      <div className="relative z-10 col-span-8 flex min-w-0 items-center gap-2 sm:col-span-4">
        {r.image && <img src={r.image} alt="" className="h-6 w-6 rounded-full ring-1 ring-border object-cover" />}
        <span className="font-medium flex-1 flex items-center gap-2">
          <span className="text-left group-hover:underline">
            {r.name} <span className="text-muted-foreground">{r.symbol}</span>
          </span>
          {Array.isArray(r.spark) && r.spark.length > 0 && (
            <span className="ml-auto hidden sm:block">
              <Sparkline
                values={r.spark.slice(-64)}
                width={96}
                height={28}
                stroke={r.change_7d && r.change_7d >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                strokeWidth={2}
                fill="transparent"
              />
            </span>
          )}
        </span>
      </div>
      <div className={`col-span-4 text-right font-semibold ${symbolUpper === 'BTC' ? 'text-base' : 'text-lg'} sm:text-lg sm:col-span-2`}>
        <span className={`inline-block tabular-nums ${flashDir === 'up' ? 'price-flash-up' : flashDir === 'down' ? 'price-flash-down' : ''}`}>
          {typeof r.price === 'number'
            ? `$${r.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '—'}
        </span>
      </div>
      <div className="sm:hidden col-span-12 mt-2 flex justify-end">
        <button
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/70 text-muted-foreground hover:text-primary hover:border-primary/40"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            addSymbolToWatchlist(String(r.symbol).toUpperCase());
          }}
          disabled={addingSymbol === String(r.symbol).toUpperCase()}
          aria-label="Add to watchlist"
        >
          <BookmarkPlus className={`h-4 w-4 ${addingSymbol === String(r.symbol).toUpperCase() ? 'animate-pulse text-primary' : ''}`} />
        </button>
      </div>
      <div className="hidden text-right sm:block sm:col-span-1"><CellPct v={r.change_1h} /></div>
      <div className="hidden text-right sm:block sm:col-span-1"><CellPct v={r.change_24h} /></div>
      <div className="hidden text-right sm:block sm:col-span-1"><CellPct v={r.change_7d} /></div>
      <div className="hidden text-right sm:block sm:col-span-2">
        <span className="tabular-nums font-medium text-muted-foreground">
          {typeof r.market_cap === 'number'
            ? `$${(r.market_cap / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}B`
            : '—'}
        </span>
      </div>
      <div className="hidden sm:flex col-span-1 items-center justify-end">
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/70 text-muted-foreground hover:text-primary hover:border-primary/40"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            addSymbolToWatchlist(String(r.symbol).toUpperCase());
          }}
          disabled={addingSymbol === String(r.symbol).toUpperCase()}
          aria-label="Add to watchlist"
        >
          <BookmarkPlus className={`h-4 w-4 ${addingSymbol === String(r.symbol).toUpperCase() ? 'animate-pulse text-primary' : ''}`} />
        </button>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the row data actually changed
  return prevProps.r === nextProps.r && prevProps.addingSymbol === nextProps.addingSymbol && prevProps.flashDir === nextProps.flashDir;
});

const Prices: React.FC = () => {
  const [tab, setTab] = React.useState<'crypto'|'stocks'>('crypto');
  const [crypto, setCrypto] = React.useState<any[]>([]);
  const [metrics, setMetrics] = React.useState<any>(null);
  const [ethBtc, setEthBtc] = React.useState<{ ratio?: number; changePct?: number } | null>(null);
  const [hist, setHist] = React.useState<{ btcDom: number[]; fear: number[]; mc: number[]; alt: number[] }>({ btcDom: [], fear: [], mc: [], alt: [] });
  const [cryptoQuery, setCryptoQuery] = React.useState("");
  const [loadingC, setLoadingC] = React.useState(true);
  const [addingSymbol, setAddingSymbol] = React.useState<string | null>(null);
  const [flashByCrypto, setFlashByCrypto] = React.useState<Record<string, 'up'|'down'|null>>({});
  const hoveredSymbolRef = useRef<string | null>(null);

  const fetchEthBtc = useCallback(async () => {
    try {
      const r = await fetch(`/api/coins?symbols=BTC,ETH&_=${Date.now()}`, { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error('failed');
      const d = await r.json();
      const items = Array.isArray(d?.items) ? d.items : [];
      const findCoin = (symbol: string) => items.find((entry: any) => String(entry?.symbol).toUpperCase() === symbol)?.data;
      const btc = findCoin('BTC');
      const eth = findCoin('ETH');
      const btcPrice = typeof btc?.market_data?.current_price === 'number' ? btc.market_data.current_price : undefined;
      const ethPrice = typeof eth?.market_data?.current_price === 'number' ? eth.market_data.current_price : undefined;
      const btc24 = typeof btc?.market_data?.price_change_percentage_24h === 'number' ? btc.market_data.price_change_percentage_24h : undefined;
      const eth24 = typeof eth?.market_data?.price_change_percentage_24h === 'number' ? eth.market_data.price_change_percentage_24h : undefined;
      if (typeof btcPrice === 'number' && typeof ethPrice === 'number' && btcPrice > 0) {
        const ratio = ethPrice / btcPrice;
        let changePct = undefined as number | undefined;
        if (typeof btc24 === 'number' && typeof eth24 === 'number') {
          changePct = ((1 + eth24 / 100) / (1 + btc24 / 100) - 1) * 100;
        }
        return { ratio, changePct } as { ratio: number; changePct?: number };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const FGauge: React.FC<{ value: number }>= ({ value }) => {
    const v = Math.max(0, Math.min(100, value));
    const color = v >= 75 ? '#10b981' : v >= 50 ? '#22c55e' : v >= 25 ? '#eab308' : '#ef4444';
    return (
      <svg width={120} height={70} viewBox="0 0 120 70" aria-hidden>
        {/* background arc */}
        <path d="M 10 60 A 50 50 0 0 1 110 60" stroke="hsl(var(--border))" strokeWidth="8" fill="none" pathLength={100} />
        {/* value arc */}
        <path d="M 10 60 A 50 50 0 0 1 110 60" stroke={color} strokeWidth="8" fill="none" pathLength={100}
              strokeDasharray={`${v} 100`} strokeLinecap="round" />
        {/* value text */}
        <text x="60" y="48" textAnchor="middle" className="font-bold" fill="currentColor" fontSize="20">{Math.round(v)}</text>
      </svg>
    );
  };

  const addSymbolToWatchlist = async (raw: string) => {
    const symbol = String(raw || '').toUpperCase();
    if (!symbol) {
      toast.error('Invalid symbol');
      return;
    }
    if (addingSymbol === symbol) return;
    setAddingSymbol(symbol);
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to add to watchlist');
      }
      const canonical = String(data?.item?.display_symbol || data?.item?.symbol || symbol).toUpperCase();
      try {
        const rawList = JSON.parse(localStorage.getItem('joat:watchlist') || '[]');
        const entries = Array.isArray(rawList) ? rawList : [];
        const entry = { symbol: canonical, addedAt: Date.now() };
        const filtered = entries.filter((it: any) => String(it?.symbol || '').toUpperCase() !== canonical);
        localStorage.setItem('joat:watchlist', JSON.stringify([entry, ...filtered]));
      } catch (err) {
        console.warn('Failed to sync watchlist cache', err);
      }
      toast.success(`${canonical} added to watchlist`);
    } catch (error) {
      console.error('Failed to add symbol to watchlist', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add to watchlist');
    } finally {
      setAddingSymbol(null);
    }
  };

  // Composite 7d sparkline for widgets (approximate market trend using top coins)
  const compositeSpark = React.useMemo(() => {
    try {
      const series: number[][] = crypto
        .filter((c:any) => Array.isArray(c.spark) && c.spark.length > 0)
        .slice(0, 30)
        .map((c:any) => c.spark.slice(-64));
      if (series.length === 0) return [] as number[];
      const len = Math.min(64, ...series.map(s => s.length));
      const normalized = series.map(s => {
        const arr = s.slice(-len);
        const first = arr[0] || 1;
        return arr.map(v => (first ? v / first : 1));
      });
      const avg: number[] = new Array(len).fill(0);
      for (let i = 0; i < len; i++) {
        let sum = 0;
        for (const s of normalized) sum += (s[i] ?? 1);
        avg[i] = sum / normalized.length;
      }
      return avg;
    } catch { return [] as number[]; }
  }, [crypto]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingC(true);
      try {
        const res = await fetch(`/api/prices/crypto?limit=100&_=${Date.now()}`, { credentials: 'include', cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) setCrypto(data?.items || []);
      } finally { if (!cancelled) setLoadingC(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // top metrics widgets
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/metrics?_=${Date.now()}`, { credentials: 'include', cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) {
          setMetrics(data || null);
          setHist(h => ({
            btcDom: typeof data?.btcDominancePct === 'number' ? [...h.btcDom.slice(-63), data.btcDominancePct] : h.btcDom,
            fear: typeof data?.fearGreed?.value === 'number' ? [...h.fear.slice(-63), data.fearGreed.value] : h.fear,
            mc: typeof data?.marketCapUsd === 'number' ? [...h.mc.slice(-63), data.marketCapUsd] : h.mc,
            alt: typeof data?.altcoinSeasonIndex === 'number' ? [...h.alt.slice(-63), data.altcoinSeasonIndex] : h.alt,
          }));
        }
      } catch {}
      const ratio = await fetchEthBtc();
      if (!cancelled) {
        if (ratio) {
          setEthBtc(ratio);
        } else {
          setEthBtc(null);
        }
      }
    })();

    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/metrics?_=${Date.now()}`, { credentials: 'include', cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) {
          setMetrics(data || null);
          setHist(h => ({
            btcDom: typeof data?.btcDominancePct === 'number' ? [...h.btcDom.slice(-63), data.btcDominancePct] : h.btcDom,
            fear: typeof data?.fearGreed?.value === 'number' ? [...h.fear.slice(-63), data.fearGreed.value] : h.fear,
            mc: typeof data?.marketCapUsd === 'number' ? [...h.mc.slice(-63), data.marketCapUsd] : h.mc,
            alt: typeof data?.altcoinSeasonIndex === 'number' ? [...h.alt.slice(-63), data.altcoinSeasonIndex] : h.alt,
          }));
        }
      } catch {}
      const ratio = await fetchEthBtc();
      if (!cancelled) {
        if (ratio) {
          setEthBtc(ratio);
        } else {
          setEthBtc(null);
        }
      }
    }, 60000);

    return () => { cancelled = true; clearInterval(id); };
  }, [fetchEthBtc]);

  // Disabled background refresh to save API quota and prevent flicker
  // Users can manually refresh if needed

  // Disabled WebSocket to save API quota and prevent constant re-renders causing flicker
  // Prices load once on mount, users can manually refresh if needed

  const stockScreenerSrc = React.useMemo(() => {
    const config = {
      width: "100%",
      height: 640,
      defaultColumn: "overview",
      defaultScreen: "most_capitalized",
      market: "america",
      showToolbar: true,
      colorTheme: "dark",
      isTransparent: false,
      locale: "en",
      displayCurrency: "USD",
    };
    const encoded = encodeURIComponent(JSON.stringify(config));
    return `https://www.tradingview.com/embed-widget/screener/?locale=en#${encoded}`;
  }, []);

  const [detailsSym, setDetailsSym] = React.useState<string | null>(null);

  const refreshCrypto = async () => {
    setLoadingC(true);
    try {
      const res = await fetch(`/api/prices/crypto?limit=100&_=${Date.now()}`, { credentials: 'include', cache: 'no-store' });
      if (res.status === 429) {
        const payload = await res.json().catch(() => ({}));
        toast.error(typeof payload?.error === 'string' ? payload.error : 'Rate limited. Please try again soon.');
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to refresh crypto prices');
      }
      const data = await res.json();
      const nextItems = Array.isArray(data?.items) ? data.items : [];
      const prevBy: Record<string, any> = Object.fromEntries(crypto.map((p:any)=>[String(p.symbol).toUpperCase(), p]));
      const flashes: Record<string, 'up'|'down'|null> = {};
      for (const entry of nextItems) {
        const key = String(entry?.symbol || '').toUpperCase();
        const before = prevBy[key];
        const afterPrice = typeof entry?.price === 'number' ? entry.price : null;
        const beforePrice = typeof before?.price === 'number' ? before.price : null;
        if (afterPrice != null && beforePrice != null && beforePrice !== afterPrice) {
          flashes[key] = afterPrice > beforePrice ? 'up' : 'down';
        }
      }
      if (Object.keys(flashes).length > 0) {
        setFlashByCrypto(flashes);
        setTimeout(() => setFlashByCrypto({}), 1600);
      }
      setCrypto(nextItems);
      const ratio = await fetchEthBtc();
      if (ratio) {
        setEthBtc(ratio);
      } else {
        setEthBtc(null);
      }
    } catch (error) {
      console.error('Failed to refresh crypto prices', error);
      toast.error('Failed to refresh crypto prices.');
    } finally {
      setLoadingC(false);
    }
  };

  const CryptoTable = ({ rows, loading }: { rows: any[]; loading: boolean }) => (
    <Card className="bg-card/60 border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">Top Crypto</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input placeholder="Search crypto..." value={cryptoQuery} onChange={(e)=>setCryptoQuery(e.target.value)} className="h-9 w-full sm:w-56" />
            <button
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background/70 px-4 text-xs hover:bg-foreground/5 w-full sm:w-auto"
              onClick={refreshCrypto}
              disabled={loadingC}
            >
              {loadingC ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-12 gap-4 px-2 py-2 text-xs text-muted-foreground">
          <div className="col-span-8 flex items-end justify-between sm:col-span-4">
            <div>Name</div>
            <div className="hidden sm:block text-[10px] uppercase tracking-wide opacity-70">Last 7 Days</div>
          </div>
          <div className="col-span-4 text-right sm:col-span-2">Price</div>
          <div className="hidden text-right sm:block sm:col-span-1">1h</div>
          <div className="hidden text-right sm:block sm:col-span-1">24h</div>
          <div className="hidden text-right sm:block sm:col-span-1">7d</div>
          <div className="hidden text-right sm:block sm:col-span-2">Market Cap</div>
          <div className="hidden text-right sm:block sm:col-span-1">Watchlist</div>
        </div>
        <div className="h-[1px] bg-border/60" />
        {loading ? (
          Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="grid grid-cols-1 gap-4 px-2 py-3 sm:grid-cols-12">
              <Skeleton className="h-4 w-48" />
              <div className="hidden sm:block sm:col-span-7" />
            </div>
          ))
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <PriceRow
                key={`${r.symbol}-${i}`}
                r={r}
                i={i}
                setDetailsSym={setDetailsSym}
                addSymbolToWatchlist={addSymbolToWatchlist}
                addingSymbol={addingSymbol}
                hoveredSymbolRef={hoveredSymbolRef}
                flashDir={flashByCrypto[String(r.symbol || '').toUpperCase()] || null}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Prices</h2>
          <p className="text-muted-foreground">Live market overview for crypto and stocks</p>
        </div>
      </div>

      {/* Top metrics widgets - CMC style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="group bg-gradient-to-br from-card/80 to-card/60 border-border/80 hover:border-accent/40 hover:ring-1 hover:ring-accent/30 transition-all duration-300 hover:shadow-lg">
          <CardContent className="py-3 min-h-[104px] flex flex-col justify-center">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Market Cap</div>
            <div className="text-2xl font-bold mb-1 tabular-nums">
              {typeof metrics?.marketCapUsd === 'number' ? `$${(metrics.marketCapUsd / 1e12).toFixed(2)}T` : '—'}
            </div>
            <div className={`text-sm font-semibold tabular-nums ${typeof metrics?.marketCapChange24hPct === 'number' ? (metrics.marketCapChange24hPct>=0?'text-emerald-500':'text-red-500') : 'text-muted-foreground'}`}>
              {typeof metrics?.marketCapChange24hPct === 'number' ? `${metrics.marketCapChange24hPct > 0 ? '+' : ''}${metrics.marketCapChange24hPct.toFixed(2)}%` : '—'}
            </div>
            {Array.isArray(compositeSpark) && compositeSpark.length > 0 && (
              <div className="mt-2 w-full">
                <Sparkline
                  values={compositeSpark}
                  width={240}
                  height={32}
                  stroke={(compositeSpark[compositeSpark.length-1] >= compositeSpark[0]) ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                  strokeWidth={2}
                  fill={(compositeSpark[compositeSpark.length-1] >= compositeSpark[0]) ? 'hsl(var(--success)/0.15)' : 'hsl(var(--destructive)/0.15)'}
                  responsive
                />
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="group bg-gradient-to-br from-card/80 to-card/60 border-border/80 hover:border-accent/40 hover:ring-1 hover:ring-accent/30 transition-all duration-300 hover:shadow-lg">
          <CardContent className="py-3 min-h-[104px] flex flex-col justify-center">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">BTC Dominance</div>
            {typeof metrics?.btcDominancePct === 'number' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="mb-2 flex items-center justify-center">
                      <div className="w-[85%] max-w-[360px] h-4 bg-border/50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-700 shadow-[0_0_8px_rgba(250,204,21,0.25)]"
                          style={{
                            width: `${Math.min(100, Math.max(0, metrics.btcDominancePct))}%`,
                            background: 'linear-gradient(90deg, hsl(var(--accent)) 0%, #facc15 60%, #f59e0b 100%)'
                          }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs tabular-nums">
                      {(() => {
                        const arr = hist.btcDom;
                        const prev = arr.length > 1 ? arr[arr.length - 2] : null;
                        const cur = metrics.btcDominancePct as number;
                        const delta = prev == null ? 0 : (cur - prev);
                        const sign = delta > 0 ? '+' : '';
                        return `Δ since last: ${sign}${delta.toFixed(2)} pp`;
                      })()}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <div className="text-lg font-semibold tabular-nums text-center">
              {typeof metrics?.btcDominancePct === 'number' ? `${metrics.btcDominancePct.toFixed(1)}%` : '—'}
            </div>
            <div className="text-xs text-muted-foreground text-center mt-1">Bitcoin's share of total market</div>
          </CardContent>
        </Card>
        <Card className="group bg-gradient-to-br from-card/80 to-card/60 border-border/80 hover:border-accent/40 hover:ring-1 hover:ring-accent/30 transition-all duration-300 hover:shadow-lg">
          <CardContent className="py-3 min-h-[104px] flex flex-col justify-center">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Fear & Greed</div>
            {typeof metrics?.fearGreed?.value === 'number' && (
              <div className="flex items-center justify-center mb-1">
                <FGauge value={metrics.fearGreed.value} />
              </div>
            )}
            <div className={`text-center text-sm font-semibold ${typeof metrics?.fearGreed?.value === 'number' ? (metrics.fearGreed.value >= 50 ? 'text-emerald-500' : 'text-red-500') : 'text-muted-foreground'}`}>
              {metrics?.fearGreed?.classification || '—'}
            </div>
          </CardContent>
        </Card>
        <Card className="group bg-gradient-to-br from-card/80 to-card/60 border-border/80 hover:border-accent/40 hover:ring-1 hover:ring-accent/30 transition-all duration-300 hover:shadow-lg">
          <CardContent className="py-3 min-h-[104px] flex flex-col justify-center">
            {typeof metrics?.altcoinSeasonIndex === 'number' ? (
              <>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Altcoin Season</div>
                <div className="flex items-baseline gap-2 mb-1">
                  <div className="text-2xl font-bold tabular-nums">{metrics.altcoinSeasonIndex.toFixed(0)}</div>
                  <div className="text-sm text-muted-foreground">/ 100</div>
                </div>
                <div className={`text-sm font-semibold ${metrics.altcoinSeasonIndex >= 75 ? 'text-emerald-500' : metrics.altcoinSeasonIndex <= 25 ? 'text-red-500' : 'text-yellow-500'}`}>
                  {metrics.altcoinSeasonIndex >= 75 ? 'Altcoin Season' : metrics.altcoinSeasonIndex <= 25 ? 'Bitcoin Season' : 'Mixed Market'}
                </div>
                {hist.alt.length > 1 && (
                  <div className="mt-3">
                    <Sparkline
                      values={hist.alt.slice(-48)}
                      width={240}
                      height={30}
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="hsl(var(--primary)/0.12)"
                      responsive
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">ETH/BTC Ratio</div>
                <div className="flex items-baseline gap-2 mb-1">
                  <div className="text-2xl font-bold tabular-nums">{typeof ethBtc?.ratio === 'number' ? ethBtc.ratio.toFixed(4) : '—'}</div>
                </div>
                <div className={`text-sm font-semibold ${typeof ethBtc?.changePct === 'number' ? (ethBtc.changePct >= 0 ? 'text-emerald-500' : 'text-red-500') : 'text-muted-foreground'}`}>
                  {typeof ethBtc?.changePct === 'number' ? `${ethBtc.changePct >= 0 ? '+' : ''}${ethBtc.changePct.toFixed(2)}% 24h` : 'Waiting for data'}
                </div>
                <div className="mt-3 text-xs text-muted-foreground/80">
                  Rising ratio favours altcoins; falling ratio signals BTC strength.
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v:any)=>setTab(v)}>
        <TabsList>
          <TabsTrigger value="crypto">Crypto</TabsTrigger>
          <TabsTrigger value="stocks">Stocks</TabsTrigger>
        </TabsList>
        <TabsContent value="crypto">
          <CryptoTable rows={crypto.filter(c => `${c.name} ${c.symbol}`.toLowerCase().includes(cryptoQuery.toLowerCase()))} loading={loadingC} />
        </TabsContent>
        <TabsContent value="stocks">
          <Card className="bg-card/60 border-border overflow-hidden">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">TradingView Stock Screener</CardTitle>
              <p className="text-sm text-muted-foreground">
                Full TradingView screener (USA markets) embedded directly in the dashboard. Filter, sort, and drill into equities without leaving JOAT.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[640px] w-full">
                <iframe
                  key={stockScreenerSrc}
                  title="TradingView stock screener"
                  src={stockScreenerSrc}
                  className="h-full w-full"
                  frameBorder="0"
                  scrolling="no"
                  allowTransparency
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <CoinDetails symbol={detailsSym} open={!!detailsSym} onOpenChange={(v)=>{ if(!v) setDetailsSym(null); }} />
    </div>
  );
};

export default Prices;


