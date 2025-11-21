import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Globe, Coins, Clock, Sparkles, BookOpen, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api";

type GeneralPreferences = {
  timezone: string;
  quoteCurrency: string;
  defaultTimeframe: string;
  portfolioNotifyPct: string;
};

const TIMEZONE_OPTIONS = [
  { label: "Auto (device)", value: "auto" },
  { label: "New York (ET)", value: "America/New_York" },
  { label: "Chicago (CT)", value: "America/Chicago" },
  { label: "Los Angeles (PT)", value: "America/Los_Angeles" },
  { label: "London (BST/GMT)", value: "Europe/London" },
  { label: "Paris (CET)", value: "Europe/Paris" },
  { label: "Dubai (GST)", value: "Asia/Dubai" },
  { label: "Singapore (SGT)", value: "Asia/Singapore" },
  { label: "Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Sydney (AEST)", value: "Australia/Sydney" },
];

const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "SGD", "CHF", "HKD"];

const TIMEFRAME_OPTIONS = ["15m", "30m", "1h", "4h", "1d", "1w"];

const SettingsPage: React.FC = () => {
  const deviceTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  const defaultPrefs = useMemo<GeneralPreferences>(() => ({
    timezone: deviceTimezone,
    quoteCurrency: "USD",
    defaultTimeframe: "1h",
    portfolioNotifyPct: "5",
  }), [deviceTimezone]);

  const [prefs, setPrefs] = useState<GeneralPreferences>(defaultPrefs);
  const [initialPrefs, setInitialPrefs] = useState<GeneralPreferences>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/preferences');
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        const general = (data?.preferences?.general || {}) as Partial<GeneralPreferences>;
        const merged = {
          timezone: general.timezone && general.timezone !== 'auto' ? general.timezone : deviceTimezone,
          quoteCurrency: general.quoteCurrency || defaultPrefs.quoteCurrency,
          defaultTimeframe: general.defaultTimeframe || defaultPrefs.defaultTimeframe,
          portfolioNotifyPct: String(general.portfolioNotifyPct || defaultPrefs.portfolioNotifyPct),
        } satisfies GeneralPreferences;
        if (!cancelled) {
          setPrefs(merged);
          setInitialPrefs(merged);
        }
      } catch {
        if (!cancelled) {
          setPrefs(defaultPrefs);
          setInitialPrefs(defaultPrefs);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [defaultPrefs, deviceTimezone]);

  const hasChanges = useMemo(() => (
    JSON.stringify(prefs) !== JSON.stringify(initialPrefs)
  ), [prefs, initialPrefs]);

  const effectiveTimezoneLabel = useMemo(() => {
    if (prefs.timezone !== 'auto') return prefs.timezone;
    const option = TIMEZONE_OPTIONS.find((opt) => opt.value === deviceTimezone);
    return option ? `${option.label.replace(' (device)', '')}` : deviceTimezone;
  }, [prefs.timezone, deviceTimezone]);

  const handleChange = (key: keyof GeneralPreferences, value: string) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetDefaults = () => {
    setPrefs(defaultPrefs);
  };

  const handleRevert = () => {
    setPrefs(initialPrefs);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        preferences: {
          general: {
            timezone: prefs.timezone === deviceTimezone ? deviceTimezone : prefs.timezone,
            quoteCurrency: prefs.quoteCurrency,
            defaultTimeframe: prefs.defaultTimeframe,
            portfolioNotifyPct: prefs.portfolioNotifyPct,
          }
        }
      };
      const res = await apiFetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('failed');
      setInitialPrefs(prefs);
      toast.success('Preferences saved');
    } catch (err) {
      console.error(err);
      toast.error('Could not save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 overflow-hidden">
        <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-1/3 right-1/3 h-24 w-24 rounded-full bg-primary/5 blur-2xl" />
      </div>
      <div className="relative space-y-8 max-w-full w-full">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-3xl font-bold tracking-tight">Personal Settings</h2>
            {hasChanges && (
              <Badge variant="outline" className="animate-[pulse_2s_ease-in-out_infinite] border-primary/40 bg-primary/10 text-primary">
                Unsaved changes
              </Badge>
            )}
        </div>
        <p className="text-muted-foreground">
          Tailor your dashboard experience. Preferences sync across web, mentor, and notifications.
        </p>
        </div>

      <div className="grid w-full gap-6 lg:grid-cols-[2fr,1fr] min-w-0">
        <Card className="group relative overflow-hidden border border-border/60 bg-card/70 backdrop-blur transition-all duration-300 hover:-translate-y-[4px] hover:border-primary/40 hover:shadow-[0_28px_60px_-40px_rgba(56,189,248,0.8)]">
          <div className="pointer-events-none absolute inset-0 opacity-50">
            <div className="absolute -top-10 left-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl transition-transform duration-500 group-hover:scale-110" />
            <div className="absolute bottom-0 right-0 h-28 w-28 rounded-full bg-emerald-500/10 blur-3xl transition-transform duration-500 group-hover:translate-y-[-10%]" />
          </div>
          <CardHeader className="relative">
            <CardTitle>General preferences</CardTitle>
            <CardDescription>Localization, currency, and chart defaults</CardDescription>
          </CardHeader>
          <CardContent className="relative space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Globe className="h-3.5 w-3.5 text-primary" /> Timezone
                </Label>
                <Select value={prefs.timezone === deviceTimezone ? 'auto' : prefs.timezone} onValueChange={(value) => handleChange('timezone', value === 'auto' ? deviceTimezone : value)}>
                  <SelectTrigger className="h-11 rounded-xl border border-border/60 bg-background/70 transition-all duration-200 hover:border-primary/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {TIMEZONE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  We detected <span className="font-medium text-foreground">{effectiveTimezoneLabel}</span> from your device.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Coins className="h-3.5 w-3.5 text-primary" /> Quote currency
                </Label>
                <Select value={prefs.quoteCurrency} onValueChange={(value) => handleChange('quoteCurrency', value)}>
                  <SelectTrigger className="h-11 rounded-xl border border-border/60 bg-background/70 transition-all duration-200 hover:border-primary/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Signals, alerts, and mentor responses will convert to this currency.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Default timeframe
                </Label>
                <Select value={prefs.defaultTimeframe} onValueChange={(value) => handleChange('defaultTimeframe', value)}>
                  <SelectTrigger className="h-11 rounded-xl border border-border/60 bg-background/70 transition-all duration-200 hover:border-primary/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Select timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEFRAME_OPTIONS.map((tf) => (
                      <SelectItem key={tf} value={tf}>
                        {tf.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Used when loading charts, mentor analysis, and default signal views.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Portfolio alerts
                </Label>
                <Select value={prefs.portfolioNotifyPct} onValueChange={(value) => handleChange('portfolioNotifyPct', value)}>
                  <SelectTrigger className="h-11 rounded-xl border border-border/60 bg-background/70 transition-all duration-200 hover:border-primary/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Select threshold" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Disable notifications</SelectItem>
                    {Array.from({ length: 15 }, (_, i) => i + 1).map((pct) => (
                      <SelectItem key={pct} value={String(pct)}>
                        {pct}% change
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Receive portfolio P/L notifications only when a position moves beyond this percentage. Set to <span className="font-medium text-foreground">Off</span> to mute portfolio alerts.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="text-xs transition-all duration-200 hover:text-primary"
                onClick={handleResetDefaults}
                disabled={!hasChanges && JSON.stringify(prefs) === JSON.stringify(defaultPrefs)}
              >
                Reset to defaults
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-xs transition-all duration-200 hover:text-primary"
                onClick={handleRevert}
                disabled={!hasChanges}
              >
                Revert changes
              </Button>
              <div className="flex-1" />
              <Button
                type="button"
                variant="default"
                className="relative overflow-hidden bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-[0_12px_30px_-20px_rgba(59,130,246,0.9)] transition-all duration-300 hover:shadow-[0_18px_40px_-18px_rgba(59,130,246,0.8)] disabled:from-muted disabled:to-muted"
                onClick={handleSave}
                disabled={!hasChanges || saving}
              >
                {saving ? (
                  <span className="flex items-center gap-2 text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</span>
                ) : (
                  'Save changes'
                )}
              </Button>
            </div>
          </CardContent>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
        </Card>

        <Card className="group border border-border/60 bg-card/70 backdrop-blur transition-all duration-300 hover:-translate-y-[3px] hover:border-primary/40 hover:shadow-[0_22px_50px_-36px_rgba(59,130,246,0.65)]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Live preview
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Instant</Badge>
            </CardTitle>
            <CardDescription className="text-xs">How these settings influence your experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border/50 bg-background/60 p-3 transition-all duration-300 group-hover:border-primary/40">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Timestamp format</div>
              <div className="text-foreground font-medium">
                {new Date().toLocaleString('en-US', { timeZone: prefs.timezone || deviceTimezone, hour12: false })}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Mentor, alerts, and signal history will align to this timezone.</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-background/60 p-3 transition-all duration-300 group-hover:border-primary/40">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Currency preview</div>
              <div className="flex items-baseline gap-2 text-foreground font-medium">
                <span className="text-2xl">{prefs.quoteCurrency}</span>
                <span>→ Example price: {(12345.67).toLocaleString(undefined, { style: 'currency', currency: prefs.quoteCurrency })}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Signals, watchlists, and mentor valuations auto-convert.</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-background/60 p-3 transition-all duration-300 group-hover:border-primary/40">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Default timeframe</div>
              <div className="text-foreground font-medium">{prefs.defaultTimeframe.toUpperCase()} charts</div>
              <p className="mt-1 text-[11px] text-muted-foreground">Used when opening Prices, Signals, and Mentor requests.</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-background/60 p-3 transition-all duration-300 group-hover:border-primary/40">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Portfolio notifications</div>
              <div className="text-foreground font-medium">
                {prefs.portfolioNotifyPct === 'off'
                  ? 'Notifications disabled'
                  : `Alert me at ${prefs.portfolioNotifyPct}% moves`}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Controls when portfolio P/L alerts are sent to Discord.</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4 min-w-0">
        <Card className="border border-border/40 bg-card/60 backdrop-blur transition-all duration-300 hover:shadow-lg hover:-translate-y-[2px]">
          <CardContent className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Session timezone</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{prefs.timezone === deviceTimezone ? 'Following device' : prefs.timezone}</div>
            <p className="mt-2 text-xs text-muted-foreground">Applies to signals, alerts, mentor replies, and notifications.</p>
          </CardContent>
        </Card>
        <Card className="border border-border/40 bg-card/60 backdrop-blur transition-all duration-300 hover:shadow-lg hover:-translate-y-[2px]">
          <CardContent className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Quote currency</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{prefs.quoteCurrency}</div>
            <p className="mt-2 text-xs text-muted-foreground">Portfolio, mentor, and signals display values in this currency.</p>
          </CardContent>
        </Card>
        <Card className="border border-border/40 bg-card/60 backdrop-blur transition-all duration-300 hover:shadow-lg hover:-translate-y-[2px]">
          <CardContent className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Chart timeframe</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{prefs.defaultTimeframe.toUpperCase()}</div>
            <p className="mt-2 text-xs text-muted-foreground">Used as the initial view in Prices, Signals, and Mentor analysis.</p>
          </CardContent>
        </Card>
        <Card className="border border-border/40 bg-card/60 backdrop-blur transition-all duration-300 hover:shadow-lg hover:-translate-y-[2px]">
          <CardContent className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Portfolio alerts</div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {prefs.portfolioNotifyPct === 'off' ? 'Disabled' : `${prefs.portfolioNotifyPct}% threshold`}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">You’ll receive Discord updates only when positions move beyond this level.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border/60 bg-card/70 backdrop-blur transition-all duration-300 hover:-translate-y-[3px] hover:border-primary/40 hover:shadow-[0_22px_50px_-36px_rgba(59,130,246,0.65)]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Documentation
          </CardTitle>
          <CardDescription className="text-xs">Access comprehensive platform documentation and guides</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full gap-2 border-primary/40 bg-primary/5 hover:bg-primary/10"
            onClick={() => window.open("/docs", "_blank", "noopener,noreferrer")}
          >
            <BookOpen className="h-4 w-4" />
            Open Documentation
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    </div>
    </div>
  );
};

export default SettingsPage;


