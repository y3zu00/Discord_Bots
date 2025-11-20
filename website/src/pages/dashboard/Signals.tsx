import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Filter, 
  Search,
  Bell,
  BookmarkPlus,
  LineChart,
  Clock,
  Sparkles,
  Target,
  Shield,
  TrendingUp,
  TrendingDown,
  Trash2,
} from "lucide-react";

type SignalTarget = {
  label: string;
  price: number | null;
  pct: number | null;
};

type SignalEntry = {
  low: number | null;
  high: number | null;
  mid?: number | null;
};

type SignalPerformance = {
  status: string;
  direction: 'buy' | 'sell';
  entryPrice: number | null;
  lastPrice: number | null;
  currentMovePct: number | null;
  maxGainPct: number | null;
  maxDrawdownPct: number | null;
  evaluatedAt: string | null;
  resolvedAt?: string | null;
  timeToResolutionMinutes?: number | null;
  targetLabel?: string | null;
  targetPrice?: number | null;
  stopPrice?: number | null;
  stopHitAt?: string | null;
  nextTargetPrice?: number | null;
  nextTargetLabel?: string | null;
  nextTargetPct?: number | null;
  targetsTotal?: number | null;
  targetsHit?: number | null;
  barsChecked?: number | null;
  highPrice?: number | null;
  lowPrice?: number | null;
};

type SignalItem = {
  id: string | number;
  symbol: string;
  rawSymbol: string;
  assetType: string;
  assetLabel: string;
  logoUrl?: string | null;
  type: "BUY" | "SELL";
  price: string;
  priceValue: number | null;
  entry: SignalEntry | null;
  entryRange: string;
  targets: SignalTarget[];
  stop: { price: number | null; pct: number | null } | null;
  stopLoss: string;
  target: string;
  signalStrength: string | null;
  confidence: string | null;
  score: number | null;
  timeframes: Record<string, string>;
  chartUrl: string | null;
  postedAt: string;
  time: string;
  description: string;
  summary: string;
  status: string;
  details: Record<string, unknown> | null;
  performance: SignalPerformance | null;
};

type WatchlistEntry = {
  symbol: string;
  addedAt: number;
};

const valueAsString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const valueAsNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[^0-9.+-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const valueAsStringOrNull = (value: unknown): string | null => {
  const str = valueAsString(value, "");
  return str ? str : null;
};

const valueAsRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const valueAsArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const isWatchlistEntry = (value: unknown): value is WatchlistEntry => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.symbol === "string";
};

const timeframePriority = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "1d", "1w", "1M"];

const strengthTone = (strength?: string | null) => {
  if (!strength) return "bg-muted/20 text-muted-foreground border border-border/30";
  const upper = strength.toUpperCase();
  if (upper.includes("STRONG") && upper.includes("BUY")) return "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30";
  if (upper.includes("BUY")) return "bg-emerald-500/10 text-emerald-200 border border-emerald-400/20";
  if (upper.includes("SELL")) return "bg-red-500/10 text-red-300 border border-red-400/20";
  if (upper.includes("WATCH") || upper.includes("NEUTRAL")) return "bg-amber-500/10 text-amber-200 border border-amber-400/20";
  return "bg-muted/20 text-muted-foreground border border-border/30";
};

const recommendationTone = (value: string) => {
  const upper = value.toUpperCase();
  if (upper.includes("STRONG") && upper.includes("BUY")) return "bg-emerald-500/15 text-emerald-200 border border-emerald-400/30";
  if (upper.includes("BUY")) return "bg-emerald-500/10 text-emerald-200 border border-emerald-400/20";
  if (upper.includes("SELL")) return "bg-red-500/10 text-red-300 border border-red-400/20";
  if (upper.includes("NEUTRAL") || upper.includes("HOLD")) return "bg-muted/20 text-muted-foreground border border-border/30";
  return "bg-slate-500/15 text-slate-200 border border-slate-400/20";
};

const normalizeSignal = (rawInput: Record<string, unknown>, fallbackIndex?: number): SignalItem => {
  const raw = rawInput || {};
  const details = valueAsRecord(raw.details) || {};
  const symbolMeta = valueAsRecord(details.symbol_meta);

  const logoUrlCandidate = valueAsString(
    raw.logoUrl,
    valueAsString(
      raw.logo_url,
      valueAsString(
        details.logo_url,
        valueAsString(
          details.logoUrl,
          valueAsString(symbolMeta?.logo)
        )
      )
    )
  );

  const rawSymbolCandidate = valueAsString(
    raw.rawSymbol,
    valueAsString(
      raw.symbol,
      valueAsString(
        raw.displaySymbol,
        valueAsString(
          details.displaySymbol,
          valueAsString(symbolMeta?.symbol, valueAsString(symbolMeta?.displaySymbol))
        )
      )
    )
  );
  const symbolCandidate = valueAsString(
    raw.symbol,
    valueAsString(
      raw.displaySymbol,
      valueAsString(details.displaySymbol, valueAsString(symbolMeta?.displaySymbol, rawSymbolCandidate))
    )
  );
  const rawSymbol = rawSymbolCandidate.toUpperCase();
  const symbol = symbolCandidate.toUpperCase();

  const assetTypeSource = valueAsString(
    raw.assetType,
    valueAsString(
      raw.asset_type,
      valueAsString(
        details.asset_type,
        valueAsString(symbolMeta?.assetType, "equity")
      )
    )
  );
  const assetType = assetTypeSource.toLowerCase();
  const assetLabel = valueAsString(
    raw.assetLabel,
    valueAsString(
      details.asset_label,
      (() => {
        if (symbolMeta && typeof symbolMeta.assetType === "string") {
          const lower = symbolMeta.assetType.toLowerCase();
          return lower === "crypto" ? "Crypto" : lower === "forex" ? "FX" : "Equity";
        }
        return assetType === "crypto" ? "Crypto" : assetType === "forex" ? "FX" : "Equity";
      })()
    )
  );

  const priceValue = valueAsNumber(raw.priceValue) ?? valueAsNumber(raw.price);
  const price = valueAsString(raw.price, priceValue != null
    ? `$${priceValue.toLocaleString(undefined, { maximumFractionDigits: priceValue >= 100 ? 2 : 4 })}`
    : "—");

  const entrySource = valueAsRecord(raw.entry) || valueAsRecord(details.entry);
  const entry: SignalEntry | null = entrySource
    ? {
        low: valueAsNumber(entrySource.low),
        high: valueAsNumber(entrySource.high),
        mid: valueAsNumber(entrySource.mid) ?? undefined,
      }
    : null;
  const entryRange = valueAsString(raw.entryRange, (entry && entry.low != null && entry.high != null)
    ? `$${entry.low.toLocaleString(undefined, { maximumFractionDigits: 4 })} → $${entry.high.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
    : "");

  const targetsSource = valueAsArray(raw.targets).length > 0 ? valueAsArray(raw.targets) : valueAsArray(details.targets);
  const targets: SignalTarget[] = targetsSource
    .map((target, idx) => {
      const targetRecord = valueAsRecord(target);
      if (!targetRecord) return null;
      const targetPrice = valueAsNumber(targetRecord.price);
      const targetPct = valueAsNumber(targetRecord.pct);
      if (targetPrice == null && targetPct == null) return null;
      return {
        label: valueAsString(targetRecord.label, `Target ${idx + 1}`),
        price: targetPrice,
        pct: targetPct,
      };
    })
    .filter((item): item is SignalTarget => item !== null);

  const stopSource = valueAsRecord(raw.stop) || valueAsRecord(details.stop);
  const stop = stopSource
    ? {
        price: valueAsNumber(stopSource.price),
        pct: valueAsNumber(stopSource.pct),
      }
    : null;
  const stopLoss = valueAsString(raw.stopLoss, (stop && stop.price != null)
    ? `$${stop.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}${stop.pct != null ? ` (${stop.pct >= 0 ? "+" : ""}${stop.pct.toFixed(Math.abs(stop.pct) >= 1 ? 2 : 3)}%)` : ""}`
    : "");

  const timeframesSource = valueAsRecord(raw.timeframes) || valueAsRecord(details.timeframes) || {};
  const timeframes: Record<string, string> = {};
  Object.entries(timeframesSource).forEach(([key, value]) => {
    const stringValue = valueAsString(value);
    if (stringValue) timeframes[key] = stringValue;
  });

  const postedAtRaw = valueAsString(raw.postedAt, valueAsString(raw.time, valueAsString(raw.timestamp, valueAsString(details.posted_at, new Date().toISOString()))));
  const postedDate = new Date(postedAtRaw);
  const postedAt = Number.isNaN(postedDate.getTime()) ? new Date().toISOString() : postedDate.toISOString();

  const description = valueAsString(raw.description, valueAsString(raw.summary, valueAsString(details.summary)));
  const score = valueAsNumber(raw.score) ?? valueAsNumber(details.score);
  const signalStrength = valueAsString(raw.signalStrength, valueAsString(raw.signal_strength, valueAsString(details.signal_strength)));
  const confidence = valueAsString(raw.confidence, valueAsString(details.confidence)) || null;
  const chartUrl = valueAsString(raw.chartUrl, valueAsString(raw.chart_url, valueAsString(details.chart_url)));

  const primaryTarget = targets.length > 0 ? targets[0] : null;

  const performanceRecord = valueAsRecord(raw.performance) || valueAsRecord(details.performance);
  const performanceStatusFallback = valueAsString(performanceRecord?.status, valueAsString(raw.performance, valueAsString(details.performance_status, "open"))).toLowerCase();
  const performanceStatus = performanceStatusFallback || (valueAsString(raw.status, "active").toLowerCase() === "completed" ? "target_hit"
    : valueAsString(raw.status, "active").toLowerCase() === "closed" ? "stop_hit"
    : "open");
  const performanceDirectionRaw = valueAsString(performanceRecord?.direction, valueAsString(details.direction, valueAsString(raw.type, "BUY"))).toLowerCase();
  const performanceDirection: 'buy' | 'sell' = performanceDirectionRaw.startsWith('sell') ? 'sell' : 'buy';

  const performance: SignalPerformance | null = performanceRecord ? {
    status: performanceStatus,
    direction: performanceDirection,
    entryPrice: valueAsNumber(performanceRecord.entryPrice) ?? priceValue,
    lastPrice: valueAsNumber(performanceRecord.lastPrice),
    currentMovePct: valueAsNumber(performanceRecord.currentMovePct),
    maxGainPct: valueAsNumber(performanceRecord.maxGainPct),
    maxDrawdownPct: valueAsNumber(performanceRecord.maxDrawdownPct),
    evaluatedAt: valueAsStringOrNull(performanceRecord.evaluatedAt),
    resolvedAt: valueAsStringOrNull(performanceRecord.resolvedAt),
    timeToResolutionMinutes: valueAsNumber(performanceRecord.timeToResolutionMinutes),
    targetLabel: valueAsStringOrNull(performanceRecord.targetLabel),
    targetPrice: valueAsNumber(performanceRecord.targetPrice),
    stopPrice: valueAsNumber(performanceRecord.stopPrice),
    stopHitAt: valueAsStringOrNull(performanceRecord.stopHitAt),
    nextTargetPrice: valueAsNumber(performanceRecord.nextTargetPrice),
    nextTargetLabel: valueAsStringOrNull(performanceRecord.nextTargetLabel),
    nextTargetPct: valueAsNumber(performanceRecord.nextTargetPct),
    targetsTotal: valueAsNumber(performanceRecord.targetsTotal),
    targetsHit: valueAsNumber(performanceRecord.targetsHit),
    barsChecked: valueAsNumber(performanceRecord.barsChecked),
    highPrice: valueAsNumber(performanceRecord.highPrice),
    lowPrice: valueAsNumber(performanceRecord.lowPrice),
  } : null;

  return {
    id: typeof raw.id === "string" || typeof raw.id === "number" ? raw.id : `signal-${symbol}-${fallbackIndex ?? Date.now()}`,
    symbol: symbol || rawSymbol,
    rawSymbol: rawSymbol || symbol,
    assetType,
    assetLabel,
    logoUrl: logoUrlCandidate ? logoUrlCandidate : undefined,
    type: (valueAsString(raw.type, valueAsString(raw.signal_type, "BUY"))).toUpperCase().includes("SELL") ? "SELL" : "BUY",
    price,
    priceValue,
    entry,
    entryRange,
    targets,
    stop,
    stopLoss,
    target: valueAsString(raw.target, primaryTarget && primaryTarget.price != null
      ? `$${primaryTarget.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}${primaryTarget.pct != null ? ` (${primaryTarget.pct >= 0 ? "+" : ""}${primaryTarget.pct.toFixed(Math.abs(primaryTarget.pct) >= 1 ? 2 : 3)}%)` : ""}`
      : ""),
    signalStrength: signalStrength || null,
    confidence,
    score,
    timeframes,
    chartUrl: chartUrl || null,
    postedAt,
    time: postedAt,
    description,
    summary: valueAsString(raw.summary, description),
    status: valueAsString(raw.status, "active") || "active",
    details,
    performance,
  };
};

const Signals: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterAsset, setFilterAsset] = useState("all");
  const [groupBySymbol, setGroupBySymbol] = useState(true);
  const [items, setItems] = useState<SignalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<SignalItem | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [nsymbol, setNsymbol] = useState("");
  const [ntype, setNtype] = useState<"BUY" | "SELL">("BUY");
  const [nprice, setNprice] = useState("");
  const [ndesc, setNdesc] = useState("");
  const [nAssetType, setNAssetType] = useState<'crypto'|'equity'|'forex'>('equity');
  const [nStrength, setNStrength] = useState<string>('🟡 BUY');
  const [nEntryLow, setNEntryLow] = useState<string>('');
  const [nEntryHigh, setNEntryHigh] = useState<string>('');
  const [nStopPrice, setNStopPrice] = useState<string>('');
  const [nStopPct, setNStopPct] = useState<string>('');
  const [nTarget1Price, setNTarget1Price] = useState<string>('');
  const [nTarget1Pct, setNTarget1Pct] = useState<string>('');
  const [nTarget2Price, setNTarget2Price] = useState<string>('');
  const [nTarget2Pct, setNTarget2Pct] = useState<string>('');
  const [nConfidence, setNConfidence] = useState<string>('Medium');
  const [nScore, setNScore] = useState<string>('');
  const [nChartUrl, setNChartUrl] = useState<string>('');
  const [nTF1h, setNTF1h] = useState<string>('BUY');
  const [nTF4h, setNTF4h] = useState<string>('BUY');
  const [nTF1d, setNTF1d] = useState<string>('NEUTRAL');
  const [version, setVersion] = useState(0);
  const [watchlistVersion, setWatchlistVersion] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<{ id: string | number; symbol: string } | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  const [logoBy, setLogoBy] = useState<Record<string, string | null>>({});
  const logoFetchRef = useRef<Set<string>>(new Set());

  const baseSym = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  async function loadSignals() {
      setLoading(true);
      setError(null);
      try {
      const res = await fetch(`/api/signals?limit=40`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const payload = (await res.json()) as { items?: unknown };
      const normalized = Array.isArray(payload?.items)
        ? payload.items.map((item, idx) => normalizeSignal(valueAsRecord(item) || {}, idx))
        : [];
      setItems(normalized);
    } catch (error) {
      console.error("Failed to load signals", error);
      const message = error instanceof Error ? error.message : "Failed to load signals";
      setError(message);
      } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/session", { credentials: "include" });
        const data = (await res.json()) as { session?: { isAdmin?: boolean } };
        if (data?.session?.isAdmin) setIsAdmin(true);
      } catch (error) {
        console.error("Failed to load session", error);
      }
      if (mounted) await loadSignals();
    })();
    return () => { mounted = false; };
  }, [version]);

  useEffect(() => {
    try {
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
      wsRef.current = ws;
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as Record<string, unknown>;
          if (valueAsString(message.type) === "signal_added") {
            const signalPayload = valueAsRecord(message.signal);
            if (signalPayload) {
              setItems((prev) => {
                const normalized = normalizeSignal(signalPayload, Date.now());
                const deduped = prev.filter((item) => item.id !== normalized.id);
                return [normalized, ...deduped].slice(0, 60);
              });
            }
          }
        } catch (error) {
          console.error("Failed to process incoming signal", error);
        }
      };
      ws.onclose = () => { wsRef.current = null; };
      return () => {
        try { ws.close(); } catch (error) { console.error("Failed to close websocket", error); }
      };
    } catch (error) {
      console.error("Failed to initialize websocket", error);
      return () => {};
    }
  }, []);

  useEffect(() => {
    const missingSymbols = Array.from(new Set(
      items
        .filter((item) => !item.logoUrl)
        .map((item) => baseSym(item.rawSymbol))
        .filter(Boolean)
    ))
      .filter((sym) => sym && !logoBy[sym]);

    if (missingSymbols.length === 0) return;

    const fetchQueue = logoFetchRef.current;
    const toFetch = missingSymbols.filter((sym) => !fetchQueue.has(sym));
    if (toFetch.length === 0) return;

    toFetch.forEach((sym) => fetchQueue.add(sym));
    let cancelled = false;

    (async () => {
      const updates: Record<string, string | null> = {};
      for (const sym of toFetch) {
        try {
          const res = await fetch(`/api/asset-search?query=${encodeURIComponent(sym)}`, { credentials: "include" });
          if (!res.ok) throw new Error(`asset search failed for ${sym}`);
          const data = await res.json();
          const list = Array.isArray(data?.items) ? data.items : [];
          const match = list.find((entry: any) => {
            const symbol = baseSym(String(entry?.symbol || ""));
            const displaySymbol = baseSym(String(entry?.displaySymbol || ""));
            return symbol === sym || displaySymbol === sym;
          }) || list[0];
          if (match) {
            const logo = match.logo || match.image || match.icon || match.thumb || null;
            updates[sym] = typeof logo === "string" && logo ? logo : null;
          } else {
            updates[sym] = null;
          }
        } catch (error) {
          console.warn(`Failed to fetch asset meta for ${sym}`, error);
          updates[sym] = null;
        }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setLogoBy((prev) => ({ ...prev, ...updates }));
      }
      toFetch.forEach((sym) => fetchQueue.delete(sym));
    })();

    return () => {
      cancelled = true;
    };
  }, [items, logoBy]);

  const watchlistSet = useMemo(() => {
    try {
      const rawList = JSON.parse(localStorage.getItem("joat:watchlist") || "[]") as unknown;
      const entries = Array.isArray(rawList) ? rawList.filter(isWatchlistEntry) : [];
      return new Set(entries.map((entry) => entry.symbol));
    } catch {
      return new Set<string>();
    }
  }, [watchlistVersion]);

  const filteredSignals = useMemo(() => items.filter((signal) => {
    const matchesSearch = `${signal.symbol} ${signal.rawSymbol}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterType === "all" || signal.status === filterType;
    const matchesAsset = filterAsset === "all" || signal.assetType === filterAsset;
    return matchesSearch && matchesStatus && matchesAsset;
  }), [items, searchTerm, filterType, filterAsset]);

  const groupedSignals = useMemo(() => {
    if (!groupBySymbol) return [] as Array<{ symbol: string; signals: SignalItem[] }>;
    const map = new Map<string, SignalItem[]>();
    filteredSignals.forEach((signal) => {
      const key = signal.symbol || signal.rawSymbol;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(signal);
    });
    const groups = Array.from(map.entries()).map(([symbol, list]) => {
      const sorted = [...list].sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
      return { symbol, signals: sorted };
    });
    groups.sort((a, b) => {
      const aTime = new Date(a.signals[0]?.postedAt || 0).getTime();
      const bTime = new Date(b.signals[0]?.postedAt || 0).getTime();
      return bTime - aTime;
    });
    return groups;
  }, [filteredSignals, groupBySymbol]);

  const symbolPerformance = useMemo(() => {
    const map = new Map<string, { total: number; wins: number; losses: number; open: number; winRate: number }>();
    items.forEach((signal) => {
      const key = baseSym(signal.rawSymbol || signal.symbol);
      if (!map.has(key)) {
        map.set(key, { total: 0, wins: 0, losses: 0, open: 0, winRate: 0 });
      }
      const entry = map.get(key)!;
      entry.total += 1;
      const perfStatus = (signal.performance?.status || '').toLowerCase();
      const resolvedStatus = signal.status.toLowerCase();
      if (perfStatus === 'target_hit' || resolvedStatus === 'completed') {
        entry.wins += 1;
      } else if (perfStatus === 'stop_hit' || resolvedStatus === 'closed') {
        entry.losses += 1;
      } else {
        entry.open += 1;
      }
    });
    map.forEach((entry) => {
      const resolved = entry.wins + entry.losses;
      entry.winRate = resolved > 0 ? Math.round((entry.wins / resolved) * 1000) / 10 : 0;
    });
    return map;
  }, [items]);

  const isNewSignal = (iso: string) => {
    const time = new Date(iso).getTime();
    return Number.isFinite(time) && Date.now() - time < 2 * 60 * 60 * 1000;
  };

  const relativeTime = (iso: string) => {
    try {
      return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
    } catch {
      return "Just now";
    }
  };

  const formatPct = (value: number | null | undefined, { sign = true }: { sign?: boolean } = {}) => {
    if (value == null || Number.isNaN(value)) return "—";
    const formatted = Math.abs(value) >= 1 ? value.toFixed(2) : value.toFixed(3);
    if (!sign) return `${formatted}%`;
    const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
    return `${prefix}${Math.abs(value) >= 1 ? Math.abs(value).toFixed(2) : Math.abs(value).toFixed(3)}%`;
  };

  const formatPrice = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) return "—";
    const decimals = Math.abs(value) >= 100 ? 2 : Math.abs(value) >= 1 ? 3 : 4;
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: decimals })}`;
  };

  const formatMinutesDuration = (minutes: number | null | undefined) => {
    if (!minutes || Number.isNaN(minutes) || minutes <= 0) return "";
    const totalMinutes = Math.round(minutes);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours && mins) return `${hours}h ${mins}m`;
    if (hours) return `${hours}h`;
    return `${mins}m`;
  };

  const getPerformanceInfo = (signal: SignalItem) => {
    const perf = signal.performance;
    const rawStatus = perf?.status || signal.status.toLowerCase();
    const status = rawStatus === 'completed' ? 'target_hit'
      : rawStatus === 'closed' ? 'stop_hit'
      : rawStatus;
    const direction = perf?.direction || (signal.type === 'SELL' ? 'sell' : 'buy');
    const entryPrice = perf?.entryPrice ?? signal.priceValue ?? null;
    const lastPrice = perf?.lastPrice ?? signal.priceValue ?? null;
    const currentMove = perf?.currentMovePct ?? null;
    const maxGain = perf?.maxGainPct ?? null;
    const maxDrawdown = perf?.maxDrawdownPct ?? null;
    const timeToResolution = perf?.timeToResolutionMinutes ?? null;
    const nextTargetPrice = perf?.nextTargetPrice ?? null;
    const nextTargetPct = perf?.nextTargetPct ?? null;
    const nextTargetLabel = perf?.nextTargetLabel ?? null;
    const evaluatedAt = perf?.evaluatedAt ?? null;
    const resolvedAt = perf?.resolvedAt ?? null;
    const targetLabel = perf?.targetLabel ?? null;
    const targetPrice = perf?.targetPrice ?? null;

    let badgeLabel = "Open";
    let badgeClass = "bg-sky-500/15 text-sky-200 border border-sky-400/30";
    let headline = "Live trade tracking";
    let subline = "Monitoring performance in real time.";

    if (status === 'target_hit') {
      badgeLabel = "Target Hit";
      badgeClass = "bg-emerald-500/15 text-emerald-200 border border-emerald-400/30";
      const duration = formatMinutesDuration(timeToResolution);
      const targetName = targetLabel || 'Target';
      headline = `${targetName} reached${duration ? ` in ${duration}` : ''}`;
      const gainText = formatPct(maxGain, { sign: true });
      subline = `Max gain ${gainText}${targetPrice ? ` • ${formatPrice(targetPrice)}` : ''}`;
    } else if (status === 'stop_hit') {
      badgeLabel = "Stopped Out";
      badgeClass = "bg-red-500/15 text-red-200 border border-red-400/30";
      const duration = formatMinutesDuration(timeToResolution);
      headline = `Stop loss triggered${duration ? ` after ${duration}` : ''}`;
      const drawText = formatPct(maxDrawdown, { sign: true });
      subline = `Max drawdown ${drawText}${perf?.stopPrice ? ` • ${formatPrice(perf.stopPrice)}` : ''}`;
    } else {
      badgeLabel = direction === 'buy' ? "Open Long" : "Open Short";
      badgeClass = direction === 'buy'
        ? "bg-primary/15 text-primary border border-primary/30"
        : "bg-amber-500/15 text-amber-200 border border-amber-400/30";
      const progressText = nextTargetPct != null ? `${formatPct(nextTargetPct, { sign: true })} to ${nextTargetLabel || 'next target'}` : 'Watching for move';
      headline = progressText;
      const gainText = formatPct(maxGain, { sign: true });
      const drawText = formatPct(maxDrawdown, { sign: true });
      subline = `Max ${gainText} / Drawdown ${drawText}`;
    }

    const metrics: Array<{ label: string; value: string; tone?: 'positive' | 'negative' | 'muted' }> = [];
    if (currentMove != null) {
      metrics.push({ label: 'Current Move', value: formatPct(currentMove, { sign: true }), tone: currentMove >= 0 ? 'positive' : 'negative' });
    }
    if (maxGain != null) {
      metrics.push({ label: 'Max Gain', value: formatPct(maxGain, { sign: true }), tone: 'positive' });
    }
    if (maxDrawdown != null) {
      metrics.push({ label: 'Max Drawdown', value: formatPct(maxDrawdown, { sign: true }), tone: 'negative' });
    }
    if (nextTargetPrice && status === 'open') {
      metrics.push({ label: nextTargetLabel || 'Next Target', value: `${formatPrice(nextTargetPrice)}${nextTargetPct != null ? ` (${formatPct(nextTargetPct, { sign: true })})` : ''}`, tone: 'muted' });
    }
    if (lastPrice != null) {
      metrics.push({ label: 'Last Price', value: formatPrice(lastPrice), tone: 'muted' });
    }
    if (entryPrice != null) {
      metrics.push({ label: 'Entry', value: formatPrice(entryPrice), tone: 'muted' });
    }
    if (evaluatedAt) {
      metrics.push({ label: 'Updated', value: relativeTime(evaluatedAt), tone: 'muted' });
    } else if (resolvedAt) {
      metrics.push({ label: 'Resolved', value: relativeTime(resolvedAt), tone: 'muted' });
    }

    return { status, badgeLabel, badgeClass, headline, subline, metrics };
  };

  const getSignalLogo = useCallback((signal: SignalItem): string | null => {
    try {
      const details = signal.details && typeof signal.details === "object" ? (signal.details as Record<string, unknown>) : null;
      const symbolMeta = details && typeof details.symbol_meta === "object" ? (details.symbol_meta as Record<string, unknown>) : null;
      const metaLogo = symbolMeta && typeof symbolMeta.logo === "string" && symbolMeta.logo ? symbolMeta.logo : null;
      const altLogo = details && typeof details.logo === "string" && details.logo ? details.logo
        : details && typeof details.logo_url === "string" && details.logo_url ? details.logo_url
        : null;
      return (signal.logoUrl || metaLogo || altLogo || logoBy[baseSym(signal.rawSymbol)] || null) as string | null;
    } catch {
      return signal.logoUrl || null;
    }
  }, [logoBy]);

  const addToWatchlist = async (signal: SignalItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const baseSymbol = baseSym(signal.rawSymbol || signal.symbol);
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: baseSymbol })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to add');
      }
      const canonical = String(data?.item?.symbol || baseSymbol).toUpperCase();
      try {
        const rawList = JSON.parse(localStorage.getItem('joat:watchlist') || '[]') as unknown;
        const entries = Array.isArray(rawList) ? rawList.filter(isWatchlistEntry) : [];
        const entry = { symbol: canonical, addedAt: Date.now() };
        const next: WatchlistEntry[] = [entry, ...entries.filter((item) => item.symbol !== entry.symbol)];
        localStorage.setItem('joat:watchlist', JSON.stringify(next));
      } catch (storageErr) {
        console.warn('Failed to sync watchlist locally', storageErr);
      }
      toast.success('Added to Watchlist');
      setWatchlistVersion((v) => v + 1);
    } catch (error) {
      console.error('Failed to add to watchlist', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add to Watchlist');
    }
  };

  const prefFillAlert = (signal: SignalItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      localStorage.setItem("joat:alerts:prefill", JSON.stringify({
        symbol: signal.rawSymbol || signal.symbol,
        type: "price",
        direction: signal.type === "BUY" ? ">=" : "<=",
        threshold: signal.priceValue ?? undefined,
      }));
      window.location.href = "/dashboard/alerts";
    } catch (error) {
      console.error("Failed to prefill alert", error);
      toast.error("Failed to open alert creator");
    }
  };

  const viewChart = (signal: SignalItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const url = signal.chartUrl || `https://www.tradingview.com/symbols/${signal.rawSymbol || signal.symbol}`;
    window.open(url, "_blank", "noopener");
  };

  const requestDeleteSignal = (signal: SignalItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPendingDelete({ id: signal.id, symbol: signal.symbol });
  };

  const confirmDeleteSignal = async () => {
    if (!pendingDelete) return;
    try {
      const res = await fetch(`/api/signals/${pendingDelete.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("delete_failed");
      setItems((prev) => prev.filter((signal) => signal.id !== pendingDelete.id));
      toast.success(`${pendingDelete.symbol} deleted`);
    } catch (error) {
      console.error("Failed to delete signal", error);
      toast.error("Failed to delete signal");
    } finally {
      setPendingDelete(null);
    }
  };

  async function createSignal() {
    try {
      const targets: Array<{ label: string; price: number|null; pct: number|null }> = [];
      if (nTarget1Price || nTarget1Pct) targets.push({ label: 'Target 1', price: nTarget1Price ? Number(nTarget1Price) : null, pct: nTarget1Pct ? Number(nTarget1Pct) : null });
      if (nTarget2Price || nTarget2Pct) targets.push({ label: 'Target 2', price: nTarget2Price ? Number(nTarget2Price) : null, pct: nTarget2Pct ? Number(nTarget2Pct) : null });
      const entry = (nEntryLow || nEntryHigh) ? { low: nEntryLow ? Number(nEntryLow) : null, high: nEntryHigh ? Number(nEntryHigh) : null } : undefined;
      const stop = (nStopPrice || nStopPct) ? { price: nStopPrice ? Number(nStopPrice) : null, pct: nStopPct ? Number(nStopPct) : null } : undefined;
      const timeframes = { '1h': nTF1h || 'NEUTRAL', '4h': nTF4h || 'NEUTRAL', '1d': nTF1d || 'NEUTRAL' } as Record<string, string>;

      const body = {
        symbol: nsymbol.toUpperCase(),
        displaySymbol: nsymbol.toUpperCase(),
        type: ntype,
        price: nprice ? Number(nprice) : null,
        description: ndesc,
        assetType: nAssetType,
        signalStrength: nStrength,
        confidence: nConfidence,
        score: nScore ? Number(nScore) : undefined,
        chartUrl: nChartUrl || undefined,
        timeframes,
        entry,
        targets,
        stop,
      } as any;
      const res = await fetch("/api/signals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("create_failed");
      setNsymbol(""); setNprice(""); setNdesc("");
      setNAssetType('equity'); setNStrength('🟡 BUY');
      setNEntryLow(""); setNEntryHigh("");
      setNStopPrice(""); setNStopPct("");
      setNTarget1Price(""); setNTarget1Pct("");
      setNTarget2Price(""); setNTarget2Pct("");
      setNConfidence('Medium'); setNScore(""); setNChartUrl("");
      setNTF1h('BUY'); setNTF4h('BUY'); setNTF1d('NEUTRAL');
      setVersion((v) => v + 1);
      toast.success("Signal created");
    } catch (error) {
      console.error("Failed to create signal", error);
      toast.error("Failed to create signal");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Trading Signals</h2>
          <p className="text-muted-foreground">Daily AI-powered setups mirrored from the Discord feed.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => window.location.href = "/dashboard/alerts"}>
          <Bell className="mr-2 h-4 w-4" />
            Manage Alerts
        </Button>
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => document.getElementById('admin-create-signal')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              New Signal
            </Button>
          )}
        </div>
      </div>

      <Card className="bg-background/70 border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
          <CardDescription>Refine signals by asset class or status.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search symbols or tickers"
                  className="pl-10"
                />
              </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={filterAsset} onValueChange={setFilterAsset}>
              <SelectTrigger className="sm:w-[180px]">
                <SelectValue placeholder="Asset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assets</SelectItem>
                <SelectItem value="crypto">Crypto</SelectItem>
                <SelectItem value="equity">Equities</SelectItem>
                <SelectItem value="forex">Forex</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="closed">Stopped Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/60 px-4 py-3">
        <div className="text-sm text-muted-foreground">
          {filteredSignals.length} {filteredSignals.length === 1 ? "signal" : "signals"}
          {groupBySymbol ? ` • ${groupedSignals.length} ${groupedSignals.length === 1 ? "symbol" : "symbols"}` : ""}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={groupBySymbol ? "default" : "outline"}
            size="sm"
            onClick={() => setGroupBySymbol(true)}
            className={groupBySymbol ? "shadow-[0_0_18px_rgba(56,189,248,0.25)]" : ""}
          >
            Grouped view
          </Button>
          <Button
            variant={!groupBySymbol ? "default" : "outline"}
            size="sm"
            onClick={() => setGroupBySymbol(false)}
            className={!groupBySymbol ? "shadow-[0_0_18px_rgba(251,191,36,0.25)]" : ""}
          >
            Timeline view
          </Button>
        </div>
      </div>

      {loading && (
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="border-border/60 bg-background/60">
              <CardHeader className="space-y-3">
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {!loading && !error && filteredSignals.length === 0 && (
        <Card className="border-border/60 bg-background/60">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Filter className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No signals match your filters</h3>
            <p className="text-sm text-muted-foreground">Adjust search keywords or filter options to discover more setups.</p>
          </CardContent>
        </Card>
      )}

      {groupBySymbol ? (
        <div className="space-y-4">
          {groupedSignals.map(({ symbol, signals }) => {
            const latest = signals[0];
            if (!latest) return null;
            const resolvedLogo = getSignalLogo(latest);
            const latestTimeframes = Object.entries(latest.timeframes).sort((a, b) => {
              const ai = timeframePriority.indexOf(a[0]);
              const bi = timeframePriority.indexOf(b[0]);
              if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
              if (ai === -1) return 1;
              if (bi === -1) return -1;
              return ai - bi;
            }).slice(0, 4);
            const stats = symbolPerformance.get(baseSym(symbol));
            const latestPerformance = getPerformanceInfo(latest);
            return (
          <Card 
                key={`group-${symbol}`}
                className="relative overflow-hidden border border-border/60 bg-gradient-to-br from-background/90 via-background/75 to-background/60 shadow-xl"
              >
                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 hover:opacity-100 bg-gradient-to-br from-primary/10 via-primary/0 to-transparent" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <CardHeader className="relative z-10 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex flex-1 items-start gap-3">
                      {resolvedLogo && (
                        <img
                          src={resolvedLogo as string}
                          alt="asset icon"
                          className="mt-1 h-10 w-10 rounded-full border border-border/40 object-cover"
                        />
                      )}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-2xl font-bold leading-tight">{symbol}</CardTitle>
                          <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary">
                            {signals.length} {signals.length === 1 ? "entry" : "entries"}
                  </Badge>
                          <Badge className={cn("flex items-center gap-1", latest.type === "BUY" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-200") }>
                            {latest.type === "BUY" ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                            {latest.type}
                  </Badge>
                          <Badge className={cn("flex items-center gap-1", latestPerformance.badgeClass)}>
                            {latestPerformance.badgeLabel}
                          </Badge>
                          {isNewSignal(latest.postedAt) && <Badge variant="default">New</Badge>}
                          {stats && stats.total > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                              <Sparkles className="h-3 w-3" /> Win Rate {stats.winRate.toFixed(1)}%
                            </span>
                          )}
                </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full border border-border/40 px-2 py-0.5 uppercase tracking-wide">{latest.assetLabel}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" /> {relativeTime(latest.postedAt)}
                          </span>
                          {latest.score != null && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                              <Sparkles className="h-3.5 w-3.5" /> Score {latest.score}
                            </span>
                          )}
                        </div>
                        {latestTimeframes.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {latestTimeframes.map(([tf, value]) => (
                              <span key={`${symbol}-tf-${tf}`} className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-[11px] font-medium", recommendationTone(value))}>
                                <span className="font-semibold">{tf.toUpperCase()}</span>
                                <span>{value}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {latest.signalStrength && (
                        <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide", strengthTone(latest.signalStrength))}>
                          {latest.signalStrength}
                        </span>
                      )}
                      {latest.confidence && <span className="text-xs text-muted-foreground">Confidence {latest.confidence}</span>}
                      <span className="max-w-xs text-right text-xs text-muted-foreground">{latestPerformance.headline}</span>
                  <Button
                        variant="outline"
                    size="sm"
                        onClick={() => {
                          setSelectedSignal(latest);
                          setIsInspectorOpen(true);
                        }}
                      >
                        Inspect latest
                  </Button>
                    </div>
                  </div>
                  {latest.summary && <p className="text-sm leading-relaxed text-muted-foreground">{latest.summary}</p>}
                </CardHeader>
                <CardContent className="relative z-10 space-y-5">
                  <div className="space-y-3">
                    {signals.map((signal, idx) => {
                      const isLatest = idx === 0;
                      const entryTimeframes = Object.entries(signal.timeframes).sort((a, b) => {
                        const ai = timeframePriority.indexOf(a[0]);
                        const bi = timeframePriority.indexOf(b[0]);
                        if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
                        if (ai === -1) return 1;
                        if (bi === -1) return -1;
                        return ai - bi;
                      }).slice(0, 4);
                      const perfInfo = getPerformanceInfo(signal);
                      return (
                        <div
                          key={`${symbol}-timeline-${signal.id}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelectedSignal(signal);
                            setIsInspectorOpen(true);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              setSelectedSignal(signal);
                              setIsInspectorOpen(true);
                            }
                          }}
                          className={cn(
                            "cursor-pointer rounded-xl border border-border/40 bg-background/60 p-4 transition-all hover:border-primary/40 hover:shadow-lg",
                            isLatest ? "ring-1 ring-primary/30 bg-primary/5" : ""
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wide", isLatest ? "border-primary/50 bg-primary/10 text-primary" : "border-border/40 text-muted-foreground") }>
                                {isLatest ? "Latest" : `Prior #${idx + 1}`}
                              </Badge>
                              <span className={cn("text-sm font-semibold", signal.type === "BUY" ? "text-emerald-300" : "text-red-300")}>{signal.type}</span>
                              <span className="text-xs text-muted-foreground">{relativeTime(signal.postedAt)}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                              <span className="font-semibold text-foreground">{signal.price}</span>
                              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", perfInfo.badgeClass)}>{perfInfo.badgeLabel}</span>
                            </div>
                          </div>
                          {signal.summary && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{signal.summary}</p>}
                          <div className="mt-2 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">{perfInfo.headline}</span>
                            {perfInfo.subline && <span className="ml-2 text-muted-foreground/80">{perfInfo.subline}</span>}
                          </div>
                          {perfInfo.metrics.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground/90">
                              {perfInfo.metrics.map((metric, metricIdx) => (
                                <span key={`${signal.id}-metric-${metricIdx}`} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5", metric.tone === 'positive' ? "border-emerald-400/30 text-emerald-200 bg-emerald-500/10" : metric.tone === 'negative' ? "border-red-400/30 text-red-200 bg-red-500/10" : "border-border/30 bg-background/60") }>
                                  <span className="uppercase tracking-wide text-[10px] text-muted-foreground/70">{metric.label}</span>
                                  <span className="font-semibold">{metric.value}</span>
                                </span>
                              ))}
                            </div>
                          )}
                          {entryTimeframes.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {entryTimeframes.map(([tf, value]) => (
                                <span key={`${signal.id}-tf-${tf}-group`} className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-[11px] font-medium", recommendationTone(value))}>
                                  <span className="font-semibold">{tf.toUpperCase()}</span>
                                  <span>{value}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Target className="h-3.5 w-3.5" /> {latestPerformance.badgeLabel}
                      </span>
                      {latestPerformance.metrics.length > 0 && latestPerformance.metrics[0] && (
                        <span className="inline-flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5" /> {latestPerformance.metrics[0].label} {latestPerformance.metrics[0].value}
                        </span>
                      )}
                      {latest.stop?.pct != null && (
                        <span className="inline-flex items-center gap-1">
                          <Shield className="h-3.5 w-3.5" /> Risk {latest.stop.pct >= 0 ? "+" : ""}{latest.stop.pct.toFixed(Math.abs(latest.stop.pct) >= 1 ? 2 : 3)}%
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                        onClick={(e) => addToWatchlist(latest, e)}
                        disabled={watchlistSet.has(latest.rawSymbol)}
                      >
                        <BookmarkPlus className="mr-2 h-4 w-4" />
                        {watchlistSet.has(latest.rawSymbol) ? "Watchlisted" : "Add to Watchlist"}
                  </Button>
                      <Button variant="outline" size="sm" onClick={(e) => prefFillAlert(latest, e)}>
                        <Bell className="mr-2 h-4 w-4" /> Set Alert
                      </Button>
                      <Button size="sm" onClick={(e) => viewChart(latest, e)}>
                        <LineChart className="mr-2 h-4 w-4" /> View Chart
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="sm" onClick={(e) => requestDeleteSignal(latest, e)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </Button>
                      )}
                </div>
              </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredSignals.map((signal) => {
            const resolvedLogo = getSignalLogo(signal);
            const timeframeEntries = Object.entries(signal.timeframes).sort((a, b) => {
              const ai = timeframePriority.indexOf(a[0]);
              const bi = timeframePriority.indexOf(b[0]);
              if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
              if (ai === -1) return 1;
              if (bi === -1) return -1;
              return ai - bi;
            });
            const perfInfo = getPerformanceInfo(signal);
            const symbolStatsEntry = symbolPerformance.get(baseSym(signal.rawSymbol || signal.symbol));
            return (
              <Card
                key={signal.id}
                className="relative group overflow-hidden border border-border/60 bg-gradient-to-br from-background/90 via-background/75 to-background/60 shadow-xl transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-35px_hsl(var(--primary)/0.45)] hover:border-primary/40"
                onClick={() => {
                  setSelectedSignal(signal);
                  setIsInspectorOpen(true);
                }}
              >
                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-br from-primary/15 via-primary/0 to-transparent" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <CardHeader className="relative z-10 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex flex-1 items-start gap-3">
                      {resolvedLogo && (
                        <img
                          src={resolvedLogo as string}
                          alt="asset icon"
                          className="mt-1 h-10 w-10 rounded-full border border-border/40 object-cover"
                        />
                      )}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-2xl font-bold leading-tight transition-colors duration-500 group-hover:text-primary">{signal.symbol}</CardTitle>
                          {signal.type === "BUY" ? (
                            <Badge className="flex items-center gap-1 bg-emerald-500/15 text-emerald-300 transition-transform duration-300 group-hover:scale-105 group-hover:bg-emerald-500/20">
                              <TrendingUp className="h-3.5 w-3.5" /> BUY
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="flex items-center gap-1 bg-red-500/15 text-red-200 transition-transform duration-300 group-hover:scale-105 group-hover:bg-red-500/20">
                              <TrendingDown className="h-3.5 w-3.5" /> SELL
                            </Badge>
                          )}
                          <Badge className={cn("flex items-center gap-1", perfInfo.badgeClass)}>
                            {perfInfo.badgeLabel}
                          </Badge>
                          {isNewSignal(signal.postedAt) && (
                            <Badge variant="default">New</Badge>
                          )}
                          {symbolStatsEntry && symbolStatsEntry.total > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                              <Sparkles className="h-3 w-3" /> Win Rate {symbolStatsEntry.winRate.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full border border-border/40 px-2 py-0.5 uppercase tracking-wide">
                            {signal.assetLabel}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {relativeTime(signal.postedAt)}
                          </span>
                          {signal.score != null && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                              <Sparkles className="h-3.5 w-3.5" /> Score {signal.score}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                      {signal.signalStrength && (
                        <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide", strengthTone(signal.signalStrength))}>
                          {signal.signalStrength}
                        </span>
                      )}
                      {signal.confidence && (
                        <span className="text-xs text-muted-foreground">Confidence {signal.confidence}</span>
                      )}
                      <span className="text-xs text-muted-foreground max-w-xs text-right">{perfInfo.headline}</span>
                    </div>
                  </div>
                  {signal.summary && (
                    <p className="text-sm leading-relaxed text-muted-foreground transition-colors duration-500 group-hover:text-foreground/80">{signal.summary}</p>
                  )}
            </CardHeader>
                <CardContent className="relative z-10 space-y-5">
              <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-xl border border-border/50 bg-background/60 p-4">
                      <p className="text-xs text-muted-foreground">Current Price</p>
                      <p className="mt-1 text-xl font-semibold">{signal.price}</p>
                </div>
                    <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-4">
                      <p className="text-xs text-emerald-200">Entry Zone</p>
                      <p className="mt-1 text-xl font-semibold text-emerald-200">{signal.entryRange || "—"}</p>
                </div>
                    <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
                      <p className="text-xs text-primary">Primary Target</p>
                      <p className="mt-1 text-xl font-semibold text-primary">{signal.target || "—"}</p>
                </div>
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                      <p className="text-xs text-destructive">Stop Loss</p>
                      <p className="mt-1 text-xl font-semibold text-destructive">{signal.stopLoss || "—"}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/40 bg-background/60 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", perfInfo.badgeClass)}>
                        {perfInfo.badgeLabel}
                      </span>
                      {symbolStatsEntry && symbolStatsEntry.total > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                          <Sparkles className="h-3 w-3" /> Win Rate {symbolStatsEntry.winRate.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">{perfInfo.headline}</p>
                    {perfInfo.subline && (
                      <p className="text-xs text-muted-foreground/80">{perfInfo.subline}</p>
                    )}
                    {perfInfo.metrics.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground/90">
                        {perfInfo.metrics.map((metric, idxMetric) => (
                          <span
                            key={`${signal.id}-perfmetric-${idxMetric}`}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
                              metric.tone === 'positive'
                                ? "border-emerald-400/30 text-emerald-200 bg-emerald-500/10"
                                : metric.tone === 'negative'
                                ? "border-red-400/30 text-red-200 bg-red-500/10"
                                : "border-border/30 bg-background/50"
                            )}
                          >
                            <span className="uppercase tracking-wide text-[10px] text-muted-foreground/70">{metric.label}</span>
                            <span className="font-semibold text-foreground/80">{metric.value}</span>
                          </span>
                        ))}
                </div>
                    )}
              </div>

                  {signal.targets.length > 0 && (
                    <div className="rounded-xl border border-border/40 bg-background/50 p-4">
                      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Target Ladder</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {signal.targets.map((target, idx) => (
                          <div key={`${signal.id}-target-${idx}`} className="rounded-lg border border-border/30 bg-background/60 px-3 py-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{target.label}</span>
                              {target.pct != null && (
                                <span className={target.pct >= 0 ? "text-emerald-300" : "text-destructive"}>
                                  {target.pct >= 0 ? "+" : ""}{target.pct.toFixed(Math.abs(target.pct) >= 1 ? 2 : 3)}%
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-semibold">{target.price != null ? `$${target.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : "—"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {timeframeEntries.length > 0 && (
                    <div className="rounded-xl border border-border/40 bg-background/50 p-4">
                      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Timeframe Momentum</h4>
                      <div className="flex flex-wrap gap-2">
                        {timeframeEntries.map(([tf, value]) => (
                          <span
                            key={`${signal.id}-${tf}`}
                            className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium", recommendationTone(value))}
                          >
                            <span className="font-semibold">{tf.toUpperCase()}</span>
                            <span>{value}</span>
                          </span>
                        ))}
                </div>
              </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Target className="h-3.5 w-3.5" />
                        {signal.status.charAt(0).toUpperCase() + signal.status.slice(1)}
                      </span>
                      {signal.stop?.pct != null && (
                        <span className="inline-flex items-center gap-1">
                          <Shield className="h-3.5 w-3.5" /> Risk {signal.stop.pct >= 0 ? "+" : ""}{signal.stop.pct.toFixed(Math.abs(signal.stop.pct) >= 1 ? 2 : 3)}%
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                        onClick={(e) => addToWatchlist(signal, e)}
                        disabled={watchlistSet.has(signal.rawSymbol)}
                      >
                        <BookmarkPlus className="mr-2 h-4 w-4" />
                        {watchlistSet.has(signal.rawSymbol) ? "Watchlisted" : "Add to Watchlist"}
                  </Button>
                      <Button variant="outline" size="sm" onClick={(e) => prefFillAlert(signal, e)}>
                        <Bell className="mr-2 h-4 w-4" /> Set Alert
                  </Button>
                      <Button size="sm" onClick={(e) => viewChart(signal, e)}>
                        <LineChart className="mr-2 h-4 w-4" /> View Chart
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="sm" onClick={(e) => requestDeleteSignal(signal, e)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </Button>
                      )}
                </div>
              </div>
            </CardContent>
          </Card>
            );
          })}
      </div>
      )}

      <Sheet open={isInspectorOpen} onOpenChange={setIsInspectorOpen}>
        <SheetContent side="right" className="w-full max-w-xl overflow-y-auto border-l border-border/40 bg-background/95">
          <SheetHeader>
            <SheetTitle>Signal Breakdown</SheetTitle>
          </SheetHeader>
          {!selectedSignal ? (
            <div className="mt-6 space-y-3">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            (() => {
              const selectedPerfInfo = getPerformanceInfo(selectedSignal);
              const selectedStatsEntry = symbolPerformance.get(baseSym(selectedSignal.rawSymbol || selectedSignal.symbol));
              return (
            <div className="mt-6 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {(() => {
                    const metaLogo = selectedSignal.details && typeof selectedSignal.details === "object" && (selectedSignal.details as any).symbol_meta && typeof (selectedSignal.details as any).symbol_meta.logo === "string"
                      ? (selectedSignal.details as any).symbol_meta.logo
                      : null;
                    const logo = selectedSignal.logoUrl || metaLogo || logoBy[baseSym(selectedSignal.rawSymbol)];
                    return logo ? (
                      <img src={logo as string} alt="asset icon" className="h-10 w-10 rounded-full border border-border/40 object-cover" />
                    ) : null;
                  })()}
                  <h3 className="text-2xl font-semibold">{selectedSignal.symbol}</h3>
                  <p className="text-sm text-muted-foreground">{relativeTime(selectedSignal.postedAt)}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant={selectedSignal.type === "BUY" ? "default" : "destructive"}>{selectedSignal.type}</Badge>
                  <Badge variant="outline">{selectedSignal.status}</Badge>
                </div>
              </div>

              <div className="rounded-lg border border-border/40 bg-background/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", selectedPerfInfo.badgeClass)}>
                    {selectedPerfInfo.badgeLabel}
                  </span>
                  {selectedStatsEntry && selectedStatsEntry.total > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                      <Sparkles className="h-3 w-3" /> Win Rate {selectedStatsEntry.winRate.toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">{selectedPerfInfo.headline}</p>
                {selectedPerfInfo.subline && <p className="text-xs text-muted-foreground/80">{selectedPerfInfo.subline}</p>}
                {selectedPerfInfo.metrics.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground/90">
                    {selectedPerfInfo.metrics.map((metric, idxMetric) => (
                      <span
                        key={`selected-metric-${idxMetric}`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
                          metric.tone === 'positive'
                            ? "border-emerald-400/30 text-emerald-200 bg-emerald-500/10"
                            : metric.tone === 'negative'
                            ? "border-red-400/30 text-red-200 bg-red-500/10"
                            : "border-border/30 bg-background/50"
                        )}
                      >
                        <span className="uppercase tracking-wide text-[10px] text-muted-foreground/70">{metric.label}</span>
                        <span className="font-semibold text-foreground/80">{metric.value}</span>
                      </span>
                    ))}
                </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border/40 bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">Current Price</p>
                  <p className="mt-1 text-lg font-semibold">{selectedSignal.price}</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">Entry Zone</p>
                  <p className="mt-1 text-lg font-semibold">{selectedSignal.entryRange || "—"}</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">Stop Loss</p>
                  <p className="mt-1 text-lg font-semibold text-destructive">{selectedSignal.stopLoss || "—"}</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">Primary Target</p>
                  <p className="mt-1 text-lg font-semibold text-primary">{selectedSignal.target || "—"}</p>
                </div>
              </div>

              {selectedSignal.targets.length > 0 && (
              <div>
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Targets</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedSignal.targets.map((target, idx) => (
                      <div key={idx} className="rounded-lg border border-border/40 bg-background/60 px-3 py-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{target.label}</span>
                          {target.pct != null && (
                            <span className={target.pct >= 0 ? "text-emerald-300" : "text-destructive"}>
                              {target.pct >= 0 ? "+" : ""}{target.pct.toFixed(Math.abs(target.pct) >= 1 ? 2 : 3)}%
                            </span>
                          )}
              </div>
                        <p className="text-sm font-semibold">{target.price != null ? `$${target.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : "—"}</p>
                      </div>
                    ))}
              </div>
            </div>
          )}

              {Object.keys(selectedSignal.timeframes).length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Timeframes</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedSignal.timeframes).map(([tf, value]) => (
                      <span key={tf} className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium", recommendationTone(value))}>
                        <span className="font-semibold">{tf.toUpperCase()}</span>
                        <span>{value}</span>
                      </span>
                    ))}
                </div>
              </div>
              )}

              {selectedSignal.description && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Narrative</h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">{selectedSignal.description}</p>
              </div>
              )}
            </div>
              );
            })()
          )}
        </SheetContent>
      </Sheet>

      {isAdmin && (
        <Card id="admin-create-signal" className="border-border/60 bg-background/60">
          <CardHeader>
            <CardTitle className="text-lg">Create Signal</CardTitle>
            <CardDescription>Quickly seed a manual signal for testing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Symbol</p>
                <Input value={nsymbol} onChange={(e) => setNsymbol(e.target.value.toUpperCase())} placeholder="AAPL" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <Select value={ntype} onValueChange={(v: "BUY" | "SELL") => setNtype(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">BUY</SelectItem>
                    <SelectItem value="SELL">SELL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Asset Type</p>
                <Select value={nAssetType} onValueChange={(v:any)=>setNAssetType(v)}>
                  <SelectTrigger><SelectValue placeholder="Asset" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crypto">Crypto</SelectItem>
                    <SelectItem value="equity">Equity</SelectItem>
                    <SelectItem value="forex">Forex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Strength</p>
                <Input value={nStrength} onChange={(e)=>setNStrength(e.target.value)} placeholder="🟢 STRONG BUY / 🟡 BUY / 🔴 SELL" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Price</p>
                <Input value={nprice} onChange={(e) => setNprice(e.target.value)} placeholder="152.45" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <Input value={ndesc} onChange={(e) => setNdesc(e.target.value)} placeholder="Breakout setup" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Entry Low</p>
                <Input value={nEntryLow} onChange={(e)=>setNEntryLow(e.target.value)} placeholder="68000" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Entry High</p>
                <Input value={nEntryHigh} onChange={(e)=>setNEntryHigh(e.target.value)} placeholder="68500" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Target 1 Price</p>
                <Input value={nTarget1Price} onChange={(e)=>setNTarget1Price(e.target.value)} placeholder="71000" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Target 1 %</p>
                <Input value={nTarget1Pct} onChange={(e)=>setNTarget1Pct(e.target.value)} placeholder="4.0" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Target 2 Price</p>
                <Input value={nTarget2Price} onChange={(e)=>setNTarget2Price(e.target.value)} placeholder="75000" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Target 2 %</p>
                <Input value={nTarget2Pct} onChange={(e)=>setNTarget2Pct(e.target.value)} placeholder="9.9" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Stop Price</p>
                <Input value={nStopPrice} onChange={(e)=>setNStopPrice(e.target.value)} placeholder="66500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stop %</p>
                <Input value={nStopPct} onChange={(e)=>setNStopPct(e.target.value)} placeholder="-2.6" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Confidence</p>
                <Input value={nConfidence} onChange={(e)=>setNConfidence(e.target.value)} placeholder="High / Medium / Low" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Score</p>
                <Input value={nScore} onChange={(e)=>setNScore(e.target.value)} placeholder="8" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Chart URL</p>
                <Input value={nChartUrl} onChange={(e)=>setNChartUrl(e.target.value)} placeholder="https://www.tradingview.com/symbols/BTCUSD/" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Timeframes (1h / 4h / 1d)</p>
                <div className="grid grid-cols-3 gap-2">
                  <Input value={nTF1h} onChange={(e)=>setNTF1h(e.target.value)} placeholder="BUY" />
                  <Input value={nTF4h} onChange={(e)=>setNTF4h(e.target.value)} placeholder="BUY" />
                  <Input value={nTF1d} onChange={(e)=>setNTF1d(e.target.value)} placeholder="NEUTRAL" />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={createSignal} disabled={!nsymbol.trim()}>Create</Button>
              <Button variant="outline" className="flex-1" onClick={() => { setNsymbol(""); setNprice(""); setNdesc(""); }}>Reset</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={pendingDelete != null} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete signal?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `Removing ${pendingDelete.symbol} will clear it from the Signals feed and watchlist helpers.` : "Removing the selected signal will clear it from the Signals feed and watchlist helpers."}
              <br />This action can be reversed by generating the signal again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSignal}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Signals;

