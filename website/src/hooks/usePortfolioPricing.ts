import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type PortfolioPositionInput = {
  id: number;
  symbol: string;
  quantity: number | null;
  costBasis: number | null;
  targetPrice: number | null;
  risk: string | null;
  timeframe: string | null;
  notes: string | null;
  confidence: number | null;
  strategy: string | null;
  created_at?: string;
};

export type EnrichedPortfolioPosition = PortfolioPositionInput & {
  baseSymbol: string;
  currentPrice: number | null;
  priceChangePct: number | null;
  currentValue: number | null;
  investedValue: number | null;
  plValue: number | null;
  plPercent: number | null;
};

export type PortfolioTotals = {
  invested: number;
  current: number;
  plValue: number;
  plPercent: number | null;
};

type FetchState = Record<string, {
  current_price?: number | null;
  price_change_percentage_24h?: number | null;
}>;

const getBaseSymbol = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const cut = String(raw).toUpperCase().split(/[\/:\-\s]/)[0];
  if (/(USDT|USD)$/.test(cut) && cut.length > 4) {
    const base = cut.replace(/(USDT|USD)$/,'');
    return base || cut;
  }
  return cut;
};

export function usePortfolioPricing(positions: PortfolioPositionInput[]): {
  positions: EnrichedPortfolioPosition[];
  totals: PortfolioTotals;
  loading: boolean;
} {
  const [priceMeta, setPriceMeta] = useState<FetchState>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const uniqueSymbols = Array.from(
      new Set(
        positions
          .map((p) => getBaseSymbol(p.symbol))
          .filter((s): s is string => Boolean(s))
      )
    );
    if (uniqueSymbols.length === 0) {
      setPriceMeta({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);

    (async () => {
      try {
        const qs = encodeURIComponent(uniqueSymbols.join(','));
        const res = await apiFetch(`/api/coins?symbols=${qs}`, { signal: controller.signal });
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        const map: FetchState = {};
        const list = Array.isArray(data?.items) ? data.items : [];
        for (const entry of list) {
          const sym = getBaseSymbol(entry?.symbol || entry?.data?.symbol);
          const md = entry?.data?.market_data;
          map[sym] = {
            current_price: typeof md?.current_price === 'number' ? md.current_price : (typeof md?.current_price?.usd === 'number' ? md.current_price.usd : null),
            price_change_percentage_24h: typeof md?.price_change_percentage_24h === 'number'
              ? md.price_change_percentage_24h
              : (typeof md?.price_change_percentage_24h?.usd === 'number' ? md.price_change_percentage_24h.usd : null),
          };
        }
        if (!cancelled) setPriceMeta(map);
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to fetch portfolio pricing', err);
          setPriceMeta({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [positions]);

  const enrichedPositions = useMemo<EnrichedPortfolioPosition[]>(() => {
    return positions.map((p) => {
      const baseSymbol = getBaseSymbol(p.symbol);
      const meta = priceMeta[baseSymbol];
      const quantity = typeof p.quantity === 'number' ? p.quantity : null;
      const costBasis = typeof p.costBasis === 'number' ? p.costBasis : null;
      const currentPrice = meta && typeof meta.current_price === 'number' ? meta.current_price : null;
      const investedValue = quantity != null && costBasis != null ? quantity * costBasis : null;
      const currentValue = quantity != null && currentPrice != null ? quantity * currentPrice : null;
      const plValue = currentValue != null && investedValue != null ? currentValue - investedValue : null;
      const plPercent = currentPrice != null && costBasis != null && costBasis !== 0
        ? ((currentPrice - costBasis) / costBasis) * 100
        : null;

      return {
        ...p,
        baseSymbol,
        currentPrice,
        priceChangePct: meta && typeof meta.price_change_percentage_24h === 'number' ? meta.price_change_percentage_24h : null,
        investedValue,
        currentValue,
        plValue,
        plPercent,
      };
    });
  }, [positions, priceMeta]);

  const totals = useMemo<PortfolioTotals>(() => {
    let invested = 0;
    let current = 0;
    for (const pos of enrichedPositions) {
      if (typeof pos.investedValue === 'number') invested += pos.investedValue;
      if (typeof pos.currentValue === 'number') current += pos.currentValue;
    }
    const plValue = current - invested;
    const plPercent = invested > 0 ? (plValue / invested) * 100 : null;
    return { invested, current, plValue, plPercent };
  }, [enrichedPositions]);

  return { positions: enrichedPositions, totals, loading };
}


