import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getSession } from "@/lib/session";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Announcement = { id:number; title:string; body?:string; created_at:string; audience?:string };
type SignalNotification = {
  id: number;
  sourceId?: string | number;
  symbol: string;
  type: string;
  postedAt?: string;
  createdAt: string;
  priceValue?: number | null;
  summary?: string | null;
  assetType?: string | null;
  logoUrl?: string | null;
};
type AlertNotification = {
  id: number;
  sourceId?: string | number;
  userId?: string | number;
  symbol: string;
  type: string;
  direction: string;
  threshold: number;
  currentPrice: number;
  assetType?: string | null;
  displaySymbol?: string | null;
  displayName?: string | null;
  createdAt: string;
  change?: number | null;
  active?: boolean;
  triggeredAt?: string | null;
};

type SystemNotification = {
  id: string | number;
  sourceId?: string | number;
  title: string;
  body?: string;
  createdAt: string;
  level?: string;
  actionLabel?: string | null;
  actionHref?: string | null;
  meta?: Record<string, unknown> | null;
};

type NotificationItem = {
  id: number | string;
  kind: "announcement" | "signal" | "alert" | "system";
  title: string;
  body?: string;
  createdAt: string;
  meta?: Record<string, unknown>;
  raw?: Announcement | SignalNotification | AlertNotification | SystemNotification;
};

const Notifications: React.FC = () => {
  const session = getSession();
  const deviceTimezone = React.useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);
  const [userTimezone, setUserTimezone] = useState<string | null>(deviceTimezone);
  const [filter, setFilter] = useState<"all" | "announcements" | "signals" | "alerts" | "system" | "dismissed">("all");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [signalNotifications, setSignalNotifications] = useState<SignalNotification[]>([]);
  const [alertNotifications, setAlertNotifications] = useState<AlertNotification[]>([]);
  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [viewed, setViewed] = useState<Set<string>>(new Set());
  const sessionUserId = React.useMemo(() => {
    if (session?.discordId) return String(session.discordId);
    if (session?.userId) return String(session.userId);
    return null;
  }, [session?.discordId, session?.userId]);

  const canSeeSystemNotification = React.useCallback((item: SystemNotification | null | undefined) => {
    if (!item) return false;
    const meta = item.meta && typeof item.meta === 'object' ? item.meta as Record<string, any> : {};
    if (meta && typeof meta === 'object') {
      if (typeof meta.feedbackId !== 'undefined' && !session?.isAdmin) {
        return false;
      }
      if (meta.targetUserId != null) {
        const target = String(meta.targetUserId);
        if (sessionUserId && target !== sessionUserId) {
          return false;
        }
      }
    }
    if (!session?.isAdmin && typeof item.actionHref === 'string' && item.actionHref.startsWith('/dashboard/admin')) {
      return false;
    }
    return true;
  }, [session?.isAdmin, sessionUserId]);

  const visibleSystemNotifications = React.useMemo(() => {
    return systemNotifications.filter((item) => canSeeSystemNotification(item));
  }, [systemNotifications, canSeeSystemNotification]);

  const updateAlertNotification = useCallback((alertId: number, updates: Partial<AlertNotification>) => {
    setAlertNotifications((prev) => {
      const next = prev.map((alert) => (alert.id === alertId ? { ...alert, ...updates } : alert));
      try {
        localStorage.setItem('joat:notifs:alerts', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const notificationKey = (item: NotificationItem) => {
    if (item.kind === "signal") {
      const rawSignal = item.raw as SignalNotification | undefined;
      if (rawSignal?.sourceId) {
        return `signal:${rawSignal.sourceId}`;
      }
    }
    if (item.kind === "alert") {
      const rawAlert = item.raw as AlertNotification | undefined;
      if (rawAlert?.sourceId) {
        return `alert:${rawAlert.sourceId}`;
      }
      if (rawAlert?.id) {
        return `alert:${rawAlert.id}`;
      }
    }
  if (item.kind === "system") {
    const rawSystem = item.raw as SystemNotification | undefined;
    if (rawSystem?.sourceId) {
      return `system:${rawSystem.sourceId}`;
    }
  }
    return `${item.kind}:${item.id}`;
  };
  const emitUpdate = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent('joat:signals:notification'));
      window.dispatchEvent(new CustomEvent('joat:alerts:notification'));
      window.dispatchEvent(new CustomEvent('joat:system:notification'));
    } catch {}
  }, []);

  const persistDismissed = (next: Set<string>) => {
    try {
      localStorage.setItem('joat:dismissed:notifs', JSON.stringify(Array.from(next)));
    } catch {}
    emitUpdate();
  };

  const persistViewed = (next: Set<string>) => {
    try {
      localStorage.setItem('joat:viewed:notifs', JSON.stringify(Array.from(next)));
    } catch {}
    emitUpdate();
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('joat:dismissed:notifs');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setDismissed(new Set(parsed));
          return;
        }
      }
      const legacy = localStorage.getItem('joat:dismissed:ann');
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        if (Array.isArray(parsedLegacy)) {
          const converted = parsedLegacy.map((id: number) => `announcement:${id}`);
          setDismissed(new Set(converted));
          localStorage.setItem('joat:dismissed:notifs', JSON.stringify(converted));
          localStorage.removeItem('joat:dismissed:ann');
        }
      }
    } catch {}
    try {
      const rawViewed = localStorage.getItem('joat:viewed:notifs');
      if (rawViewed) {
        const parsedViewed = JSON.parse(rawViewed);
        if (Array.isArray(parsedViewed)) {
          setViewed(new Set(parsedViewed));
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch('/api/announcements', { credentials: 'include' });
        const data = await res.json();
        if (!cancel && Array.isArray(data?.items)) setAnnouncements(data.items);
      } catch {}
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch('/api/preferences', { credentials: 'include' });
        if (!res.ok) throw new Error('prefs');
        const data = await res.json();
        const tz = data?.preferences?.general?.timezone;
        if (!cancel) {
          if (typeof tz === 'string' && tz && tz !== 'auto') {
            setUserTimezone(tz);
          } else {
            setUserTimezone(deviceTimezone);
          }
        }
      } catch {
        if (!cancel) setUserTimezone(deviceTimezone);
      }
    })();
    return () => { cancel = true; };
  }, [deviceTimezone]);

  useEffect(() => {
    const loadSignals = () => {
      try {
        const raw = JSON.parse(localStorage.getItem('joat:notifs:signals') || '[]');
        if (Array.isArray(raw)) {
          setSignalNotifications(raw);
        }
      } catch {}
    };
    const loadAlerts = () => {
      try {
        const raw = JSON.parse(localStorage.getItem('joat:notifs:alerts') || '[]');
        if (Array.isArray(raw)) {
          setAlertNotifications(raw);
        }
      } catch {}
    };
    const loadSystem = () => {
      try {
        const raw = JSON.parse(localStorage.getItem('joat:notifs:system') || '[]');
        if (Array.isArray(raw)) {
          setSystemNotifications(raw);
        }
      } catch {}
    };
    loadSignals();
    loadAlerts();
    loadSystem();
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'joat:notifs:signals') loadSignals();
      if (event.key === 'joat:notifs:alerts') loadAlerts();
      if (event.key === 'joat:notifs:system') loadSystem();
    };
    const onSignalEvent = () => loadSignals();
    const onAlertEvent = () => loadAlerts();
    const onSystemEvent = () => loadSystem();
    window.addEventListener('storage', onStorage);
    window.addEventListener('joat:signals:notification', onSignalEvent as EventListener);
    window.addEventListener('joat:alerts:notification', onAlertEvent as EventListener);
    window.addEventListener('joat:system:notification', onSystemEvent as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('joat:signals:notification', onSignalEvent as EventListener);
      window.removeEventListener('joat:alerts:notification', onAlertEvent as EventListener);
      window.removeEventListener('joat:system:notification', onSystemEvent as EventListener);
    };
  }, []);

  const combinedNotifications = React.useMemo<NotificationItem[]>(() => {
    const userId = session?.discordId ? String(session.discordId) : session?.userId ? String(session.userId) : null;
    const userAudience = userId ? `user:${userId}` : null;
    const planAudience = session?.plan ? `plan:${session.plan}` : null;
    const matchesAudience = (aud?: string | null) => {
      if (!aud || aud === 'all') return true;
      if (aud === userAudience) return true;
      if (planAudience && aud === planAudience) return true;
      return false;
    };

    const mappedAnnouncements: NotificationItem[] = announcements
      .filter((a) => matchesAudience(a.audience))
      .map((a) => ({
      id: a.id,
      kind: "announcement",
      title: a.title,
      body: a.body,
      createdAt: a.created_at,
      raw: a,
      }));
    const mappedSignals: NotificationItem[] = signalNotifications.map((s) => ({
      id: s.id,
      kind: "signal",
      title: `${s.symbol} • ${s.type}`,
      body: s.summary ?? undefined,
      createdAt: s.postedAt || s.createdAt,
      meta: {
        symbol: s.symbol,
        type: s.type,
        priceValue: s.priceValue,
        assetType: s.assetType,
        postedAt: s.postedAt,
      logoUrl: s.logoUrl,
      },
      raw: s,
    }));
    const mappedAlerts: NotificationItem[] = alertNotifications.map((a) => {
      const directionSymbol = a.direction === '<=' ? '≤' : '≥';
      const thresholdDisplay = typeof a.threshold === 'number'
        ? (a.type === 'price'
            ? `$${a.threshold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
            : `${a.threshold.toFixed(2)}%`)
        : '—';
      const currentDisplay = typeof a.currentPrice === 'number'
        ? `$${a.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
        : '—';
      const changeDisplay = typeof a.change === 'number'
        ? `${a.change >= 0 ? '+' : ''}${a.change.toFixed(2)}%`
        : null;

      return {
        id: a.id,
        kind: "alert",
        title: `🔔 Alert: ${a.displaySymbol || a.symbol} ${directionSymbol} ${thresholdDisplay}`,
        body: changeDisplay
          ? `Current price: ${currentDisplay} • Δ vs target: ${changeDisplay}`
          : `Current price: ${currentDisplay}`,
        createdAt: a.triggeredAt || a.createdAt,
        meta: {
          symbol: a.symbol,
          type: a.type,
          direction: a.direction,
          threshold: a.threshold,
          currentPrice: a.currentPrice,
          assetType: a.assetType,
          displaySymbol: a.displaySymbol,
          displayName: a.displayName,
          active: typeof a.active === 'boolean' ? a.active : false,
          triggeredAt: a.triggeredAt || a.createdAt,
          change: a.change ?? null,
        },
        raw: {
          ...a,
          active: typeof a.active === 'boolean' ? a.active : false,
          triggeredAt: a.triggeredAt || a.createdAt,
          change: a.change ?? null,
        },
      };
    });
    const mappedSystem: NotificationItem[] = visibleSystemNotifications.map((n) => ({
      id: n.id,
      kind: "system",
      title: n.title || 'Notification',
      body: n.body,
      createdAt: n.createdAt,
      meta: {
        level: n.level,
        actionLabel: n.actionLabel,
        actionHref: n.actionHref,
      },
      raw: n,
    }));
    return [...mappedAnnouncements, ...mappedSignals, ...mappedAlerts, ...mappedSystem].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [announcements, signalNotifications, alertNotifications, visibleSystemNotifications]);

  // Mark notifications as viewed when this page shows them
  useEffect(() => {
    try {
      const keys = combinedNotifications.map((item) => notificationKey(item));
      const next = new Set(viewed);
      for (const k of keys) next.add(k);
      if (next.size !== viewed.size) {
        setViewed(next);
        persistViewed(next);
      }
    } catch {}
  }, [combinedNotifications, viewed]);

  const formatTimestamp = React.useCallback((iso: string) => {
    if (!iso) return "Unknown time";
    try {
      const dt = new Date(iso);
      if (Number.isNaN(dt.getTime())) return "Unknown time";
      return new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone || undefined,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(dt);
    } catch {
      try {
        return new Date(iso).toLocaleString('en-US', {
          timeZone: userTimezone || undefined,
        });
      } catch {
        return "Unknown time";
      }
    }
  }, [userTimezone]);

  const filteredNotifications = React.useMemo(() => {
    return combinedNotifications.filter((item) => {
      const key = notificationKey(item);
      const isDismissed = dismissed.has(key);
      if (filter === "dismissed") return isDismissed;
      if (isDismissed) return false;
      if (filter === "announcements") return item.kind === "announcement";
      if (filter === "signals") return item.kind === "signal";
      if (filter === "alerts") return item.kind === "alert";
      if (filter === "system") return item.kind === "system";
      return true;
    });
  }, [combinedNotifications, filter, dismissed]);

  const isNewNotification = (item: NotificationItem) => {
    const key = notificationKey(item);
    return !viewed.has(key);
  };

  const dismissNotification = (item: NotificationItem) => {
    const key = notificationKey(item);
    const next = new Set(dismissed);
    next.add(key);
    setDismissed(next);
    persistDismissed(next);
  };

  const restoreNotification = (item: NotificationItem) => {
    const key = notificationKey(item);
    const next = new Set(dismissed);
    next.delete(key);
    setDismissed(next);
    persistDismissed(next);
  };

  const deleteGlobal = async (id: number) => {
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setAnnouncements((prev) => prev.filter(a => a.id !== id));
        const key = `announcement:${id}`;
        if (dismissed.has(key)) {
          const next = new Set(dismissed);
          next.delete(key);
          setDismissed(next);
          persistDismissed(next);
        }
        toast.success('Announcement deleted');
      } else {
        toast.error('Delete failed');
      }
    } catch { toast.error('Delete failed'); }
  };

  const resumeAlert = useCallback(async (alertId?: number | string | null) => {
    if (alertId == null || alertId === undefined || alertId === 'undefined' || alertId === 'null') {
      toast.error('Missing alert reference');
      return;
    }
    const idStr = String(alertId).trim();
    if (!idStr || isNaN(Number(idStr))) {
      toast.error('Invalid alert ID');
      return;
    }
    const idNum = Number(idStr);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      toast.error('Invalid alert ID');
      return;
    }
    try {
      const res = await fetch(`/api/alerts/${idNum}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to resume alert');
      }
      updateAlertNotification(idNum, { active: true });
      toast.success('Alert resumed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resume alert');
    }
  }, [updateAlertNotification]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Notifications</h2>
          <p className="text-muted-foreground">Announcements and system updates</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2">
            <Badge variant={filter === "all" ? "secondary" : "outline"} onClick={() => setFilter("all")}>All</Badge>
            <Badge variant={filter === "announcements" ? "secondary" : "outline"} onClick={() => setFilter("announcements")}>Announcements</Badge>
            <Badge variant={filter === "signals" ? "secondary" : "outline"} onClick={() => setFilter("signals")}>Signals</Badge>
            <Badge variant={filter === "alerts" ? "secondary" : "outline"} onClick={() => setFilter("alerts")}>Alerts</Badge>
            <Badge variant={filter === "system" ? "secondary" : "outline"} onClick={() => setFilter("system")}>System</Badge>
            <Badge variant={filter === "dismissed" ? "secondary" : "outline"} onClick={() => setFilter("dismissed")}>Dismissed</Badge>
          </div>
          <Button className="sm:ml-2" variant="outline" onClick={() => {
            const allKeys = combinedNotifications.map((item) => notificationKey(item));
            const next = new Set(viewed);
            for (const k of allKeys) next.add(k);
            setViewed(next);
            persistViewed(next);
          }}>Mark all as read</Button>
        </div>
      </div>

      {filteredNotifications.length === 0 ? (
        <Card className="bg-card/60 border-border">
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold mb-1">You're all caught up</h3>
            <p className="text-muted-foreground">New updates will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredNotifications.map((item) => {
            const key = notificationKey(item);
            const dismissedState = dismissed.has(key);
            const isSignal = item.kind === "signal";
            const isAlert = item.kind === "alert";
            const isSystem = item.kind === "system";
            const signalMeta = isSignal ? (item.raw as SignalNotification | undefined) : undefined;
            const alertMeta = isAlert ? (item.raw as AlertNotification | undefined) : undefined;
            const systemMeta = isSystem ? (item.raw as SystemNotification | undefined) : undefined;
            return (
              <Card 
                key={key} 
                className={cn(
                  "bg-card/60 border-border ring-1 transition-all duration-300",
                  dismissedState 
                    ? "ring-border/20 opacity-60" 
                    : "ring-amber-400/20 shadow-[0_0_24px_rgba(251,191,36,0.10)] hover:ring-amber-400/40 hover:shadow-[0_0_32px_rgba(251,191,36,0.15)] hover:-translate-y-0.5 hover:border-amber-400/30"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[10px] ${isSignal ? 'bg-blue-500/15 text-blue-200 border-blue-400/30' : isAlert ? 'bg-orange-500/15 text-orange-200 border-orange-400/30' : isSystem ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' : 'bg-amber-500/15 text-amber-300 border-amber-400/30'}`}>
                          {isSignal ? 'SIGNAL' : isAlert ? 'ALERT' : isSystem ? 'SYSTEM' : 'ADMIN'}
                        </Badge>
                        {isAlert && (
                          <Badge className={cn('text-[10px] border border-border/30', alertMeta?.active === false ? 'bg-red-500/15 text-red-200 border-red-400/30' : 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30')}>
                            {alertMeta?.active === false ? 'Paused' : 'Active'}
                          </Badge>
                        )}
                        {isNewNotification(item) && !dismissedState && (
                          <Badge className="text-[10px] bg-green-500/15 text-green-300 border-green-400/30">NEW</Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        {isSignal && signalMeta?.logoUrl && (
                          <img src={signalMeta.logoUrl as string} alt="asset" className="h-6 w-6 rounded-full border border-border/40 object-cover" />
                        )}
                        {isAlert && alertMeta?.assetType && (
                          <img 
                            src={`https://assets.coingecko.com/coins/images/${alertMeta.assetType === 'crypto' ? '1' : '2'}/small/${alertMeta.displaySymbol?.toLowerCase() || alertMeta.symbol.toLowerCase()}.png`}
                            alt="asset" 
                            className="h-6 w-6 rounded-full border border-border/40 object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <CardTitle className="text-base break-words">{item.title}</CardTitle>
                      </div>
                      <CardDescription className="text-xs text-muted-foreground">{formatTimestamp(item.createdAt)}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 sm:self-start">
                      {isSignal ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => { window.location.href = "/dashboard/signals"; }}>Open Signals</Button>
                          {dismissedState ? (
                            <Button variant="outline" size="sm" onClick={() => restoreNotification(item)}>Restore</Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => dismissNotification(item)}>Dismiss</Button>
                          )}
                        </>
                      ) : isAlert ? (
                        <>
                          {alertMeta?.active === false && (typeof alertMeta?.id === 'number' || typeof alertMeta?.id === 'string') && (
                            <Button variant="outline" size="sm" onClick={() => resumeAlert(alertMeta?.id)}>
                              Resume Alert
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => { window.location.href = "/dashboard/alerts"; }}>Open Alerts</Button>
                          {dismissedState ? (
                            <Button variant="outline" size="sm" onClick={() => restoreNotification(item)}>Restore</Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => dismissNotification(item)}>Dismiss</Button>
                          )}
                        </>
                      ) : isSystem ? (
                        <>
                          {systemMeta?.actionLabel && systemMeta?.actionHref && (
                            <Button variant="outline" size="sm" onClick={() => { window.location.href = systemMeta.actionHref as string; }}>
                              {systemMeta.actionLabel}
                            </Button>
                          )}
                          {dismissedState ? (
                            <Button variant="outline" size="sm" onClick={() => restoreNotification(item)}>Restore</Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => dismissNotification(item)}>Dismiss</Button>
                          )}
                        </>
                      ) : (
                        <>
                          {session?.isAdmin && filter !== 'dismissed' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">Delete</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
                                  <AlertDialogDescription>This removes it for everyone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteGlobal((item.raw as Announcement).id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {dismissedState ? (
                            <Button variant="outline" size="sm" onClick={() => restoreNotification(item)}>Restore</Button>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">Dismiss</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Dismiss notification?</AlertDialogTitle>
                                  <AlertDialogDescription>You can’t undo this action.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => dismissNotification(item)}>Dismiss</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {isSignal ? (
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <div className="grid sm:grid-cols-3 gap-2">
                      <div><span className="font-semibold text-foreground">Symbol:</span> {signalMeta?.symbol}</div>
                      <div><span className="font-semibold text-foreground">Type:</span> {signalMeta?.type}</div>
                      <div><span className="font-semibold text-foreground">Price:</span> {typeof signalMeta?.priceValue === 'number' ? `$${signalMeta.priceValue.toLocaleString(undefined, { maximumFractionDigits: signalMeta.priceValue >= 100 ? 2 : 4 })}` : '—'}</div>
                    </div>
                    {item.body && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">{item.body}</p>
                    )}
                  </CardContent>
                ) : isAlert ? (
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <div className="grid sm:grid-cols-3 gap-2">
                      <div><span className="font-semibold text-foreground">Symbol:</span> {alertMeta?.displaySymbol || alertMeta?.symbol}</div>
                      <div><span className="font-semibold text-foreground">Direction:</span> {alertMeta?.direction}</div>
                      <div><span className="font-semibold text-foreground">Threshold:</span> {typeof alertMeta?.threshold === 'number' ? (alertMeta.type === 'price' ? `$${alertMeta.threshold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : `${alertMeta.threshold}%`) : '—'}</div>
                      <div><span className="font-semibold text-foreground">Current Price:</span> {typeof alertMeta?.currentPrice === 'number' ? `$${alertMeta.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : '—'}</div>
                      <div><span className="font-semibold text-foreground">Triggered:</span> {formatTimestamp(alertMeta?.triggeredAt || item.createdAt)}</div>
                      {typeof alertMeta?.change === 'number' && (
                        <div><span className="font-semibold text-foreground">Δ vs Target:</span> {alertMeta.change >= 0 ? '+' : ''}{alertMeta.change.toFixed(2)}%</div>
                      )}
                    </div>
                    {item.body && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">{item.body}</p>
                    )}
                  </CardContent>
                ) : isSystem ? (
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                      {systemMeta?.body || item.body || 'System notification'}
                    </p>
                    {systemMeta?.meta && (
                      <pre className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground/80 overflow-x-auto">
                        {JSON.stringify(systemMeta.meta, null, 2)}
                      </pre>
                    )}
                  </CardContent>
                ) : (
                  item.body && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">{item.body}</p>
                    </CardContent>
                  )
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;


