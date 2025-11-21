import React, { useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Sparkline from "@/components/ui/sparkline";
import { Bell, Plus, TrendingUp, TrendingDown, Settings } from "lucide-react";
import { apiFetch, getWebSocketUrl } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import AssetSearchDialog, { AssetSearchResult } from "@/components/AssetSearchDialog";

type WLItem = { symbol: string; addedAt: number };
type CoinMeta = {
  id?: string;
  symbol?: string;
  name?: string;
  image?: string;
  market_data?: {
    current_price?: number;
    price_change_percentage_24h?: number;
    price_change_percentage_7d?: number;
    spark?: number[];
  };
};

const Watchlist: React.FC = () => {
  const [items, setItems] = React.useState<WLItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [metaBySymbol, setMetaBySymbol] = React.useState<Record<string, CoinMeta>>({});
  const [tick, setTick] = React.useState(0);
  const [flashBy, setFlashBy] = React.useState<Record<string, 'up'|'down'|null>>({});
  const [assetPickerOpen, setAssetPickerOpen] = React.useState(false);
  const [addingSymbol, setAddingSymbol] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const lastApplyRef = useRef<Record<string, number>>({});
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const getBaseSymbol = React.useCallback((raw: string) => {
    if (!raw) return '';
    const cut = String(raw).toUpperCase().split(/[\/:\-\s]/)[0];
    // e.g., BTCUSD -> prefer BTC when it ends with USD/USDT
    if (/(USDT|USD)$/.test(cut) && cut.length > 4) {
      const base = cut.replace(/(USDT|USD)$/,'');
      return base || cut;
    }
    return cut;
  }, []);

  React.useEffect(() => {
    try {
      const wl = JSON.parse(localStorage.getItem('joat:watchlist') || '[]');
      if (Array.isArray(wl)) setItems(wl);
    } catch {}
    setLoading(false);
  }, []);

  // Load server watchlist (if authenticated)
  React.useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/watchlist');
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data?.items) && data.items.length >= 0) {
          const list = data.items
            .sort((a:any,b:any)=> (a.position||0)-(b.position||0))
            .map((r:any) => ({ symbol: String(r.symbol || '').toUpperCase(), addedAt: Date.now() }));
          if (list.length > 0) {
            setItems(list);
          } else {
            // Server empty but local exists → sync local to server
            try {
              const local = JSON.parse(localStorage.getItem('joat:watchlist') || '[]');
              if (Array.isArray(local) && local.length > 0) {
                await persistOrder(local);
              }
            } catch {}
          }
        }
      } catch {}
    })();
  }, []);

  async function persistOrder(list: WLItem[]) {
    try {
      await Promise.all(list.map(async (it, idx) => {
        const res = await apiFetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: getBaseSymbol(it.symbol), position: idx })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(typeof data?.error === 'string' ? data.error : 'failed');
        }
      }));
    } catch (error) {
      console.warn('Failed to persist watchlist order', error);
    }
  }

  const addAssetToWatchlist = async (asset: AssetSearchResult, options: { silent?: boolean } = {}): Promise<string | null> => {
    const { silent = false } = options;
    if (!asset?.symbol) {
      if (!silent) toast.error('Select a valid asset');
      return null;
    }
    const candidate = getBaseSymbol(asset.displaySymbol || asset.symbol);
    if (!candidate) {
      if (!silent) toast.error('Invalid symbol selection');
      return null;
    }
    if (!silent) setAddingSymbol(true);
    try {
      const res = await apiFetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: asset.symbol || candidate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to add symbol');
      }
      const display = String(data?.item?.display_symbol || data?.item?.symbol || asset.displaySymbol || asset.symbol || candidate).toUpperCase();
      const entry: WLItem = { symbol: display, addedAt: Date.now() };
      setItems((prev) => {
        const filtered = prev.filter((it) => getBaseSymbol(it.symbol) !== getBaseSymbol(entry.symbol));
        const next = [entry, ...filtered];
        try { localStorage.setItem('joat:watchlist', JSON.stringify(next)); } catch {}
        return next;
      });
      setTick((v) => v + 1);
      if (!silent) toast.success(`${display} added to watchlist`);
      return display;
    } catch (error) {
      console.error('Failed to add watchlist symbol', error);
      if (!silent) {
        toast.error(error instanceof Error ? error.message : 'Failed to add symbol');
      } else {
        throw error;
      }
      return null;
    } finally {
      if (!silent) setAddingSymbol(false);
    }
  };

  const importSymbolsFromFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const tokens = text
        .split(/[\r\n,;\t|]+/)
        .map((token) => getBaseSymbol(token))
        .filter(Boolean);
      const unique = Array.from(new Set(tokens));
      if (unique.length === 0) {
        toast.error('No symbols found in the file');
        return;
      }
      let success = 0;
      for (const sym of unique) {
        try {
          const result = await addAssetToWatchlist({ symbol: sym, displaySymbol: sym, name: sym, assetType: 'unknown', logo: null }, { silent: true });
          if (result) success += 1;
        } catch (error) {
          console.warn('Failed to import symbol', sym, error);
        }
      }
      if (success > 0) {
        toast.success(`Imported ${success} ${success === 1 ? 'symbol' : 'symbols'} into your watchlist`);
        if (success < unique.length) {
          toast.info(`Skipped ${unique.length - success} invalid symbol${unique.length - success === 1 ? '' : 's'}`);
        }
      } else {
        toast.error('Unable to import any symbols. Check the file contents.');
      }
    } catch (error) {
      console.error('Failed to import watchlist CSV', error);
      toast.error('Import failed. Please try again.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Fetch coin meta for any symbols we don't have yet (no dependency loop)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const symbols = items.map(i => getBaseSymbol(i.symbol));
      const seen = new Set<string>();
      const unique = symbols.filter(s => {
        const up = String(s || '').toUpperCase();
        if (!up) return false;
        if (seen.has(up)) return false;
        seen.add(up);
        return true;
      });
      const toFetch = unique.filter(s => !metaBySymbol[s]);
      if (toFetch.length === 0) return;
      const next = { ...metaBySymbol } as Record<string, CoinMeta>;
      for (const s of toFetch) {
        try {
          const res = await apiFetch(`/api/coin?symbol=${encodeURIComponent(s)}`);
          if (!res.ok) {
            // avoid retry storms on server 500s
            continue;
          }
          const data = await res.json();
          if (!cancelled && data) next[s] = data as CoinMeta;
        } catch {
          // swallow and continue
        }
      }
      if (!cancelled && Object.keys(next).length > Object.keys(metaBySymbol).length) {
        setMetaBySymbol(next);
      }
    })();
    return () => { cancelled = true; };
  }, [items, getBaseSymbol]);

  // Live updates for crypto via WS (fallback remains 30s polling)
  React.useEffect(() => {
    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;
      ws.onopen = () => {
        const symbols = Array.from(new Set(items.map(i => getBaseSymbol(i.symbol))));
        symbols.forEach((s) => { try { ws.send(JSON.stringify({ type: 'subscribe', symbol: s.toUpperCase() })); } catch {} });
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data?.type === 'tick' && data.symbol && typeof data.price === 'number') {
            const sym = String(data.symbol).toUpperCase();
            const now = Date.now();
            const last = lastApplyRef.current[sym] || 0;
            if (now - last < 1200) return; // throttle per symbol
            lastApplyRef.current[sym] = now;
            setMetaBySymbol((prev) => {
              const cur = prev[sym];
              if (!cur) return prev;
              const prevPrice = cur.market_data?.current_price;
              const next: Record<string, CoinMeta> = { ...prev } as any;
              const md = { ...(cur.market_data || {}) } as any;
              md.current_price = data.price;
              next[sym] = { ...cur, market_data: md };
              if (typeof prevPrice === 'number' && prevPrice !== data.price) {
                setFlashBy((m) => ({ ...m, [sym]: data.price > prevPrice ? 'up' : 'down' }));
                setTimeout(() => setFlashBy((m) => ({ ...m, [sym]: null })), 1400);
              }
              return next;
            });
          }
        } catch {}
      };
      ws.onerror = () => {};
      ws.onclose = () => { wsRef.current = null; };
      return () => { try { ws.close(); } catch {} };
    } catch { return () => {}; }
  }, [items.length]);

  // Lightweight real-time refresh: re-fetch current price every 30s (staggered)
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (items.length === 0) return;
      const symbols = items.map(i => getBaseSymbol(i.symbol));
      try {
        const qs = encodeURIComponent(symbols.join(','));
        const res = await apiFetch(`/api/coins?symbols=${qs}`);
        if (!res.ok) return;
        const data = await res.json();
        const next = { ...metaBySymbol } as Record<string, CoinMeta>;
        const list = Array.isArray(data?.items) ? data.items : [];
        for (const entry of list) {
          const k = getBaseSymbol(entry?.symbol || '');
          const d = entry?.data || {};
          if (d && d.market_data) {
            const prevPrice = metaBySymbol[k]?.market_data?.current_price;
            const newPrice = d?.market_data?.current_price;
            if (typeof prevPrice === 'number' && typeof newPrice === 'number' && prevPrice !== newPrice) {
              setFlashBy((m) => ({ ...m, [k]: newPrice > prevPrice ? 'up' : 'down' }));
              setTimeout(() => setFlashBy((m) => ({ ...m, [k]: null })), 1200);
            }
            next[k] = d;
          }
        }
        if (!cancelled) setMetaBySymbol(next);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [tick, getBaseSymbol]);

  // Refresh immediately when tab gains focus
  React.useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') setTick(t => t + 1); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const [pendingRemove, setPendingRemove] = React.useState<number | null>(null);
  const confirmRemove = () => {
    if (pendingRemove == null) return;
    const idx = pendingRemove;
    const removed = items[idx];
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
    try { localStorage.setItem('joat:watchlist', JSON.stringify(next)); } catch {}
    (async () => { try { await apiFetch('/api/watchlist', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: getBaseSymbol(removed.symbol) }) }); } catch {} })();
    setPendingRemove(null);
    toast.success(`${removed?.symbol || 'Item'} removed`);
  };

  // Drag & Drop reordering
  const [draggingIdx, setDraggingIdx] = React.useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = React.useState<number | null>(null);
  const [dragOverPos, setDragOverPos] = React.useState<'before'|'after'|null>(null);
  const onDragStart = (idx: number) => (e: React.DragEvent) => {
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(idx)); } catch {}
  };
  const onDragOver = (idx: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragOverIdx !== idx) setDragOverIdx(idx);
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    setDragOverPos(e.clientY < mid ? 'before' : 'after');
  };
  const onDrop = (idx: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const from = draggingIdx;
    setDraggingIdx(null);
    setDragOverIdx(null);
    setDragOverPos(null);
    if (from == null || from === idx) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    const insertAt = dragOverPos === 'after' ? idx + (from < idx ? 0 : 1) : idx - (from < idx ? 1 : 0);
    const safeIndex = Math.max(0, Math.min(next.length, insertAt));
    next.splice(safeIndex, 0, moved);
    setItems(next);
    try { localStorage.setItem('joat:watchlist', JSON.stringify(next)); } catch {}
    persistOrder(next);
  };

  const formatPrice = (v?: number) => v != null ? `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 6 })}` : '—';

  const renderChange = (pct?: number) => {
    if (typeof pct !== 'number') return <span>—</span>;
    const up = pct >= 0;
    const Cls = up ? TrendingUp : TrendingDown;
    return (
      <span className={`inline-flex items-center justify-end gap-1 font-medium ${up ? 'text-success' : 'text-destructive'}`}>
        <Cls className="h-3.5 w-3.5" />
        {pct.toFixed(2)}%
      </span>
    );
  };

  const formatPercentLabel = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(Math.abs(value) >= 1 ? 2 : 3)}%`;

  function hashStr(s: string): number { let h = 0; for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i))|0; return Math.abs(h); }
  function genSpark(price?: number, pct?: number, symKey: string = ""): number[] {
    // Create a small synthetic sparkline around current price
    const base = typeof price === 'number' && isFinite(price) ? price : 100;
    const drift = typeof pct === 'number' ? (pct / 100) * base : 0;
    const points = 16;
    const out: number[] = [];
    let cur = base - drift * 0.5;
    const seed = hashStr(symKey) % 1000;
    for (let i = 0; i < points; i++) {
      const noise = (Math.sin((i + seed*0.01) * 1.2) + Math.cos((i + seed*0.02) * 0.65)) * 0.0025 * base; // symbol-varied
      cur += (drift / points) + noise;
      out.push(cur);
    }
    return out;
  }

  const watchlistStats = React.useMemo(() => {
    if (items.length === 0) {
      return { total: 0, avgChange: 0, topGainer: null as { symbol: string; change: number } | null, topLoser: null as { symbol: string; change: number } | null };
    }
    const baseSymbols = items.map((i) => getBaseSymbol(i.symbol));
    let totalChange = 0;
    let changeCount = 0;
    let topGainer: { symbol: string; change: number } | null = null;
    let topLoser: { symbol: string; change: number } | null = null;

    baseSymbols.forEach((sym) => {
      const change = metaBySymbol[sym]?.market_data?.price_change_percentage_24h;
      if (typeof change === 'number' && Number.isFinite(change)) {
        totalChange += change;
        changeCount += 1;
        if (!topGainer || change > topGainer.change) topGainer = { symbol: sym, change };
        if (!topLoser || change < topLoser.change) topLoser = { symbol: sym, change };
      }
    });

    const avgChange = changeCount ? totalChange / changeCount : 0;
    return { total: items.length, avgChange, topGainer, topLoser };
  }, [items, metaBySymbol, getBaseSymbol]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Watchlist</h2>
          <p className="text-muted-foreground">Symbols you’re tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-border/60 bg-background/60 transition-colors hover:border-primary/40 hover:text-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Importing…' : 'Import CSV'}
          </Button>
          <Button
            size="sm"
            className="shadow-[0_20px_45px_-25px_hsl(var(--primary)/0.5)] transition-transform hover:-translate-y-0.5"
            onClick={() => setAssetPickerOpen(true)}
            disabled={addingSymbol}
          >
            <Plus className="mr-2 h-4 w-4" /> {addingSymbol ? 'Adding…' : 'Add Symbol'}
          </Button>
        </div>
      </div>
      <input
        type="file"
        accept=".csv,.txt"
        ref={fileInputRef}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) importSymbolsFromFile(file);
        }}
      />

      {watchlistStats.total > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border border-border/60 bg-gradient-to-br from-background via-background/80 to-background/60 shadow-inner">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Tracked Symbols</CardTitle>
              <CardDescription className="text-2xl font-semibold text-foreground">{watchlistStats.total}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Total symbols currently on your watchlist.</CardContent>
          </Card>
          <Card className="border border-border/60 bg-gradient-to-br from-background via-background/80 to-background/60 shadow-inner">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Average 24h Change</CardTitle>
              <CardDescription className={`text-2xl font-semibold ${watchlistStats.avgChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatPercentLabel(watchlistStats.avgChange)}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Mean 24-hour performance across tracked symbols.</CardContent>
          </Card>
          <Card className="border border-border/60 bg-gradient-to-br from-background via-background/80 to-background/60 shadow-inner">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Leaders</CardTitle>
              <CardDescription className="flex flex-col gap-1 text-sm">
                <span className="inline-flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Top gainer</span>
                  <span className="font-semibold text-success">
                    {watchlistStats.topGainer ? `${watchlistStats.topGainer.symbol} ${formatPercentLabel(watchlistStats.topGainer.change)}` : '—'}
                  </span>
                </span>
                <span className="inline-flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Top pullback</span>
                  <span className="font-semibold text-destructive">
                    {watchlistStats.topLoser ? `${watchlistStats.topLoser.symbol} ${formatPercentLabel(watchlistStats.topLoser.change)}` : '—'}
                  </span>
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Quick glance at intraday leaders and laggards.</CardContent>
          </Card>
        </div>
      )}

      {items.length === 0 ? (
        <Card className="bg-card/60 border-border">
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold mb-1">No symbols yet</h3>
            <p className="text-muted-foreground mb-4">Add signals to your watchlist from the Signals page.</p>
            <Button>Add from Signals</Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="relative group overflow-hidden border border-border/60 bg-gradient-to-br from-background/90 via-background/80 to-background/60 shadow-2xl transition-all hover:border-primary/40">
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
          <CardHeader className="relative z-10">
            <CardTitle>Tracked Symbols</CardTitle>
            <CardDescription>Your curated list with quick actions</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="grid grid-cols-1 items-center gap-3 px-2 py-2 text-xs text-muted-foreground sm:grid-cols-12">
              <div className="sm:col-span-3">Symbol</div>
              <div className="text-right sm:col-span-2">Last Price</div>
              <div className="hidden text-right sm:block sm:col-span-2">24h %</div>
              <div className="hidden text-right sm:block sm:col-span-2">7d %</div>
              <div className="sm:col-span-3">Sparkline</div>
            </div>
            <div className="h-[1px] bg-border/60" />
            {items.map((it, i) => {
              const sym = getBaseSymbol(it.symbol);
              const meta = metaBySymbol[sym];
              const price = meta?.market_data?.current_price;
              const change = meta?.market_data?.price_change_percentage_24h;
              const change7d = meta?.market_data?.price_change_percentage_7d;
              const spark = meta?.market_data?.spark && meta.market_data.spark.length > 0
                ? meta.market_data.spark.slice(-64)
                : genSpark(price, change, sym);
              return (
                <div
                  key={i}
                  className={`relative group grid grid-cols-1 items-center gap-3 px-2 py-3 rounded-md transition-all duration-300 hover:translate-x-0.5 hover:shadow-[0_18px_40px_-25px_hsl(var(--primary)/0.5)] hover:bg-foreground/5 ${dragOverIdx===i ? 'ring-1 ring-primary/40' : ''} sm:grid-cols-12`}
                  draggable
                  onDragStart={onDragStart(i)}
                  onDragOver={onDragOver(i)}
                  onDrop={onDrop(i)}
                >
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-r from-primary/10 via-transparent to-transparent" />
                  {dragOverIdx===i && dragOverPos==='before' && (
                    <div className="absolute -top-1 left-0 right-0 h-1 bg-primary/50 rounded-full" />
                  )}
                  <div className="relative z-10 flex items-center gap-2 sm:col-span-3">
                    {meta?.image && <img src={meta.image} alt="" className="h-6 w-6 rounded-full ring-1 ring-border object-cover" />}
                    <span className="font-medium">{it.symbol}</span>
                    <Badge variant="outline">Swing</Badge>
                  </div>
                  <div className={`relative z-10 text-right font-medium ${flashBy[sym] === 'up' ? 'text-emerald-500' : flashBy[sym] === 'down' ? 'text-red-500' : ''} transition-colors duration-1000 sm:col-span-2`}>
                    {loading && !meta ? <Skeleton className="h-4 w-20 ml-auto" /> : <span className="transition-colors duration-1000">{formatPrice(price)}</span>}
                  </div>
                  <div className="relative z-10 hidden text-right sm:block sm:col-span-2">
                    {loading && !meta ? <Skeleton className="h-4 w-14 ml-auto" /> : renderChange(change)}
                  </div>
                  <div className="relative z-10 hidden text-right sm:block sm:col-span-2">
                    {loading && !meta ? <Skeleton className="h-4 w-14 ml-auto" /> : renderChange(change7d)}
                  </div>
                  <div className="relative z-10 overflow-hidden pr-8 sm:col-span-3">
                    <Sparkline
                      values={spark}
                      height={32}
                      stroke={typeof change7d === 'number' && change7d < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--success))'}
                      strokeWidth={2}
                      fill={typeof change7d === 'number' && change7d < 0 ? 'hsl(var(--destructive)/0.12)' : 'hsl(var(--success)/0.12)'}
                      className="w-[calc(100%-8px)]"
                    />
                  </div>
                  {/* Mobile remove button below */}
                  <div className="mt-2 flex justify-end sm:hidden">
                    <button
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/70 text-muted-foreground hover:text-foreground hover:bg-background/90"
                      onClick={() => setPendingRemove(i)}
                      aria-label="Remove"
                    >
                      <Plus className="h-4 w-4 rotate-45" />
                    </button>
                  </div>
                  {/* Desktop remove button overlay */}
                  <button
                    className="hidden sm:inline-flex absolute right-2 top-1/2 -translate-y-1/2 z-10 h-7 w-7 items-center justify-center rounded-md border border-border bg-background/70 text-muted-foreground hover:text-foreground hover:bg-background/90"
                    onClick={() => setPendingRemove(i)}
                    aria-label="Remove"
                  >
                    <Plus className="h-4 w-4 rotate-45" />
                  </button>
                  {dragOverIdx===i && dragOverPos==='after' && (
                    <div className="absolute -bottom-1 left-0 right-0 h-1 bg-primary/50 rounded-full" />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={pendingRemove != null} onOpenChange={(o) => { if (!o) setPendingRemove(null); }}>
        <AlertDialogContent className="w-full max-w-[95vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Watchlist?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the selected symbol from your watchlist. You can add it again from Signals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AssetSearchDialog
        open={assetPickerOpen}
        onOpenChange={setAssetPickerOpen}
        onSelect={(asset) => {
          setAssetPickerOpen(false);
          addAssetToWatchlist(asset);
        }}
      />
    </div>
  );
};

export default Watchlist;


