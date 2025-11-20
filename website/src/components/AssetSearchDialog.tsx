import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AssetSearchResult = {
  symbol: string;
  displaySymbol: string;
  name: string;
  assetType: "crypto" | "equity" | string;
  logo?: string | null;
  source?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: AssetSearchResult) => void;
  initialQuery?: string;
};

type FetchState = {
  loading: boolean;
  error: string | null;
};

const typeTone: Record<string, string> = {
  crypto: "bg-emerald-500/10 text-emerald-200 border border-emerald-400/30",
  equity: "bg-sky-500/10 text-sky-200 border border-sky-400/30",
  forex: "bg-purple-500/10 text-purple-200 border border-purple-400/30",
};

const AssetSearchDialog: React.FC<Props> = ({ open, onOpenChange, onSelect, initialQuery = "" }) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<AssetSearchResult[]>([]);
  const [{ loading, error }, setState] = useState<FetchState>({ loading: false, error: null });

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery(initialQuery);
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open) return;

    let active = true;
    const controller = new AbortController();
    const handler = setTimeout(async () => {
      setState({ loading: true, error: null });
      try {
        const endpoint = query?.trim()
          ? `/api/assets/search?q=${encodeURIComponent(query.trim())}`
          : `/api/assets/search`;
        const res = await fetch(endpoint, { credentials: "include", signal: controller.signal });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data?.error === "string" ? data.error : "Failed to search assets");
        }
        if (!active) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setResults(
          items
            .map((item) => ({
              symbol: String(item?.symbol || "").toUpperCase(),
              displaySymbol: String(item?.displaySymbol || item?.symbol || "").toUpperCase(),
              name: item?.name || item?.displaySymbol || item?.symbol || "Unknown",
              assetType: typeof item?.assetType === "string" ? item.assetType.toLowerCase() : "unknown",
              logo: item?.logo || null,
              source: item?.source || "unknown",
            }))
            .filter((asset) => asset.symbol)
        );
        setState({ loading: false, error: null });
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to search assets";
        setState({ loading: false, error: message });
      }
    }, 250);

    return () => {
      active = false;
      controller.abort();
      clearTimeout(handler);
    };
  }, [query, open]);

  const grouped = useMemo(() => {
    const map = new Map<string, AssetSearchResult[]>();
    for (const item of results) {
      const key = item.assetType || "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).map(([type, assets]) => ({ type, assets }));
  }, [results]);

  const handleSelect = (asset: AssetSearchResult) => {
    onSelect(asset);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Search assets</DialogTitle>
        </DialogHeader>
        <Command shouldFilter={false} className="px-2 pb-4">
          <CommandInput
            autoFocus
            placeholder="Search crypto, stocks, forex..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[360px]">
            {loading ? (
              <CommandEmpty className="py-6 text-sm text-muted-foreground">Searching…</CommandEmpty>
            ) : error ? (
              <CommandEmpty className="py-6 text-sm text-destructive">{error}</CommandEmpty>
            ) : results.length === 0 ? (
              <CommandEmpty className="py-6 text-sm text-muted-foreground">No matches found.</CommandEmpty>
            ) : (
              grouped.map(({ type, assets }) => (
                <CommandGroup key={type} heading={type === "crypto" ? "Crypto" : type === "equity" ? "Equities" : "Other"}>
                  {assets.map((asset) => {
                    const tone = typeTone[asset.assetType] || "bg-muted/30 text-muted-foreground/80 border border-border/30";
                    return (
                      <CommandItem
                        key={`${asset.assetType}:${asset.symbol}`}
                        value={`${asset.symbol} ${asset.name}`}
                        onSelect={() => handleSelect(asset)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2"
                      >
                        <Avatar className="h-8 w-8">
                          {asset.logo ? (
                            <AvatarImage src={asset.logo} alt={asset.displaySymbol} />
                          ) : (
                            <AvatarFallback>{asset.displaySymbol.slice(0, 3)}</AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex flex-1 flex-col">
                          <span className="text-sm font-semibold leading-none">{asset.displaySymbol || asset.symbol}</span>
                          <span className="text-xs text-muted-foreground">{asset.name}</span>
                        </div>
                        <Badge className={cn("ml-auto capitalize", tone)}>{asset.assetType || "asset"}</Badge>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};

export default AssetSearchDialog;

