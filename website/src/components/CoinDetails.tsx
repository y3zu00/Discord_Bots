import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Sparkline from "@/components/ui/sparkline";

type Props = { symbol: string | null; open: boolean; onOpenChange: (v:boolean)=>void };

const CoinDetails: React.FC<Props> = ({ symbol, open, onOpenChange }) => {
  const [coin, setCoin] = React.useState<any>(null);
  const [news, setNews] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const sym = symbol ? String(symbol).toUpperCase() : null;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sym) { 
        setCoin(null); 
        setNews([]); 
        setError(null);
        setLoading(false);
        return; 
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/coin?symbol=${encodeURIComponent(sym)}`, { credentials: 'include' });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          if (res.status === 429) {
            throw new Error('Rate limit reached. Please wait a moment and try again.');
          }
          throw new Error(errorData.error || 'Failed to load coin data');
        }
        const data = await res.json();
        if (!cancelled) setCoin(data);
      } catch (err) { 
        if (!cancelled) {
          setCoin(null);
          setError(err instanceof Error ? err.message : 'Failed to load coin data');
        }
      }
      try {
        const rn = await fetch(`/api/news?symbol=${encodeURIComponent(sym)}`, { credentials: 'include' });
        if (rn.ok) {
          const dn = await rn.json();
          let items = Array.isArray(dn?.items) ? dn.items : [];
          // Fallback to general trending news if symbol-specific is empty
          if ((!items || items.length === 0)) {
            try {
              const r2 = await fetch(`/api/news`, { credentials: 'include' });
              if (r2.ok) {
                const d2 = await r2.json();
                items = Array.isArray(d2?.items) ? d2.items : [];
              }
            } catch {}
          }
          if (!cancelled) setNews(items.slice(0, 6));
        }
      } catch { if (!cancelled) setNews([]); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sym]);

  const askMentor = () => {
    if (!sym) return;
    const prompt = `Give an in-depth but concise summary for ${sym}: trend, catalysts, risks, and a quick technical snapshot.`;
    try { localStorage.setItem('joat:mentor:prefill', JSON.stringify(prompt)); } catch {}
    try { localStorage.setItem('joat:mentor:autorun', '1'); } catch {}
    onOpenChange(false);
    // navigate to mentor
    try { window.location.href = '/dashboard/mentor'; } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-auto sm:max-w-2xl max-h-[85vh] overflow-y-auto border border-border/60 bg-background/95 backdrop-blur-sm shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Coin Details</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 min-h-[200px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <div className="text-sm text-muted-foreground">Loading coin data...</div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4 min-h-[200px]">
            <div className="text-destructive text-center">
              <div className="font-semibold mb-1">Failed to load</div>
              <div className="text-sm text-muted-foreground">{error}</div>
            </div>
            <Button onClick={() => {
              if (sym) {
                setLoading(true);
                setError(null);
                window.location.reload();
              }
            }} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        ) : !coin ? (
          <div className="text-sm text-muted-foreground py-12 text-center min-h-[200px]">No data available</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {coin.image && <img src={coin.image} alt="" className="h-10 w-10 rounded-full ring-1 ring-border object-cover" />}
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">
                  {coin.name} <span className="text-muted-foreground">{coin.symbol}</span>
                </div>
                {coin.market_data?.current_price != null && (
                  <div className="text-sm tabular-nums">Price: ${coin.market_data.current_price.toLocaleString()}</div>
                )}
              </div>
              <div className="ml-auto">
                <Button onClick={askMentor} className="shadow-md hover:shadow-primary/20">Ask Mentor about {coin.symbol}</Button>
              </div>
            </div>

            {Array.isArray(coin?.market_data?.sparkline_7d?.price) && coin.market_data.sparkline_7d.price.length > 0 && (
              <Card className="border-border/70 bg-card/70">
                <CardContent className="py-3">
                  <div className="w-full">
                    <Sparkline
                      values={coin.market_data.sparkline_7d.price.slice(-96)}
                      width={560}
                      height={40}
                      stroke={((coin.market_data.sparkline_7d.price.slice(-2)[1] || 1) >= (coin.market_data.sparkline_7d.price[0] || 1)) ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                      strokeWidth={2}
                      fill="transparent"
                      responsive
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {coin.description && (
              <Card className="border-border/70 bg-card/70">
                <CardContent className="py-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap break-words rounded-lg">
                  {String(coin.description).slice(0, 800)}
                </CardContent>
              </Card>
            )}

            <div>
              <div className="text-sm font-medium mb-2">Latest News</div>
              <div className="grid gap-2">
                {news.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No recent articles.</div>
                ) : news.map((n, i) => (
                  <a
                    key={i}
                    className="text-sm border border-border/60 rounded-lg p-3 bg-background/60 hover:bg-foreground/5 transition-all duration-200 hover:-translate-y-0.5"
                    href={n.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div className="font-medium line-clamp-2">{n.title}</div>
                    <div className="text-[11px] text-muted-foreground">{n.source} • {n.time_published ? new Date(n.time_published).toLocaleString() : ''}</div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CoinDetails;


