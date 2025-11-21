import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Settings,
  Save,
  RefreshCw,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Target,
  PieChart,
  Activity,
  LifeBuoy,
  Sparkles
} from "lucide-react";
import { getSession, setSession, syncSessionFromServer } from "@/lib/session";
import PlanBadge from "@/components/PlanBadge";
import { toast } from "sonner";
import { usePortfolioPricing } from "@/hooks/usePortfolioPricing";
import FeedbackDialog from "@/components/FeedbackDialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

type PortfolioPosition = {
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

type TradingProfile = {
  skillLevel: "Beginner" | "Intermediate" | "Advanced" | "Pro";
  riskAppetite: "Conservative" | "Balanced" | "Aggressive";
  focus: "Crypto" | "Stocks" | "Both";
  tradingStyle: string;
  goals: string;
};

type PortfolioPreview = {
  count: number;
  totalInvested: number;
  currentValue: number;
  plValue: number;
  plPercent: number | null;
  activeTargets: number;
  topHoldings: Array<{
    symbol: string;
    quantity: number | null;
    costBasis: number | null;
    currentPrice: number | null;
    currentValue: number | null;
    plValue: number | null;
    plPercent: number | null;
  }>;
};

type HighlightAccent = "primary" | "success" | "destructive" | "muted" | "emerald";

type HighlightTile = {
  key: string;
  label: string;
  value: string;
  icon: React.ElementType;
  accent: HighlightAccent;
  hint: string;
  delta?: string | null;
};

type PlanKey = "Free" | "Core" | "Pro" | "Elite" | "Admin";

type PlanMeta = {
  description: string;
  allowances: {
    signalsPerDay: string;
    mentorChats: string;
    priceAlerts: string | number;
  };
  perks: string[];
};

const PLAN_META: Record<PlanKey, PlanMeta> = {
  Free: {
    description: "Discord community access and starter tools",
    allowances: {
      signalsPerDay: "Preview access in Discord",
      mentorChats: "Community discussion only",
      priceAlerts: 3,
    },
    perks: [
      "Discord community channels",
      "Market discussion & news feed",
      "Access to free PDFs and resources",
    ],
  },
  Core: {
    description: "AI signals, custom watchlists, and in-app alerts",
    allowances: {
      signalsPerDay: "Up to 5 AI signals per day",
      mentorChats: "Basic Mentor access",
      priceAlerts: 10,
    },
    perks: [
      "AI-powered daily signals",
      "Custom watchlists & price alerts",
      "Live market news feed",
      "Priority support",
    ],
  },
  Pro: {
    description: "Advanced mentorship and automation features",
    allowances: {
      signalsPerDay: "Up to 15 AI signals per day",
      mentorChats: "Unlimited AI Mentor conversations",
      priceAlerts: 25,
    },
    perks: [
      "Full AI Mentor (chat + deep analysis)",
      "Advanced education & Pine assistant",
      "Indicator library access",
      "Monthly giveaways (2 tickets)",
    ],
  },
  Elite: {
    description: "VIP mentorship and early access to every tool",
    allowances: {
      signalsPerDay: "Unlimited AI signals",
      mentorChats: "Priority Mentor + private channels",
      priceAlerts: "Unlimited",
    },
    perks: [
      "1-on-1 live mentorship",
      "VIP-only Discord channels",
      "Unlimited memecoin snipes",
      "Early access to features",
    ],
  },
  Admin: {
    description: "Administrative access with full feature unlock",
    allowances: {
      signalsPerDay: "Unlimited",
      mentorChats: "Unlimited",
      priceAlerts: "Unlimited",
    },
    perks: [
      "All platform features",
      "Admin tools and dashboards",
      "Bypass plan gating",
    ],
  },
};

const Account: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const session = getSession();
  const planKey = useMemo<PlanKey>(() => {
    if (session?.isAdmin) return "Admin";
    const plan = session?.plan || (session?.isSubscriber ? "Pro" : "Free");
    return (PLAN_META[plan as PlanKey] ? plan : "Free") as PlanKey;
  }, [session]);
  const planLabel = planKey;
  const planInfo = PLAN_META[planKey];
  const [isEditing, setIsEditing] = useState(false);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseText, setEraseText] = useState("");
  const [eraseLoading, setEraseLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: session?.username || "",
    notifications: {
      signals: true,
      alerts: true,
      weekly: false,
    },
    privacy: {
      profile: "public",
      activity: "private",
    }
  });

  const [trial, setTrial] = useState<{ active: boolean; endsAt: number | null; trialUsed?: boolean }|null>(null);
  const deviceTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  const [portfolioPositions, setPortfolioPositions] = useState<PortfolioPosition[]>([]);
  const [isPortfolioDialogOpen, setIsPortfolioDialogOpen] = useState(false);
  const [portfolioSaving, setPortfolioSaving] = useState(false);
  const [portfolioForm, setPortfolioForm] = useState({
    id: null as number | null,
    symbol: "",
    quantity: "",
    costBasis: "",
    targetPrice: "",
    risk: "",
    timeframe: "",
    notes: "",
    confidence: "",
    strategy: "",
  });
  const [portfolioNotifyMeta, setPortfolioNotifyMeta] = useState<{ timezone?: string; quoteCurrency?: string; defaultTimeframe?: string }>(() => ({
    timezone: deviceTimezone,
    quoteCurrency: "USD",
    defaultTimeframe: "1h",
  }));
  const [portfolioNotifyEnabled, setPortfolioNotifyEnabled] = useState(true);
  const [portfolioNotifySlider, setPortfolioNotifySlider] = useState(5);
  const [initialPortfolioNotifyEnabled, setInitialPortfolioNotifyEnabled] = useState(true);
  const [initialPortfolioNotifySlider, setInitialPortfolioNotifySlider] = useState(5);
  const [portfolioNotifySaving, setPortfolioNotifySaving] = useState(false);
  const { positions: pricedPositions, totals: portfolioTotals, loading: portfolioPricingLoading } = usePortfolioPricing(portfolioPositions);
  const [tradingProfile, setTradingProfile] = useState<TradingProfile | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState<TradingProfile>({
    skillLevel: "Intermediate",
    riskAppetite: "Balanced",
    focus: "Both",
    tradingStyle: "Swing trading",
    goals: "Grow account steadily",
  });
  const [alertsCount, setAlertsCount] = useState<number | null>(null);
  const [avatarRefreshing, setAvatarRefreshing] = useState(false);

  const allowancesDisplay = useMemo(() => {
    const priceLimit = planInfo.allowances.priceAlerts;
    const activeAlerts = alertsCount ?? 0;
    const priceText = alertsCount == null
      ? "Loading…"
      : typeof priceLimit === "number"
        ? `${activeAlerts} active / ${priceLimit} included`
        : `${activeAlerts} active • ${priceLimit}`;
    return [
      { label: "Signals per day", value: planInfo.allowances.signalsPerDay },
      { label: "AI Mentor chats", value: planInfo.allowances.mentorChats },
      { label: "Price alerts", value: priceText },
    ];
  }, [planInfo, alertsCount]);

  const planPerks = planInfo.perks;
  const isTrialActive = Boolean(trial?.active && trial?.endsAt);
  const trialEndText = isTrialActive && trial?.endsAt ? new Date(trial.endsAt).toLocaleDateString() : null;
  const planStatusLabel = session?.isAdmin ? "Admin" : isTrialActive ? "Trial" : planKey === "Free" ? "Free plan" : "Active";
  const planStatusVariant = session?.isAdmin ? "secondary" : planKey === "Free" ? "outline" : "secondary";

  const portfolioPreview = useMemo<PortfolioPreview | null>(() => {
    if (!pricedPositions.length) return null;
    const activeTargets = pricedPositions.filter((position) => position.targetPrice != null).length;
    const topHoldings = pricedPositions
      .slice()
      .sort((a, b) => ((b.currentValue ?? 0) - (a.currentValue ?? 0)))
      .slice(0, 4)
      .map((position) => ({
        symbol: position.symbol,
        quantity: position.quantity,
        costBasis: position.costBasis,
        currentPrice: position.currentPrice,
        currentValue: position.currentValue,
        plValue: position.plValue,
        plPercent: position.plPercent,
      }));
    return {
      count: pricedPositions.length,
      totalInvested: portfolioTotals.invested,
      currentValue: portfolioTotals.current,
      plValue: portfolioTotals.plValue,
      plPercent: portfolioTotals.plPercent,
      activeTargets,
      topHoldings,
    };
  }, [pricedPositions, portfolioTotals]);

  const formatCurrency = useCallback((value?: number | null) => {
    if (value == null || Number.isNaN(value)) return "—";
    return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  const formatPercent = useCallback((value?: number | null) => {
    if (value == null || Number.isNaN(value)) return "—";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  }, []);

  const quickHighlights = useMemo(() => {
    const holdingsCount = portfolioPreview?.count ?? 0;
    const totalValue = portfolioPreview ? formatCurrency(portfolioPreview.currentValue) : "—";
    const plValue = formatCurrency(portfolioTotals.plValue);
    const plTone = portfolioTotals.plValue > 0 ? "positive" : portfolioTotals.plValue < 0 ? "negative" : "neutral";
    const targetsActive = portfolioPreview?.activeTargets ?? 0;

    const items: HighlightTile[] = [
      {
        key: "holdings",
        label: "Holdings tracked",
        value: holdingsCount ? `${holdingsCount}` : "0",
        icon: PieChart,
        accent: "primary" as const,
        hint: holdingsCount ? `${totalValue} total value` : "Add positions to unlock portfolio insights",
      },
      {
        key: "upl",
        label: "Unrealized P/L",
        value: plValue,
        delta: portfolioTotals.plPercent != null ? formatPercent(portfolioTotals.plPercent) : null,
        icon: Activity,
        accent: plTone === "positive" ? "success" : plTone === "negative" ? "destructive" : "muted",
        hint: "Calculated in your preferred currency",
      },
      {
        key: "targets",
        label: "Targets active",
        value: targetsActive ? `${targetsActive}` : "0",
        icon: Target,
        accent: "emerald" as const,
        hint: targetsActive ? `${targetsActive} price targets tracking exits` : "Set targets to monitor exits automatically",
      },
    ];
    return items;
  }, [portfolioPreview, portfolioTotals, formatCurrency, formatPercent]);

  // Auto-open feedback dialog if navigated from onboarding
  useEffect(() => {
    const state = location.state as { openFeedback?: boolean } | null;
    if (state?.openFeedback) {
      setFeedbackOpen(true);
      // Clear state to prevent re-opening on refresh
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, navigate, location.pathname]);

  const resetPortfolioForm = useCallback(() => {
    setPortfolioForm({
      id: null,
      symbol: "",
      quantity: "",
      costBasis: "",
      targetPrice: "",
      risk: "",
      timeframe: "",
      notes: "",
      confidence: "",
      strategy: "",
    });
  }, []);

  const updatePortfolioField = useCallback((field: keyof typeof portfolioForm, value: string) => {
    setPortfolioForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const openPortfolioDialog = useCallback((position?: PortfolioPosition) => {
    if (position) {
      setPortfolioForm({
        id: position.id,
        symbol: position.symbol,
        quantity: position.quantity != null ? String(position.quantity) : "",
        costBasis: position.costBasis != null ? String(position.costBasis) : "",
        targetPrice: position.targetPrice != null ? String(position.targetPrice) : "",
        risk: position.risk || "",
        timeframe: position.timeframe || "",
        notes: position.notes || "",
        confidence: position.confidence != null ? String(position.confidence) : "",
        strategy: position.strategy || "",
      });
    } else {
      resetPortfolioForm();
    }
    setIsPortfolioDialogOpen(true);
  }, [resetPortfolioForm]);

  const loadPortfolio = useCallback(async () => {
    try {
      const res = await apiFetch('/api/portfolio');
      if (!res.ok) return;
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setPortfolioPositions(items.map((item: any) => ({
        id: item.id,
        symbol: item.symbol,
        quantity: item.quantity != null ? Number(item.quantity) : null,
        costBasis: item.cost_basis != null ? Number(item.cost_basis) : null,
        targetPrice: item.target_price != null ? Number(item.target_price) : null,
        risk: item.risk || null,
        timeframe: item.timeframe || null,
        notes: item.notes || null,
        confidence: item.confidence != null ? Number(item.confidence) : null,
        strategy: item.strategy || null,
        created_at: item.created_at,
      })));
    } catch {}
  }, []);

  const handlePortfolioSubmit = useCallback(async () => {
    if (!portfolioForm.symbol.trim()) {
      toast.error('Symbol is required');
      return;
    }
    const toNumberOrNull = (value: string) => {
      if (!value.trim()) return null;
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };
    const clampPercent = (value: number | null) => {
      if (value == null || Number.isNaN(value)) return null;
      return Math.min(100, Math.max(0, value));
    };

    const payload = {
      symbol: portfolioForm.symbol.trim().toUpperCase(),
      quantity: toNumberOrNull(portfolioForm.quantity),
      costBasis: toNumberOrNull(portfolioForm.costBasis),
      targetPrice: toNumberOrNull(portfolioForm.targetPrice),
      risk: portfolioForm.risk || null,
      timeframe: portfolioForm.timeframe || null,
      notes: portfolioForm.notes || null,
      confidence: clampPercent(toNumberOrNull(portfolioForm.confidence)),
      strategy: portfolioForm.strategy || null,
    };

    setPortfolioSaving(true);
    try {
      const method = portfolioForm.id ? 'PATCH' : 'POST';
      const url = portfolioForm.id ? `/api/portfolio/${portfolioForm.id}` : '/api/portfolio';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('failed');
      await loadPortfolio();
      toast.success(portfolioForm.id ? 'Position updated' : 'Position added');
      setIsPortfolioDialogOpen(false);
      resetPortfolioForm();
    } catch {
      toast.error('Could not save position');
    } finally {
      setPortfolioSaving(false);
    }
  }, [portfolioForm, loadPortfolio, resetPortfolioForm]);

  const handlePortfolioNotifySave = useCallback(async () => {
    setPortfolioNotifySaving(true);
    try {
      const payload = {
        preferences: {
          general: {
            timezone: portfolioNotifyMeta.timezone || deviceTimezone,
            quoteCurrency: portfolioNotifyMeta.quoteCurrency || 'USD',
            defaultTimeframe: portfolioNotifyMeta.defaultTimeframe || '1h',
            portfolioNotifyPct: portfolioNotifyEnabled ? portfolioNotifySlider : 'off',
          },
        },
      };
      const res = await apiFetch('/api/preferences', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('failed');
      setInitialPortfolioNotifyEnabled(portfolioNotifyEnabled);
      setInitialPortfolioNotifySlider(portfolioNotifySlider);
      toast.success('Portfolio alert threshold saved');
    } catch (err) {
      console.error(err);
      toast.error('Could not save threshold');
    } finally {
      setPortfolioNotifySaving(false);
    }
  }, [portfolioNotifyMeta, portfolioNotifyEnabled, portfolioNotifySlider]);

  const handlePortfolioDelete = useCallback(async (id: number) => {
    if (!window.confirm('Remove this position?')) return;
    try {
      const res = await apiFetch(`/api/portfolio/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
      await loadPortfolio();
      toast.success('Position removed');
    } catch {
      toast.error('Could not delete position');
    }
  }, [loadPortfolio]);

  const handleTradingProfileSave = useCallback(async () => {
    setProfileSaving(true);
    try {
      const res = await apiFetch('/api/profile/trading', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profileForm }),
      });
      if (!res.ok) throw new Error('failed');
      setTradingProfile(profileForm);
      toast.success('Trading profile updated');
      setProfileDialogOpen(false);
    } catch {
      toast.error('Could not save profile');
    } finally {
      setProfileSaving(false);
    }
  }, [profileForm]);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/alerts');
        if (!res.ok) {
          setAlertsCount(0);
          return;
        }
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        setAlertsCount(items.length);
      } catch {
        setAlertsCount(0);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/profile/trading');
        if (!res.ok) return;
        const data = await res.json();
        if (data?.profile) {
          setTradingProfile(data.profile);
          setProfileForm(data.profile);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/trial/status');
        if (res.ok) {
          const data = await res.json();
          setTrial({ active: !!data.active, endsAt: data.endsAt || null, trialUsed: !!data.trialUsed });
        }
      } catch {}
    })();
  }, []);

  // Load preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/preferences');
        if (!res.ok) return;
        const data = await res.json();
        const prefs = (data?.preferences || {}) as any;
        setFormData((prev) => ({
          ...prev,
          notifications: {
            signals: prefs.notifications?.signals ?? prev.notifications.signals,
            alerts: prefs.notifications?.alerts ?? prev.notifications.alerts,
            weekly: prefs.notifications?.weekly ?? prev.notifications.weekly,
          },
          privacy: {
            profile: prefs.privacy?.profile ?? prev.privacy.profile,
            activity: prefs.privacy?.activity ?? prev.privacy.activity,
          }
        }));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/preferences');
        if (!res.ok) return;
        const data = await res.json();
        const general = (data?.preferences?.general || {}) as Record<string, any>;
        setPortfolioNotifyMeta({
          timezone: typeof general.timezone === 'string' && general.timezone.length > 0 ? general.timezone : deviceTimezone,
          quoteCurrency: typeof general.quoteCurrency === 'string' && general.quoteCurrency.length > 0 ? general.quoteCurrency : 'USD',
          defaultTimeframe: typeof general.defaultTimeframe === 'string' && general.defaultTimeframe.length > 0 ? general.defaultTimeframe : '1h',
        });
        const raw = general.portfolioNotifyPct;
        if (typeof raw === 'string' && raw.toLowerCase() === 'off') {
          setPortfolioNotifyEnabled(false);
          setInitialPortfolioNotifyEnabled(false);
          setPortfolioNotifySlider(5);
          setInitialPortfolioNotifySlider(5);
        } else if (typeof raw === 'number' || (typeof raw === 'string' && !Number.isNaN(Number(raw)))) {
          const val = Math.min(15, Math.max(1, Number(raw)));
          setPortfolioNotifyEnabled(true);
          setInitialPortfolioNotifyEnabled(true);
          setPortfolioNotifySlider(val);
          setInitialPortfolioNotifySlider(val);
        } else {
          setPortfolioNotifyEnabled(true);
          setInitialPortfolioNotifyEnabled(true);
          setPortfolioNotifySlider(5);
          setInitialPortfolioNotifySlider(5);
        }
      } catch {
        // ignore
      }
    })();
  }, [deviceTimezone]);

  const handleSave = async () => {
    // Persist username on server so it survives reload and cookie hydration
    try {
      const res = await apiFetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: formData.username }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.session) {
          setSession(data.session);
        } else {
          const current = getSession();
          if (current) setSession({ ...current, username: formData.username });
        }
        toast.success('Profile updated');
      } else {
        // Fallback: update local session so UI reflects immediately
        const current = getSession();
        if (current) setSession({ ...current, username: formData.username });
        toast.success('Profile updated');
      }
    } catch {
      const current = getSession();
      if (current) setSession({ ...current, username: formData.username });
      toast.success('Profile updated');
    }
    setIsEditing(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const persistPreferences = useCallback(async (notifications: typeof formData.notifications, privacy = formData.privacy) => {
    try {
      await apiFetch('/api/preferences', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: { notifications, privacy } }),
      });
    } catch {}
  }, [formData.privacy]);

  const handleNotificationChange = (key: keyof typeof formData.notifications, value: boolean) => {
    setFormData(prev => {
      const nextNotifications = { ...prev.notifications, [key]: value };
      void persistPreferences(nextNotifications, prev.privacy);
      return {
        ...prev,
        notifications: nextNotifications,
      };
    });
  };

  const handleAvatarRefresh = useCallback(async () => {
    setAvatarRefreshing(true);
    try {
      const updated = await syncSessionFromServer();
      if (updated?.discordAvatarUrl || updated?.avatarUrl) {
        toast.success('Avatar refreshed from Discord');
      } else {
        toast.info('Avatar syncs automatically from your Discord profile.');
      }
    } catch {
      toast.error('Could not refresh avatar');
    } finally {
      setAvatarRefreshing(false);
    }
  }, []);

  const accentStyles: Record<HighlightAccent, { gradient: string; iconBg: string; iconColor: string; valueColor: string }> = {
    primary: { gradient: 'from-primary/15 via-primary/5 to-transparent', iconBg: 'bg-primary/15', iconColor: 'text-primary', valueColor: 'text-primary' },
    success: { gradient: 'from-emerald-500/15 via-emerald-500/5 to-transparent', iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-400', valueColor: 'text-emerald-400' },
    destructive: { gradient: 'from-rose-500/15 via-rose-500/5 to-transparent', iconBg: 'bg-rose-500/15', iconColor: 'text-rose-400', valueColor: 'text-rose-400' },
    muted: { gradient: 'from-border/30 via-border/10 to-transparent', iconBg: 'bg-muted/30', iconColor: 'text-muted-foreground', valueColor: 'text-foreground' },
    emerald: { gradient: 'from-emerald-500/15 via-emerald-500/5 to-transparent', iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-400', valueColor: 'text-emerald-400' },
  };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60">
        <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 right-12 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />
      </div>
      <div className="relative space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight">Account Settings</h2>
              <PlanBadge label={planLabel} />
            </div>
            <p className="text-muted-foreground">
              Manage your profile, preferences, and account settings
            </p>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-[0_12px_30px_-18px_rgba(59,130,246,0.7)] hover:shadow-[0_18px_40px_-16px_rgba(59,130,246,0.6)]" onClick={handleSave}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button className="transition-all duration-300 hover:-translate-y-[2px]" onClick={() => setIsEditing(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickHighlights.map((item) => {
            const Icon = item.icon;
            const accent = accentStyles[item.accent];
            return (
              <Card
                key={item.key}
                className={`relative overflow-hidden border border-border/50 bg-card/70 backdrop-blur transition-all duration-300 hover:-translate-y-[3px] hover:border-primary/40 hover:shadow-[0_20px_48px_-36px_rgba(56,189,248,0.55)]`}
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent.gradient} opacity-60`} />
                <CardContent className="relative flex items-start justify-between gap-4 p-4">
                  <div className="space-y-1">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</div>
                    <div className={`text-xl font-semibold ${accent.valueColor}`}>{item.value}</div>
                    {item.delta && (
                      <div className="text-xs font-medium text-muted-foreground">{item.delta}</div>
                    )}
                    <p className="text-xs text-muted-foreground/80 max-w-[220px]">{item.hint}</p>
                  </div>
                  <div className={`grid h-11 w-11 place-items-center rounded-xl ${accent.iconBg} ${accent.iconColor}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card className="group border border-border/60 bg-card/70 backdrop-blur transition-all duration-300 hover:-translate-y-[3px] hover:border-primary/40 hover:shadow-[0_18px_38px_-28px_rgba(56,189,248,0.65)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your personal information and profile details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={session?.discordAvatarUrl || session?.avatarUrl} />
                  <AvatarFallback className="text-lg">
                    {(session?.username || session?.discordUsername || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={avatarRefreshing}
                    onClick={handleAvatarRefresh}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${avatarRefreshing ? 'animate-spin' : ''}`} />
                    {avatarRefreshing ? 'Refreshing…' : 'Sync from Discord'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    Avatars sync automatically from your Discord profile. Update it in Discord and refresh here to pull the latest image.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-1">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription */}
          <Card className="group border border-border/60 bg-card/70 backdrop-blur transition-all duration-300 hover:-translate-y-[3px] hover:border-primary/40 hover:shadow-[0_18px_38px_-28px_rgba(56,189,248,0.65)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Subscription
              </CardTitle>
              <CardDescription>
                Manage your subscription and billing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <PlanBadge label={planLabel} />
                  <p className="text-sm text-muted-foreground">
                    {isTrialActive && trialEndText ? `Pro trial • ends ${trialEndText}` : planInfo.description}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <Badge variant={planStatusVariant}>{planStatusLabel}</Badge>
                  {!isTrialActive && planKey === 'Free' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={async () => {
                        try {
                          const res = await apiFetch('/api/trial/start', { method: 'POST' });
                          const data = await res.json();
                          if (res.ok) {
                            setTrial({ active: true, endsAt: data.endsAt || null, trialUsed: true });
                            await syncSessionFromServer();
                            toast.success('7-day trial started');
                          } else {
                            toast.error(data?.error || 'Unable to start trial');
                          }
                        } catch {
                          toast.error('Unable to start trial');
                        }
                      }}
                    >
                      Start 7‑day Trial
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      try {
                        const el = document.getElementById('pricing');
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        } else {
                          window.location.href = '/#pricing';
                        }
                      } catch {
                        window.location.href = '/#pricing';
                      }
                    }}
                  >
                    View Plans
                  </Button>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="space-y-2 text-sm">
                {allowancesDisplay.map((item) => (
                  <div key={item.label} className="flex justify-between gap-3">
                    <span>{item.label}</span>
                    <span className="text-muted-foreground text-right">{item.value}</span>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Included with your plan</div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {planPerks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <span className="mt-[2px] h-1.5 w-1.5 rounded-full bg-primary/70" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 bg-card/80 backdrop-blur transition-all duration-300 hover:-translate-y-[3px] hover:border-primary/40 hover:shadow-[0_18px_38px_-28px_rgba(56,189,248,0.55)]">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div>
                  <CardTitle className="text-base">Trading profile</CardTitle>
                  <CardDescription className="text-xs">Customize your trading preferences</CardDescription>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setProfileDialogOpen(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {tradingProfile ? (
                <div className="grid gap-3 text-xs sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Skill</div>
                    <div className="font-medium text-foreground">{tradingProfile.skillLevel}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Risk</div>
                    <div className="font-medium text-foreground">{tradingProfile.riskAppetite}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Focus</div>
                    <div className="font-medium text-foreground">{tradingProfile.focus}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Style</div>
                    <div className="font-medium text-foreground truncate">{tradingProfile.tradingStyle}</div>
                  </div>
                  {tradingProfile.goals && (
                    <div className="col-span-2 space-y-1 mt-1 pt-2 border-t border-border/40">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Goals</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{tradingProfile.goals}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-3">
                  <p className="text-xs text-muted-foreground mb-2">No trading profile yet</p>
                  <Button size="sm" variant="outline" onClick={() => setProfileDialogOpen(true)}>
                    Create profile
                  </Button>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Portfolio positions</span>
                <Button size="sm" variant="outline" onClick={() => openPortfolioDialog()}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Position
                </Button>
              </div>
              {portfolioPreview && (
                <div className="mt-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-medium text-primary mb-3">
                    <span>Portfolio snapshot</span>
                    <span>{portfolioPreview.count} holdings</span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {portfolioPreview.topHoldings.map((holding) => {
                      const plClass = holding.plValue != null
                        ? holding.plValue > 0 ? 'text-success' : holding.plValue < 0 ? 'text-destructive' : 'text-muted-foreground'
                        : 'text-muted-foreground';
                      return (
                        <div
                          key={holding.symbol}
                          className="flex items-center gap-3 rounded-xl border border-border/20 bg-background/60 px-3 py-2 shadow-inner"
                        >
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                            {holding.symbol.slice(0, 3)}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between text-xs font-medium text-foreground">
                              <span>{holding.symbol}</span>
                              <span className="text-muted-foreground font-normal">
                                {holding.currentValue != null ? formatCurrency(holding.currentValue) : '—'}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                              {holding.quantity != null ? (
                                <span>{holding.quantity} {holding.quantity === 1 ? 'share' : 'shares'}</span>
                              ) : (
                                <span>Quantity —</span>
                              )}
                              {holding.costBasis != null && (
                                <span>Avg {formatCurrency(holding.costBasis)}</span>
                              )}
                              {holding.currentPrice != null && (
                                <span>Now {formatCurrency(holding.currentPrice)}</span>
                              )}
                              {holding.plValue != null && (
                                <span className={plClass}>
                                  {formatCurrency(holding.plValue)}{holding.plPercent != null ? ` (${formatPercent(holding.plPercent)})` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 space-y-2 text-[11px] text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Invested capital</span>
                      <span className="text-foreground font-medium">{formatCurrency(portfolioPreview.totalInvested)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Current value</span>
                      <span className="text-foreground font-medium">{formatCurrency(portfolioPreview.currentValue)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Unrealized P/L</span>
                      <span className={`${portfolioPreview.plValue > 0 ? 'text-success' : portfolioPreview.plValue < 0 ? 'text-destructive' : 'text-foreground'} font-medium`}>
                        {formatCurrency(portfolioPreview.plValue)}{portfolioPreview.plPercent != null ? ` (${formatPercent(portfolioPreview.plPercent)})` : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Targets set</span>
                      <span className="text-foreground font-medium">{portfolioPreview.activeTargets}</span>
                    </div>
                  </div>
                </div>
              )}
              {pricedPositions.length > 0 && (
                <div className="mt-4 rounded-xl border border-border/40 bg-background/40 p-4">
                  <div className="space-y-3">
                    {pricedPositions.slice(0, 3).map((position) => {
                      const plClass = position.plValue != null
                        ? position.plValue > 0 ? 'text-success' : position.plValue < 0 ? 'text-destructive' : 'text-muted-foreground'
                        : 'text-muted-foreground';
                      return (
                        <div
                          key={position.id}
                          className="flex items-center justify-between rounded-lg border border-border/30 bg-background/60 px-3 py-2.5 hover:border-primary/40 hover:bg-background/80 transition-all"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary flex-shrink-0">
                              {position.symbol.slice(0, 3)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                                <span>{position.symbol}</span>
                                {position.quantity != null && position.costBasis != null && (
                                  <span className="text-muted-foreground font-normal">
                                    {position.quantity} @ {formatCurrency(position.costBasis)}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground mt-0.5">
                                {position.currentPrice != null && (
                                  <span>Now {formatCurrency(position.currentPrice)}</span>
                                )}
                                {position.plValue != null && (
                                  <span className={plClass}>
                                    {formatCurrency(position.plValue)} {position.plPercent != null ? `(${formatPercent(position.plPercent)})` : ''}
                                  </span>
                                )}
                                {position.targetPrice != null && (
                                  <span>Target: {formatCurrency(position.targetPrice)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => openPortfolioDialog(position)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => handlePortfolioDelete(position.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {pricedPositions.length > 3 && (
                      <div className="text-center pt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => {
                            const portfolioCard = document.getElementById('portfolio-positions-full');
                            if (portfolioCard) {
                              portfolioCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }}
                        >
                          View all {pricedPositions.length} positions
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Portfolio Positions Full View */}
          {pricedPositions.length > 0 && (
            <Card id="portfolio-positions-full" className="border border-border/50 bg-card/80 backdrop-blur transition-all duration-300 hover:-translate-y-[3px] hover:border-primary/40 hover:shadow-[0_20px_44px_-30px_rgba(56,189,248,0.55)]">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Portfolio Positions</CardTitle>
                    <CardDescription className="text-xs">Manage your trading positions</CardDescription>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => openPortfolioDialog()}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Position
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Symbol</TableHead>
                        <TableHead className="text-xs">Quantity</TableHead>
                        <TableHead className="text-xs">Cost Basis</TableHead>
                        <TableHead className="text-xs">Current Price</TableHead>
                        <TableHead className="text-xs">Current Value</TableHead>
                        <TableHead className="text-xs">Unrealized P/L</TableHead>
                        <TableHead className="text-xs">Target Price</TableHead>
                        <TableHead className="text-xs">Strategy</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pricedPositions.map((position) => {
                        const plClass = position.plValue != null
                          ? position.plValue > 0 ? 'text-success' : position.plValue < 0 ? 'text-destructive' : 'text-muted-foreground'
                          : 'text-muted-foreground';
                        return (
                          <TableRow key={position.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium text-sm">{position.symbol}</TableCell>
                            <TableCell className="text-sm">
                              {position.quantity != null ? position.quantity.toLocaleString() : '—'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {position.costBasis != null ? formatCurrency(position.costBasis) : '—'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {position.currentPrice != null ? formatCurrency(position.currentPrice) : '—'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {position.currentValue != null ? formatCurrency(position.currentValue) : '—'}
                            </TableCell>
                            <TableCell className={`text-sm ${plClass}`}>
                              {position.plValue != null ? `${formatCurrency(position.plValue)}${position.plPercent != null ? ` (${formatPercent(position.plPercent)})` : ''}` : '—'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {position.targetPrice != null ? formatCurrency(position.targetPrice) : '—'}
                            </TableCell>
                            <TableCell className="text-sm">
                              <span className="truncate max-w-[120px] block" title={position.strategy || ''}>
                                {position.strategy || '—'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => openPortfolioDialog(position)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  onClick={() => handlePortfolioDelete(position.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Settings Sidebar */}
        <div className="space-y-6 lg:col-span-1 flex flex-col h-full">
          {/* Notifications */}
          <Card className="border border-border/50 bg-card/70 backdrop-blur transition-all duration-300 hover:-translate-y-[3px] hover:border-primary/40 hover:shadow-[0_18px_38px_-28px_rgba(56,189,248,0.55)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Trading Signals</p>
                  <p className="text-xs text-muted-foreground">
                    Get notified of new signals
                  </p>
                </div>
                <Button
                  variant={formData.notifications.signals ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full px-4 transition-all duration-300 ${formData.notifications.signals ? 'shadow-[0_12px_24px_-16px_rgba(56,189,248,0.7)]' : 'hover:border-primary/40 hover:text-primary'}`}
                  onClick={() => handleNotificationChange("signals", !formData.notifications.signals)}
                >
                  {formData.notifications.signals ? "On" : "Off"}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Price Alerts</p>
                  <p className="text-xs text-muted-foreground">
                    When your alerts trigger
                  </p>
                </div>
                <Button
                  variant={formData.notifications.alerts ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full px-4 transition-all duration-300 ${formData.notifications.alerts ? 'shadow-[0_12px_24px_-16px_rgba(56,189,248,0.7)]' : 'hover:border-primary/40 hover:text-primary'}`}
                  onClick={() => handleNotificationChange("alerts", !formData.notifications.alerts)}
                >
                  {formData.notifications.alerts ? "On" : "Off"}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Weekly Summary</p>
                  <p className="text-xs text-muted-foreground">
                    Performance reports
                  </p>
                </div>
                <Button
                  variant={formData.notifications.weekly ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full px-4 transition-all duration-300 ${formData.notifications.weekly ? 'shadow-[0_12px_24px_-16px_rgba(56,189,248,0.7)]' : 'hover:border-primary/40 hover:text-primary'}`}
                  onClick={() => handleNotificationChange("weekly", !formData.notifications.weekly)}
                >
                  {formData.notifications.weekly ? "On" : "Off"}
                </Button>
              </div>
            </CardContent>
          </Card>

        <Card className="border border-primary/40 bg-gradient-to-br from-primary/10 via-background/95 to-background/90 shadow-[0_24px_60px_-34px_rgba(59,130,246,0.55)] transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_34px_78px_-28px_rgba(59,130,246,0.65)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <LifeBuoy className="h-5 w-5 text-primary" />
              Feedback &amp; Support
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Report bugs, request features, or ask for help. Critical submissions alert the team instantly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-primary/40 bg-muted/60 p-4 text-sm text-foreground shadow-inner shadow-primary/10">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground">We read every submission</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add screenshots or Loom links. Your report creates an admin ticket and pings us on Discord.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-foreground">Avg. first response &lt; 30 mins</Badge>
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-foreground">Critical issues escalate instantly</Badge>
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• Detailed bug reports with reproduction steps</li>
              <li>• Product ideas &amp; feature requests</li>
              <li>• Billing or account support</li>
            </ul>
            <Button
              size="lg"
              onClick={() => setFeedbackOpen(true)}
              className="h-11 w-full bg-primary text-primary-foreground shadow-[0_18px_40px_-20px_rgba(59,130,246,0.6)] transition-transform hover:-translate-y-[1px] hover:bg-primary/90"
            >
              Report an issue / request a feature
            </Button>
          </CardContent>
        </Card>

          {/* Danger Zone */}
          <Card className="mt-auto border border-destructive/30 bg-destructive/5 backdrop-blur transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_18px_32px_-24px_rgba(239,68,68,0.4)]">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="destructive" 
                size="sm" 
                className="w-full"
                onClick={() => setEraseOpen(true)}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Erase User Data
              </Button>
              <p className="text-xs text-muted-foreground">
                Removes app data and resets stats for this user
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Erase confirmation dialog */}
      <Dialog open={eraseOpen} onOpenChange={setEraseOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Erase User Data</DialogTitle>
            <DialogDescription>
              This will remove your local app data and reset stats. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Type <span className="font-semibold">DELETE</span> to confirm.</p>
            <Input value={eraseText} onChange={(e) => setEraseText(e.target.value)} placeholder="DELETE" />
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setEraseOpen(false); setEraseText(""); }}>Cancel</Button>
              <Button 
                className="flex-1" 
                variant="destructive" 
                disabled={eraseText !== "DELETE" || eraseLoading}
                onClick={async () => {
                  setEraseLoading(true);
                  try {
                    const res = await apiFetch('/api/account/erase', {
                      method: 'POST',
                      credentials: 'include',
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to erase account data');
                    }
                    try {
                      localStorage.clear();
                    } catch {}
                    toast.success('Erasing account data…');
                    setEraseText("");
                    setEraseOpen(false);
                  } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed to erase account data';
                    toast.error(message);
                  } finally {
                    setEraseLoading(false);
                  }
                }}
              >
                {eraseLoading ? 'Erasing…' : 'Confirm'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPortfolioDialogOpen}
        onOpenChange={(open) => {
          setIsPortfolioDialogOpen(open);
          if (!open) resetPortfolioForm();
        }}
      >
        <DialogContent className="w-full max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{portfolioForm.id ? 'Edit position' : 'Add position'}</DialogTitle>
            <DialogDescription>Keep this aligned with your real holdings for richer Mentor guidance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="acct-portfolio-symbol">Symbol</Label>
              <Input
                id="acct-portfolio-symbol"
                placeholder="BTC"
                value={portfolioForm.symbol}
                onChange={(e) => updatePortfolioField('symbol', e.target.value.toUpperCase())}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="acct-portfolio-qty">Quantity</Label>
                <Input
                  id="acct-portfolio-qty"
                  placeholder="e.g. 1.5"
                  value={portfolioForm.quantity}
                  onChange={(e) => updatePortfolioField('quantity', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acct-portfolio-cost">Cost basis</Label>
                <Input
                  id="acct-portfolio-cost"
                  placeholder="e.g. 28500"
                  value={portfolioForm.costBasis}
                  onChange={(e) => updatePortfolioField('costBasis', e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="acct-portfolio-target">Target price</Label>
                <Input
                  id="acct-portfolio-target"
                  placeholder="e.g. 36000"
                  value={portfolioForm.targetPrice}
                  onChange={(e) => updatePortfolioField('targetPrice', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acct-portfolio-timeframe">Timeframe</Label>
                <Input
                  id="acct-portfolio-timeframe"
                  placeholder="Swing, Long-term"
                  value={portfolioForm.timeframe}
                  onChange={(e) => updatePortfolioField('timeframe', e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="acct-portfolio-risk">Risk</Label>
                <Input
                  id="acct-portfolio-risk"
                  placeholder="Low / Med / High"
                  value={portfolioForm.risk}
                  onChange={(e) => updatePortfolioField('risk', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acct-portfolio-confidence">Confidence %</Label>
                <Input
                  id="acct-portfolio-confidence"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="e.g. 70"
                  value={portfolioForm.confidence}
                  onChange={(e) => updatePortfolioField('confidence', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="acct-portfolio-strategy">Strategy</Label>
              <Input
                id="acct-portfolio-strategy"
                placeholder="e.g. Breakout swing, DCA"
                value={portfolioForm.strategy}
                onChange={(e) => updatePortfolioField('strategy', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acct-portfolio-notes">Notes</Label>
              <Textarea
                id="acct-portfolio-notes"
                placeholder="Optional notes"
                className="min-h-[80px]"
                value={portfolioForm.notes}
                onChange={(e) => updatePortfolioField('notes', e.target.value)}
              />
            </div>
            <div className="space-y-3 rounded-2xl border border-border/50 bg-background/70 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Portfolio alerts</div>
                  <p className="text-xs text-muted-foreground/80 max-w-xs">
                    Control when Discord notifies you about position P/L changes.
                  </p>
                </div>
                <Switch
                  checked={portfolioNotifyEnabled}
                  onCheckedChange={(checked) => {
                    setPortfolioNotifyEnabled(checked);
                    if (checked && !portfolioNotifyEnabled) {
                      setPortfolioNotifySlider((prev) => Math.min(15, Math.max(1, prev || 5)));
                    }
                  }}
                />
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{portfolioNotifyEnabled ? 'Notify me when a position moves' : 'Notifications disabled'}</span>
                  {portfolioNotifyEnabled && (
                    <span className="font-medium text-foreground">{portfolioNotifySlider}%</span>
                  )}
                </div>
                <Slider
                  value={[portfolioNotifyEnabled ? portfolioNotifySlider : Math.max(1, portfolioNotifySlider)]}
                  onValueChange={(vals) => setPortfolioNotifySlider(vals[0])}
                  min={1}
                  max={15}
                  step={1}
                  disabled={!portfolioNotifyEnabled}
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handlePortfolioNotifySave}
                    disabled={portfolioNotifySaving || (portfolioNotifyEnabled === initialPortfolioNotifyEnabled && portfolioNotifySlider === initialPortfolioNotifySlider)}
                  >
                    {portfolioNotifySaving ? 'Saving…' : 'Save alert threshold'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={() => resetPortfolioForm()}>
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={handlePortfolioSubmit} disabled={portfolioSaving}>
              {portfolioSaving ? 'Saving…' : portfolioForm.id ? 'Update position' : 'Save position'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Trading profile</DialogTitle>
            <DialogDescription>Used across Mentor and dashboards to personalize analysis.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Skill level</Label>
                <Select value={profileForm.skillLevel} onValueChange={(value: TradingProfile["skillLevel"]) => setProfileForm(prev => ({ ...prev, skillLevel: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                    <SelectItem value="Pro">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Risk appetite</Label>
                <Select value={profileForm.riskAppetite} onValueChange={(value: TradingProfile["riskAppetite"]) => setProfileForm(prev => ({ ...prev, riskAppetite: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Conservative">Conservative</SelectItem>
                    <SelectItem value="Balanced">Balanced</SelectItem>
                    <SelectItem value="Aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Primary focus</Label>
              <Select value={profileForm.focus} onValueChange={(value: TradingProfile["focus"]) => setProfileForm(prev => ({ ...prev, focus: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Crypto">Crypto</SelectItem>
                  <SelectItem value="Stocks">Stocks</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Trading style</Label>
              <Input value={profileForm.tradingStyle} onChange={(e) => setProfileForm(prev => ({ ...prev, tradingStyle: e.target.value }))} placeholder="e.g. Swing trading, scalping" />
            </div>
            <div className="space-y-2">
              <Label>Goals</Label>
              <Textarea value={profileForm.goals} onChange={(e) => setProfileForm(prev => ({ ...prev, goals: e.target.value }))} className="min-h-[80px]" placeholder="Describe your objectives" />
            </div>
            <div className="pt-4 border-t border-border/40">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Portfolio positions</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setProfileDialogOpen(false);
                    openPortfolioDialog();
                  }}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Manage Portfolio
                </Button>
              </div>
              {pricedPositions.length > 0 ? (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {pricedPositions.slice(0, 5).map((position) => {
                    const plClass = position.plValue != null
                      ? position.plValue > 0 ? 'text-success' : position.plValue < 0 ? 'text-destructive' : 'text-muted-foreground'
                      : 'text-muted-foreground';
                    return (
                      <div
                        key={position.id}
                        className="flex items-center justify-between rounded-lg border border-border/30 bg-background/60 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-medium">{position.symbol}</span>
                          {position.quantity != null && position.costBasis != null && (
                            <span className="text-muted-foreground">
                              {position.quantity} @ {formatCurrency(position.costBasis)}
                            </span>
                          )}
                          {position.currentPrice != null && (
                            <span className="text-muted-foreground">• {formatCurrency(position.currentPrice)}</span>
                          )}
                          {position.plValue != null && (
                            <span className={plClass}>
                              • {formatCurrency(position.plValue)}{position.plPercent != null ? ` (${formatPercent(position.plPercent)})` : ''}
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            setProfileDialogOpen(false);
                            openPortfolioDialog(position);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                  {pricedPositions.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{pricedPositions.length - 5} more positions
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3">
                  No portfolio positions yet. Click "Manage Portfolio" to add your first position.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button disabled={profileSaving} onClick={handleTradingProfileSave}>
              {profileSaving ? 'Saving…' : 'Save profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default Account;
