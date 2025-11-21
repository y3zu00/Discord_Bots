import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Sparkline from "@/components/ui/sparkline";
import { Pause, Play, Settings2, BellRing, Clock, Repeat, Trash2, Bell, Search, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import AssetSearchDialog, { AssetSearchResult } from "@/components/AssetSearchDialog";
import { apiFetch } from "@/lib/api";
// Fallback logo remains the bell icon; attempt to resolve per-symbol logos via /api/coins

type AlertItem = {
  id: string;
  symbol: string;
  displaySymbol?: string;
  displayName?: string;
  assetType?: string;
  type: "price" | "%";
  direction: ">=" | "<=";
  threshold: number | null;
  windowTf: string;
  cooldown: string;
  active: boolean;
  createdAt: number;
  lastTriggeredAt?: number | null;
};

const mapServerAlert = (row: any): AlertItem => {
  const rawSymbol = String(row?.symbol || row?.display_symbol || "").toUpperCase();
  const displaySymbol = String(row?.display_symbol || rawSymbol).toUpperCase();
  const direction: ">=" | "<=" = row?.direction === "<=" ? "<=" : ">=";
  const type: "price" | "%" = row?.type === "%" ? "%" : "price";
  const thresholdValue = Number(row?.threshold);
  const createdAt = row?.created_at ? new Date(row.created_at).getTime() : Date.now();
  const lastTriggered = row?.last_triggered_at ? new Date(row.last_triggered_at).getTime() : null;
  return {
    id: String(row?.id ?? crypto.randomUUID?.() ?? Date.now()),
    symbol: rawSymbol,
    displaySymbol,
    displayName: row?.display_name || displaySymbol,
    assetType: typeof row?.asset_type === "string" ? row.asset_type.toLowerCase() : undefined,
    type,
    direction,
    threshold: Number.isFinite(thresholdValue) ? thresholdValue : null,
    windowTf: row?.window_tf || "1h",
    cooldown: row?.cooldown || "none",
    active: row?.active !== false,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    lastTriggeredAt: Number.isFinite(lastTriggered ?? NaN) ? lastTriggered : null,
  };
};

const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [logoBySym, setLogoBySym] = useState<Record<string, string | null>>({});
  const [open, setOpen] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetSearchResult | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<"price" | "%">("price");
  const [direction, setDirection] = useState<">=" | "<=">(">=");
  const [symbol, setSymbol] = useState("");
  const [threshold, setThreshold] = useState("");
  const [windowTf, setWindowTf] = useState("1h");
  const [cooldown, setCooldown] = useState("none");

  // Batch sparkline cache (per symbol)
  const [sparkBySym, setSparkBySym] = useState<Record<string, number[]>>({});

  const stats = useMemo(() => {
    const total = alerts.length;
    const active = alerts.filter((a) => a.active).length;
    const paused = total - active;
    const priceAlerts = alerts.filter((a) => a.type === 'price').length;
    const percentAlerts = total - priceAlerts;
    return { total, active, paused, priceAlerts, percentAlerts };
  }, [alerts]);

  const loadAlerts = React.useCallback(async (allowLegacy = true) => {
    try {
      const res = await apiFetch('/api/alerts');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.items) && data.items.length > 0) {
        setAlerts(data.items.map((item: any) => mapServerAlert(item)));
        return;
      }
      if (allowLegacy) {
    try {
      const raw = localStorage.getItem('joat:alerts');
          const legacy = raw ? JSON.parse(raw) : [];
          if (Array.isArray(legacy) && legacy.length > 0) {
            for (const legacyAlert of legacy) {
              try {
                await apiFetch('/api/alerts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    symbol: legacyAlert.symbol,
                    type: legacyAlert.type,
                    direction: legacyAlert.direction,
                    threshold: legacyAlert.threshold,
                    windowTf: legacyAlert.windowTf,
                    cooldown: legacyAlert.cooldown,
                    active: legacyAlert.active,
                  }),
                });
              } catch (migrationErr) {
                console.warn('Failed to migrate legacy alert', migrationErr);
              }
            }
            await loadAlerts(false);
            return;
          }
        } catch (migrationErr) {
          console.warn('Legacy alerts migration failed', migrationErr);
        }
      }
      setAlerts([]);
    } catch (error) {
      console.error('Failed to load alerts', error);
    }
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  // Resolve logos and sparklines for current alerts (batch)
  useEffect(() => {
    const unique = Array.from(new Set(alerts.map(a => String(a.displaySymbol || a.symbol || '').toUpperCase()).filter(Boolean)));
    if (unique.length === 0) return;
    (async () => {
      try {
        const res = await apiFetch(`/api/coins?symbols=${encodeURIComponent(unique.join(','))}`);
        const data = await res.json();
        if (Array.isArray(data?.items)) {
          const logos: Record<string, string | null> = {};
          const sparks: Record<string, number[]> = {};
          for (const it of data.items) {
            const sym = String(it.symbol || '').toUpperCase();
            const img = it?.data?.image || it?.data?.imageUrl || null;
            logos[sym] = img || null;
            const md = it?.data?.market_data || {};
            const spark = Array.isArray(md?.spark) ? md.spark : undefined;
            if (Array.isArray(spark) && spark.length > 0) {
              // Normalize to last 24 points for visual consistency
              const slice = spark.slice(-24);
              // Ensure numbers
              sparks[sym] = slice.map((n: any) => (typeof n === 'number' ? n : Number(n))).filter((n: any) => Number.isFinite(n));
            }
          }
          setLogoBySym(logos);
          setSparkBySym(sparks);
      }
    } catch {}
    })();
  }, [alerts]);

  // Helpers for sparkline
  const baseSymbolOf = (raw: string | undefined | null) => {
    const v = String(raw || '').toUpperCase();
    return v.replace(/[-:/\s].*$/,'').replace(/(USDT|USD)$/,'');
  };

  const makeFallbackSpark = (symbolInput: string): number[] => {
    // Deterministic small-ranged spark using symbol hash
    const s = baseSymbolOf(symbolInput);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const len = 24;
    const arr: number[] = new Array(len);
    let v = 100 + (h % 7); // start near 100
    for (let i = 0; i < len; i++) {
      const delta = ((h >> (i % 16)) & 3) - 1; // -1..+2
      v += delta * 0.6;
      arr[i] = Number(v.toFixed(2));
    }
    return arr;
  };

  const AlertSparkline: React.FC<{ symbol: string }> = ({ symbol }) => {
    const key = baseSymbolOf(symbol);
    const vals = sparkBySym[key] || makeFallbackSpark(key);
    return (
      <Sparkline values={vals} height={40} stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.08)" animateTick />
    );
  };

  // Prefill from Signals: opens the creator with prefilled fields
  useEffect(() => {
    try {
      const raw = localStorage.getItem('joat:alerts:prefill');
      if (!raw) return;
      const data = JSON.parse(raw);
      localStorage.removeItem('joat:alerts:prefill');
      if (data?.symbol) {
        const upper = String(data.symbol).toUpperCase();
        setSymbol(upper);
        setSelectedAsset({ symbol: upper, displaySymbol: upper, name: upper, assetType: 'unknown', logo: null });
      }
      if (data?.type === 'price' || data?.type === '%') setType(data.type);
      if (data?.direction === '>=' || data?.direction === '<=') setDirection(data.direction);
      if (typeof data?.threshold === 'string' || typeof data?.threshold === 'number') setThreshold(String(data.threshold));
      setOpen(true);
    } catch {}
  }, []);

  const canCreate = useMemo(() => {
    const hasThreshold = threshold.trim().length > 0;
    return Boolean(selectedAsset?.symbol && hasThreshold);
  }, [selectedAsset, threshold]);

  const addAlert = async (item: AlertItem) => {
    const canonicalSymbol = (selectedAsset?.symbol || item.symbol || '').toUpperCase();
    const canonicalDisplay = (selectedAsset?.displaySymbol || item.displaySymbol || canonicalSymbol).toUpperCase();
    const displayName = selectedAsset?.name || item.displayName || canonicalDisplay;
    const assetType = selectedAsset?.assetType || item.assetType;
    const payload = {
      symbol: canonicalSymbol,
      displaySymbol: canonicalDisplay,
      displayName,
      assetType,
      type: item.type,
      direction: item.direction,
      threshold: item.threshold,
      windowTf: item.windowTf,
      cooldown: item.cooldown,
      active: item.active,
    };
    const res = await apiFetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to create alert');
    }
    if (data?.item) {
      const mapped = mapServerAlert(data.item);
      setAlerts((prev) => [...prev, mapped]);
      return mapped;
    }
    await loadAlerts(false);
    return null;
  };

  const removeAlert = async (id: string) => {
    const previous = alerts;
    setAlerts((prev) => prev.filter(a => a.id !== id));
    try {
      const res = await apiFetch(`/api/alerts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('request_failed');
      toast.success('Alert removed');
      await loadAlerts(false);
    } catch (error) {
      toast.error('Failed to delete alert');
      setAlerts(previous);
    }
  };

  const toggleAlertActive = async (alert: AlertItem) => {
    const alertId = String(alert.id);
    if (!alertId || alertId === 'undefined' || alertId === 'null') {
      toast.error('Invalid alert ID');
      return;
    }
    const nextActive = !alert.active;
    setAlerts((prev) => prev.map((x) => String(x.id) === alertId ? { ...x, active: nextActive } : x));
    try {
      const res = await apiFetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'request_failed');
      }
      // Small delay to ensure server commit before reloading
      await new Promise(resolve => setTimeout(resolve, 100));
      await loadAlerts(false);
    } catch (error) {
      toast.error('Failed to update alert');
      setAlerts((prev) => prev.map((x) => String(x.id) === alertId ? { ...x, active: !nextActive } : x));
    }
  };

  const resetForm = () => {
    setSymbol("");
    setType("price");
    setDirection(">=");
    setThreshold("");
    setWindowTf("1h");
    setCooldown("none");
    setEditingId(null);
    setSelectedAsset(null);
    setAssetPickerOpen(false);
  };

  const formatThresholdValue = (alert: AlertItem) => {
    if (alert.threshold == null || !Number.isFinite(alert.threshold)) return "—";
    return alert.type === "%"
      ? `${alert.threshold.toFixed(2)}%`
      : `$${alert.threshold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const describeTrigger = (alert: AlertItem) => {
    const comparator = alert.direction === '>=' ? 'meets or exceeds' : 'falls to or below';
    const target = alert.type === 'price' ? 'price' : '% change';
    const label = alert.displaySymbol || alert.symbol;
    return `${label} ${target} ${comparator} ${formatThresholdValue(alert)}`;
  };

  const formatTimestamp = (epoch: number) => {
    if (!epoch) return '—';
    return new Date(epoch).toLocaleString();
  };

  const handleEdit = (alert: AlertItem) => {
    const display = (alert.displaySymbol || alert.symbol || '').toUpperCase();
    setSymbol(display);
    setSelectedAsset({
      symbol: alert.symbol,
      displaySymbol: display,
      name: alert.displayName || display,
      assetType: alert.assetType || 'unknown',
      logo: logoBySym[display] ?? null,
    });
    setType(alert.type);
    setDirection(alert.direction);
    setThreshold(alert.threshold != null ? String(alert.threshold) : "");
    setWindowTf(alert.windowTf);
    setCooldown(alert.cooldown);
    setEditingId(alert.id);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Alerts</h2>
          <p className="text-muted-foreground">Automated notifications for price moves and market signals</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-border/60"
            onClick={() => { window.location.href = '/dashboard/notifications'; }}
          >
            <Bell className="mr-2 h-4 w-4" /> View Notifications
          </Button>
          <Button className="shadow-[0_20px_45px_-25px_hsl(var(--primary)/0.55)]" onClick={() => setOpen(true)}>
            <BellRing className="mr-2 h-4 w-4" /> New Alert
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border/60 bg-gradient-to-br from-background via-background/80 to-background/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[11px] tracking-wide text-muted-foreground">Total alerts</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Across price and percent-change triggers.</CardContent>
        </Card>
        <Card className="border border-border/60 bg-gradient-to-br from-emerald-500/10 via-background/70 to-background/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[11px] tracking-wide text-muted-foreground">Active vs paused</CardDescription>
            <div className="flex items-baseline gap-2">
              <CardTitle className="text-3xl text-emerald-400 tabular-nums">{stats.active}</CardTitle>
              <span className="text-sm text-muted-foreground">active</span>
              <span className="text-sm text-muted-foreground/80">• {stats.paused} paused</span>
        </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Toggle alerts to quickly pause notifications.</CardContent>
        </Card>
        <Card className="border border-border/60 bg-gradient-to-br from-primary/15 via-background/70 to-background/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[11px] tracking-wide text-muted-foreground">Alert mix</CardDescription>
            <CardTitle className="text-xl">{stats.priceAlerts} price • {stats.percentAlerts} % change</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">In-app notifications with Discord DM syncing in progress.</CardContent>
        </Card>
      </div>

      {alerts.length === 0 ? (
        <Card className="bg-card/60 border border-dashed border-border/70 text-center py-16">
          <CardHeader>
            <CardTitle className="text-lg">No alerts yet</CardTitle>
            <CardDescription>Configure an alert to get notified instantly.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setOpen(true)}>
              <BellRing className="mr-2 h-4 w-4" /> Create your first alert
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {alerts.map((a) => (
            <Card
              key={a.id}
              className="relative overflow-hidden border border-border/60 bg-gradient-to-br from-background/90 via-background/75 to-background/60 shadow-lg transition-all duration-500 hover:border-primary/40 hover:shadow-[0_30px_60px_-35px_hsl(var(--primary)/0.45)]"
            >
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 hover:opacity-100 bg-gradient-to-br from-primary/15 via-transparent to-transparent" />
              <CardHeader className="relative z-10 pb-2">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">{a.type === 'price' ? 'Price alert' : '% change alert'}</Badge>
                      <Badge variant="outline" className="border-border/40 bg-background/70 text-muted-foreground">{a.direction === '>=' ? '≥' : '≤'}</Badge>
                      <Badge variant={a.active ? 'secondary' : 'outline'}>{a.active ? 'Active' : 'Paused'}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-foreground/10 flex items-center justify-center ring-1 ring-border overflow-hidden">
                        {logoBySym[String((a.displaySymbol || a.symbol || '')).toUpperCase()] ? (
                          <img src={logoBySym[String((a.displaySymbol || a.symbol || '')).toUpperCase()] as string} alt={a.displaySymbol || a.symbol} className="h-8 w-8 object-cover" />
                        ) : (
                          <BellRing className="h-6 w-6 text-foreground/70" />
                        )}
                      </div>
                <div>
                        <CardTitle className="text-xl leading-tight">{a.displaySymbol || a.symbol}</CardTitle>
                        <CardDescription className="text-sm text-muted-foreground">
                          {a.displayName && a.displayName !== (a.displaySymbol || a.symbol)
                            ? `${a.displayName} • ${describeTrigger(a)}`
                            : describeTrigger(a)}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] uppercase tracking-wide text-muted-foreground">Threshold</div>
                    <div className="text-3xl font-semibold tabular-nums">{formatThresholdValue(a)}</div>
                    <div className="mt-2 text-xs text-muted-foreground">Window {a.windowTf} • Cooldown {a.cooldown}</div>
                </div>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 pt-0">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground/70">
                      <Clock className="h-3.5 w-3.5" /> Created {formatTimestamp(a.createdAt)}
                    </div>
                    {a.lastTriggeredAt && (
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground/70">
                        <Bell className="h-3.5 w-3.5" /> Last triggered {formatTimestamp(a.lastTriggeredAt)}
                      </div>
                    )}
                    <p>
                      When active, alerts fire in-app and will sync to Discord DMs for subscribed users. Use pause to temporarily stop notifications without deleting the rule.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="secondary" className="bg-primary/10 text-primary">In-app</Badge>
                      <Badge variant="outline" className="border-primary/30 text-primary/80">Discord DM</Badge>
                      <span className="text-muted-foreground">Delivery channels</span>
                    </div>
                  </div>
                  <div className="h-full w-full rounded-xl border border-border/40 bg-background/70 p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>Momentum preview</span>
                      <Repeat className="h-3.5 w-3.5" />
                    </div>
                    <AlertSparkline symbol={a.displaySymbol || a.symbol} />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleAlertActive(a)}>
                    {a.active ? <><Pause className="mr-2 h-4 w-4" /> Pause</> : <><Play className="mr-2 h-4 w-4" /> Resume</>}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(a)}>
                    <Settings2 className="mr-2 h-4 w-4" /> Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete alert?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeAlert(a.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetForm(); }}>
        <SheetContent side="right" className="w-[460px] sm:max-w-[460px] bg-gradient-to-b from-background to-background/60 border-border/60">
          <SheetHeader>
            <SheetTitle>{editingId ? "Update Alert" : "Create Alert"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label>Symbol</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start gap-3 border-border/60 bg-background/60 py-3",
                      !selectedAsset && !symbol ? "text-muted-foreground" : ""
                    )}
                    onClick={() => setAssetPickerOpen(true)}
                  >
                    {selectedAsset ? (
                      <div className="flex items-center gap-3">
                        {selectedAsset.logo ? (
                          <img src={selectedAsset.logo} alt={selectedAsset.displaySymbol} className="h-8 w-8 rounded-full border border-border/40 object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/40 bg-muted text-xs font-semibold">
                            {(selectedAsset.displaySymbol || selectedAsset.symbol || '').slice(0, 3)}
                          </div>
                        )}
                        <div className="flex flex-col text-left">
                          <span className="text-sm font-semibold leading-tight">{selectedAsset.displaySymbol || selectedAsset.symbol}</span>
                          <span className="text-xs text-muted-foreground">
                            {selectedAsset.name || selectedAsset.displaySymbol || selectedAsset.symbol}
                          </span>
                        </div>
                      </div>
                    ) : symbol ? (
                      <div className="flex flex-col text-left">
                        <span className="text-sm font-semibold leading-tight">{symbol}</span>
                        <span className="text-xs text-muted-foreground">Tap to link to a verified asset</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <Search className="h-4 w-4" />
                        <span>Search crypto, stocks…</span>
                      </div>
                    )}
                  </Button>
                  {selectedAsset && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedAsset(null);
                        setSymbol("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Search to ensure alerts use validated market symbols.</p>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="flex gap-2">
                  <Button variant={type === "price" ? "default" : "outline"} size="sm" onClick={() => setType("price")}>Price</Button>
                  <Button variant={type === "%" ? "default" : "outline"} size="sm" onClick={() => setType("%")}>Percent Change</Button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2 sm:col-span-1">
                  <Label>Direction</Label>
                  <div className="flex gap-2">
                    <Button variant={direction === ">=" ? "default" : "outline"} size="sm" onClick={() => setDirection(">=")}>≥</Button>
                    <Button variant={direction === "<=" ? "default" : "outline"} size="sm" onClick={() => setDirection("<=")}>≤</Button>
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-1 lg:col-span-2">
                  <Label>{type === "price" ? "Threshold (price)" : "Threshold (% change)"}</Label>
                  <Input placeholder={type === "price" ? "e.g., 45000" : "e.g., 5"} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Time Window</Label>
                  <Select value={windowTf} onValueChange={setWindowTf}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select window" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15m">15 minutes</SelectItem>
                      <SelectItem value="1h">1 hour</SelectItem>
                      <SelectItem value="4h">4 hours</SelectItem>
                      <SelectItem value="1d">1 day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Throttle</Label>
                  <Select value={cooldown} onValueChange={setCooldown}>
                    <SelectTrigger>
                      <SelectValue placeholder="No throttle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="5m">5 minutes</SelectItem>
                      <SelectItem value="30m">30 minutes</SelectItem>
                      <SelectItem value="1h">1 hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Delivery</Label>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">In-app</Badge>
                  <Badge variant="outline">Discord DM</Badge>
                  <span className="ml-1">Notifications will be sent via these channels.</span>
                </div>
              </div>
              <div className="h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                <Button className="flex-1" disabled={!canCreate} onClick={async () => {
                  if (!selectedAsset) {
                    toast.error('Select a valid asset first');
                    return;
                  }
                  const normalizedSymbol = (selectedAsset.symbol || symbol).trim().toUpperCase();
                  const normalizedDisplay = (selectedAsset.displaySymbol || normalizedSymbol).toUpperCase();
                  const normalizedName = selectedAsset.name || normalizedDisplay;
                  const val = Number(threshold);
                  const item: AlertItem = {
                    id: String(Date.now()),
                    symbol: normalizedSymbol,
                    displaySymbol: normalizedDisplay,
                    displayName: normalizedName,
                    assetType: selectedAsset.assetType,
                    type,
                    direction,
                    threshold: Number.isFinite(val) ? val : null,
                    windowTf,
                    cooldown,
                    active: true,
                    createdAt: Date.now(),
                  };
                  if (editingId) {
                    try {
                      const res = await apiFetch(`/api/alerts/${editingId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          symbol: item.symbol,
                          displaySymbol: item.displaySymbol,
                          displayName: item.displayName,
                          assetType: item.assetType,
                          type: item.type,
                          direction: item.direction,
                          threshold: item.threshold,
                          windowTf: item.windowTf,
                          cooldown: item.cooldown,
                          active: item.active,
                        }),
                      });
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to update alert');
                      }
                      toast.success('Alert updated');
                      await loadAlerts(false);
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Failed to update alert');
                      return;
                    }
                  } else {
                    try {
                      await addAlert(item);
                  toast.success('Alert created');
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Failed to create alert');
                      return;
                    }
                  }
                  setOpen(false);
                  resetForm();
                }}>{editingId ? 'Save Changes' : 'Create Alert'}</Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <AssetSearchDialog
        open={assetPickerOpen}
        onOpenChange={setAssetPickerOpen}
        initialQuery={symbol}
        onSelect={(asset) => {
          setSelectedAsset(asset);
          setSymbol((asset.displaySymbol || asset.symbol || '').toUpperCase());
        }}
      />
    </div>
  );
};

export default Alerts;


