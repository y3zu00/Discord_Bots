import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUpRight } from "lucide-react";

const News: React.FC = () => {
  const [items, setItems] = React.useState<Array<any>>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState<any | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/news', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setItems(data?.items || []);
        } else {
          // Graceful: keep previous items, do not surface error
          if (!cancelled) setErr(null);
        }
      } catch {
        if (!cancelled) setErr(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Refresh every 90s without flicker: keep prior items and show a subtle top bar instead
  React.useEffect(() => {
    const id = setInterval(async () => {
      setRefreshing(true);
      try {
        const res = await fetch('/api/news', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setItems(data?.items || []);
        }
      } finally {
        setTimeout(() => setRefreshing(false), 400);
      }
    }, 90000);
    return () => clearInterval(id);
  }, []);

  const formatTime = (ts?: string) => {
    if (!ts) return "";
    // Alpha Vantage format: YYYYMMDDThhmmss
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Market News</h2>
          <p className="text-muted-foreground">Latest crypto headlines</p>
        </div>
      </div>

      {loading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-card/60 border-border">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-5/6" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {err && (
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="py-4 text-destructive text-sm">{err}</CardContent>
        </Card>
      )}

      {!loading && !err && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch content-start">
          {refreshing && (
            <div className="col-span-full -mb-2">
              <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary/20 to-transparent animate-pulse rounded" />
            </div>
          )}
          {items.map((n, i) => (
            <article key={i} className="relative group h-full">
              <Card
                role="button"
                tabIndex={0}
                onClick={() => { setActive(n); setOpen(true); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(n); setOpen(true); }}}
                className="cursor-pointer bg-card/60 border-border overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/20 h-full flex flex-col"
              >
                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="h-full w-full bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
                </div>
                <div className="h-1 w-full bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-2 border-b border-border/40">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={`text-[10px] ${String(n.source||'').toLowerCase().includes('benzinga') ? 'border-cyan-500/50 text-cyan-300' : String(n.source||'').toLowerCase().includes('motley') ? 'border-violet-500/50 text-violet-300' : ''}`}>
                      {(n.tickers?.[0] || 'NEWS')}
                    </Badge>
                    {formatTime(n.time_published) && (
                      <span className="text-[10px] text-muted-foreground">{formatTime(n.time_published)}</span>
                    )}
                  </div>
                  <CardTitle className="text-base leading-snug line-clamp-2">{n.title}</CardTitle>
                  <CardDescription className="text-xs">{n.source}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col pt-3 pb-4">
                  <p className="text-sm line-clamp-3 text-muted-foreground">
                    {(n.summary && String(n.summary).trim()) || 'No summary provided.'}
                  </p>
                  <div className="mt-3 flex items-center justify-between pt-3 border-t border-border/30 mt-auto">
                    <div className="text-[11px] text-muted-foreground">{n.source || 'Source'}</div>
                    {n.url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); window.open(n.url, '_blank'); }}
                      >
                        Read More
                        <ArrowUpRight className="ml-1 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </article>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {active?.title || 'Article'}
            </DialogTitle>
          </DialogHeader>
          {active ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {active.source && <span>{active.source}</span>}
                {formatTime(active.time_published) && <span>• {formatTime(active.time_published)}</span>}
              </div>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {(active.summary && String(active.summary).trim()) || 'No summary available.'}
              </p>
              {active.url && (
                <div className="pt-1">
                  <Button onClick={() => window.open(active.url, '_blank')}>
                    Read on source
                    <ArrowUpRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default News;


