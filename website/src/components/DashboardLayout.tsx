import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { getWebSocketUrl, apiFetch } from "@/lib/api";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { 
  Activity,
  BarChart3, 
  Bell,
  BellRing,
  BookOpen,
  Bookmark,
  DollarSign,
  Inbox,
  LineChart,
  LogOut,
  MessageSquare, 
  Newspaper,
  Settings, 
  SlidersHorizontal,
  TrendingUp, 
  User
} from "lucide-react";
import { getSession, setSession } from "@/lib/session";
import PlanBadge from "@/components/PlanBadge";
import joatLogo from "@/assets/joat-logo.png";
import ParticleBackground from "@/components/ParticleBackground";
import OnboardingTour, { TourStep } from "@/components/OnboardingTour";
import SkipOnboardingDialog from "@/components/SkipOnboardingDialog";
import TOSAcceptanceModal from "@/components/TOSAcceptanceModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

type MenuItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  hoverEmerald?: boolean;
  badgeCount?: number;
};

const MENU_TOUR_IDS: Record<string, string> = {
  "/dashboard": "nav-overview",
  "/dashboard/signals": "nav-signals",
  "/dashboard/watchlist": "nav-watchlist",
  "/dashboard/news": "nav-news",
  "/dashboard/prices": "nav-prices",
  "/dashboard/indicators": "nav-indicators",
  "/dashboard/alerts": "nav-alerts",
  "/dashboard/mentor": "nav-mentor",
  "/dashboard/notifications": "nav-notifications",
  "/dashboard/account": "nav-account",
  "/dashboard/settings": "nav-settings",
};

const SUPPORT_URL = "https://discord.gg/sjsJwdZPew";
const HELP_URL = "https://jackofalltrading.com";

const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getSession();
  const sessionUserId = React.useMemo(() => {
    // For dev login, use userId to differentiate between plans
    // For real users, use discordId (which is the primary key in DB)
    if (session?.userId && session.userId.startsWith('dev-')) {
      return String(session.userId);
    }
    if (session?.discordId) return String(session.discordId);
    if (session?.userId) return String(session.userId);
    return null;
  }, [session?.discordId, session?.userId]);
  const [, force] = React.useReducer((x) => x + 1, 0);
  const [isCmdOpen, setIsCmdOpen] = React.useState(false);
  const [cmdQuery, setCmdQuery] = React.useState("");
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });
  const headerRef = React.useRef<HTMLElement>(null);
  const pathnameRef = React.useRef(location.pathname);
  const [isTourOpen, setIsTourOpen] = React.useState(false);
  const [tourStep, setTourStep] = React.useState(0);
  const [showSkipDialog, setShowSkipDialog] = React.useState(false);
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = React.useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = React.useState<boolean | null>(null);
  const [tosAccepted, setTosAccepted] = React.useState<boolean | null>(null);
  const [showTosModal, setShowTosModal] = React.useState(false);

  React.useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  // Reset onboarding state when session changes
  React.useEffect(() => {
    setHasCheckedOnboarding(false);
    setOnboardingCompleted(null);
    setIsTourOpen(false);
    setTourStep(0);
    setTosAccepted(null);
    setShowTosModal(false);
  }, [sessionUserId]);

  React.useEffect(() => {
    if (!sessionUserId || !session || hasCheckedOnboarding || onboardingCompleted !== null) {
      return;
    }
    
    const checkOnboarding = async () => {
      try {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        // For dev login, send userId in header
        if (sessionUserId && sessionUserId.startsWith('dev-')) {
          headers['x-dev-user-id'] = sessionUserId;
        }
        
        const res = await apiFetch('/api/preferences', { 
          headers,
        });
        
        if (res.ok) {
          const data = await res.json();
          const prefs = data?.preferences || {};
          const completed = prefs.onboardingCompleted === true;
          const tosAcceptedFlag = prefs.tosAccepted === true && prefs.privacyAccepted === true;
          setOnboardingCompleted(completed);
          setTosAccepted(tosAcceptedFlag);

          if (!completed) {
            setShowTosModal(false);
            setTimeout(() => {
              setIsTourOpen(true);
            }, 600);
          } else if (!tosAcceptedFlag) {
            setTimeout(() => {
              setShowTosModal(true);
            }, 400);
          } else {
            setShowTosModal(false);
          }
        } else {
          console.warn('[Onboarding] API failed:', res.status);
          setOnboardingCompleted(false);
          setTimeout(() => {
            setIsTourOpen(true);
          }, 600);
          setTosAccepted(false);
          setShowTosModal(false);
        }
      } catch (err) {
        console.error('[Onboarding] Failed to check preferences:', err);
        setOnboardingCompleted(false);
        setTimeout(() => {
          setIsTourOpen(true);
        }, 600);
        setTosAccepted(false);
        setShowTosModal(false);
      } finally {
        setHasCheckedOnboarding(true);
      }
    };
    
    checkOnboarding();
  }, [sessionUserId, session, hasCheckedOnboarding, onboardingCompleted]);

  const canSeeSystemEntry = React.useCallback((entry: any) => {
    if (!entry || typeof entry !== 'object') return false;
    const meta = entry.meta && typeof entry.meta === 'object' ? entry.meta as Record<string, any> : {};
    if (meta && typeof meta === 'object') {
      if (typeof (meta as any).feedbackId !== 'undefined' && !session?.isAdmin) {
        return false;
      }
      const targetUserId = (meta as any).targetUserId;
      if (targetUserId != null) {
        const target = String(targetUserId);
        if (sessionUserId && target !== sessionUserId) {
          return false;
        }
      }
    }
    if (!session?.isAdmin && typeof entry.actionHref === 'string' && entry.actionHref.startsWith('/dashboard/admin')) {
      return false;
    }
    return true;
  }, [session?.isAdmin, sessionUserId]);

  const markTourComplete = React.useCallback(async () => {
    if (!sessionUserId) {
      setIsTourOpen(false);
      setShowSkipDialog(false);
      setTourStep(0);
      return;
    }
    
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      // For dev login, send userId in header
      if (sessionUserId.startsWith('dev-')) {
        headers['x-dev-user-id'] = sessionUserId;
      }
      
      // Save onboarding completion
      const res = await apiFetch('/api/preferences', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          preferences: {
            onboardingCompleted: true,
            onboardingCompletedAt: new Date().toISOString(),
          },
        }),
      });
      
      if (res.ok) {
        setOnboardingCompleted(true);
        
        try {
          const verifyRes = await apiFetch('/api/preferences', {
            headers,
          });
          
          if (verifyRes.ok) {
            const data = await verifyRes.json();
            const prefs = data?.preferences || {};
            const tosAcceptedFlag = prefs.tosAccepted === true && prefs.privacyAccepted === true;
            setTosAccepted(tosAcceptedFlag);
            if (!tosAcceptedFlag) {
              setTimeout(() => {
                setShowTosModal(true);
              }, 250);
            } else {
              setShowTosModal(false);
            }
          } else {
            console.error('[Onboarding] Failed to verify preferences:', verifyRes.status);
            setTosAccepted(false);
            setTimeout(() => {
              setShowTosModal(true);
            }, 250);
          }
        } catch (verifyErr) {
          console.error('[Onboarding] Verification error:', verifyErr);
          setTosAccepted(false);
          setTimeout(() => {
            setShowTosModal(true);
          }, 250);
        }
      } else {
        console.error('[Onboarding] Failed to save preferences:', res.status);
      }
    } catch (err) {
      console.error('[Onboarding] Failed to save preferences:', err);
    } finally {
      setIsTourOpen(false);
      setShowSkipDialog(false);
      setTourStep(0);
    }
  }, [sessionUserId]);

  const computeUnreadCount = React.useCallback(() => {
    try {
      const signalsRaw = JSON.parse(localStorage.getItem('joat:notifs:signals') || '[]');
      const alertsRaw = JSON.parse(localStorage.getItem('joat:notifs:alerts') || '[]');
      const systemRaw = JSON.parse(localStorage.getItem('joat:notifs:system') || '[]');
      const viewedRaw = JSON.parse(localStorage.getItem('joat:viewed:notifs') || '[]');
      const dismissedRaw = JSON.parse(localStorage.getItem('joat:dismissed:notifs') || '[]');
      const dismissedSet = new Set(Array.isArray(dismissedRaw) ? dismissedRaw : []);
      const viewedSet = new Set(Array.isArray(viewedRaw) ? viewedRaw : []);
      let count = 0;
      if (Array.isArray(signalsRaw)) {
        for (const entry of signalsRaw) {
          if (!entry) continue;
          const key = `signal:${entry.sourceId ?? entry.id}`;
          if (!dismissedSet.has(key) && !viewedSet.has(key)) count += 1;
        }
      }
      if (Array.isArray(alertsRaw)) {
        for (const entry of alertsRaw) {
          if (!entry) continue;
          const key = `alert:${entry.sourceId ?? entry.id}`;
          if (!dismissedSet.has(key) && !viewedSet.has(key)) count += 1;
        }
      }
      if (Array.isArray(systemRaw)) {
        for (const entry of systemRaw) {
          if (!entry) continue;
          if (!canSeeSystemEntry(entry)) continue;
          const key = `system:${entry.sourceId ?? entry.id}`;
          if (!dismissedSet.has(key) && !viewedSet.has(key)) count += 1;
        }
      }
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  }, [canSeeSystemEntry]);

  React.useEffect(() => {
    computeUnreadCount();
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === 'joat:notifs:signals' ||
        event.key === 'joat:notifs:alerts' ||
        event.key === 'joat:notifs:system' ||
        event.key === 'joat:dismissed:notifs' ||
        event.key === 'joat:viewed:notifs'
      ) {
        computeUnreadCount();
      }
    };
    const onSignalEvent = () => computeUnreadCount();
    const onAlertEvent = () => computeUnreadCount();
    const onSystemEvent = () => computeUnreadCount();
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
  }, [computeUnreadCount]);

  React.useEffect(() => {
    if (!session) return;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(getWebSocketUrl());
    } catch (error) {
      console.error('Failed to initialize notification websocket', error);
      return;
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message?.type === 'signal_added' && message.signal) {
          const payload = message.signal as Record<string, any>;
          const sourceId = payload.id ?? payload.signal_id ?? `${payload.symbol}-${payload.timestamp || Date.now()}`;
          const symbol = String(payload.displaySymbol || payload.symbol || '').toUpperCase();
          if (!symbol) return;
          const entry = {
            id: Date.now(),
            sourceId,
            symbol,
            type: String(payload.type || payload.signal_type || 'BUY').toUpperCase(),
            postedAt: payload.postedAt || payload.timestamp || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            priceValue: typeof payload.priceValue === 'number' ? payload.priceValue : (typeof payload.price === 'number' ? payload.price : null),
            summary: payload.summary || payload.description || '',
            assetType: payload.assetType || payload.asset_type || null,
          };
          try {
            const raw = JSON.parse(localStorage.getItem('joat:notifs:signals') || '[]');
            const existing = Array.isArray(raw) ? raw : [];
            const filtered = existing.filter((item: any) => item && item.sourceId !== entry.sourceId);
            const nextList = [entry, ...filtered].slice(0, 100);
            localStorage.setItem('joat:notifs:signals', JSON.stringify(nextList));
            window.dispatchEvent(new CustomEvent('joat:signals:notification', { detail: entry }));
            if (pathnameRef.current !== '/dashboard/signals') {
              toast.success(`New signal: ${entry.symbol} (${entry.type})`);
            }
            computeUnreadCount();
          } catch (storageErr) {
            console.warn('Failed to cache signal notification', storageErr);
          }
        } else if (message?.type === 'alert_triggered' && message.alert) {
          const payload = message.alert as Record<string, any>;
          const sourceId = payload.id ?? `alert:${payload.symbol}-${payload.createdAt || Date.now()}`;
          const symbol = String(payload.displaySymbol || payload.symbol || '').toUpperCase();
          if (!symbol) return;
          const triggeredAt = payload.triggeredAt || payload.createdAt || new Date().toISOString();
          const entry = {
            id: payload.id,
            sourceId,
            userId: payload.userId,
            symbol,
            type: String(payload.type || 'price').toUpperCase(),
            direction: payload.direction,
            threshold: payload.threshold,
            currentPrice: payload.currentPrice,
            assetType: payload.assetType || null,
            displaySymbol: payload.displaySymbol || null,
            displayName: payload.displayName || null,
            createdAt: triggeredAt,
            triggeredAt,
            active: typeof payload.active === 'boolean' ? payload.active : false,
            change: typeof payload.change === 'number' ? payload.change : null,
          };
          try {
            const raw = JSON.parse(localStorage.getItem('joat:notifs:alerts') || '[]');
            const existing = Array.isArray(raw) ? raw : [];
            const filtered = existing.filter((item: any) => item && item.sourceId !== entry.sourceId);
            const nextList = [entry, ...filtered].slice(0, 100);
            localStorage.setItem('joat:notifs:alerts', JSON.stringify(nextList));
            window.dispatchEvent(new CustomEvent('joat:alerts:notification', { detail: entry }));
            if (pathnameRef.current !== '/dashboard/alerts') {
              toast.info(`Alert: ${entry.symbol} ${entry.direction} ${entry.threshold} (Current: ${entry.currentPrice})`);
            }
            computeUnreadCount();
          } catch (storageErr) {
            console.warn('Failed to cache alert notification', storageErr);
          }
        } else if (message?.type === 'user_notification' && message.notification) {
          const targetId = String(message.userId || message.notification?.userId || '');
          const sessionId = session?.discordId ? String(session.discordId) : session?.userId ? String(session.userId) : '';
          if (!targetId || !sessionId || targetId !== sessionId) {
            return;
          }
          const notification = message.notification as Record<string, any>;
          const sourceId = String(notification.id || `${targetId}-${Date.now()}`);
          const entry = {
            id: sourceId,
            sourceId,
            title: String(notification.title || 'Notification'),
            body: typeof notification.body === 'string' ? notification.body : '',
            createdAt: notification.timestamp || new Date().toISOString(),
            level: String(notification.level || 'info').toLowerCase(),
            actionLabel: typeof notification.actionLabel === 'string' ? notification.actionLabel : null,
            actionHref: typeof notification.actionHref === 'string' ? notification.actionHref : null,
            meta: notification.meta || null,
          };
          try {
            const raw = JSON.parse(localStorage.getItem('joat:notifs:system') || '[]');
            const existing = Array.isArray(raw) ? raw : [];
            const filtered = existing.filter((item: any) => item && item.sourceId !== entry.sourceId);
            const nextList = [entry, ...filtered].slice(0, 100);
            localStorage.setItem('joat:notifs:system', JSON.stringify(nextList));
            window.dispatchEvent(new CustomEvent('joat:system:notification', { detail: entry }));
            const toastOptions = {
              description: entry.body,
              action: entry.actionLabel && entry.actionHref
                ? {
                    label: entry.actionLabel,
                    onClick: () => navigate(entry.actionHref!),
                  }
                : undefined,
            } as Parameters<typeof toast.info>[1];
            if (entry.level === 'success') {
              toast.success(entry.title, toastOptions);
            } else if (entry.level === 'warning') {
              toast.warning(entry.title, toastOptions);
            } else if (entry.level === 'error' || entry.level === 'danger') {
              toast.error(entry.title, toastOptions);
            } else {
              toast.info(entry.title, toastOptions);
            }
            computeUnreadCount();
          } catch (storageErr) {
            console.warn('Failed to cache system notification', storageErr);
          }
        } else if (message?.type === 'account_deleted') {
          const targetId = String(message.userId || '');
          const sessionId = session?.discordId ? String(session.discordId) : session?.userId ? String(session.userId) : '';
          if (targetId && sessionId && targetId === sessionId) {
            try {
              localStorage.removeItem('joat:notifs:signals');
              localStorage.removeItem('joat:notifs:alerts');
              localStorage.removeItem('joat:notifs:system');
              localStorage.removeItem('joat:dismissed:notifs');
              localStorage.removeItem(`joat:welcome:shown:${sessionId}`);
            } catch {}
            computeUnreadCount();
            toast.error(message?.message || 'Your account data has been deleted.');
            setSession(null);
            apiFetch('/api/logout', { method: 'POST' }).catch(() => {});
            setTimeout(() => {
              window.location.href = '/';
            }, 1500);
          }
        }
      } catch (err) {
        console.error('Failed to process notification payload', err);
      }
    };

    ws.onclose = () => {
      ws = null;
    };

    return () => {
      try { ws?.close(); } catch {}
    };
  }, [session, computeUnreadCount]);

  const planDisplay = React.useMemo(() => {
    const label = session?.isAdmin ? 'Admin' : (session?.plan || (session?.isSubscriber ? 'Pro' : 'Free'));
    const color = session?.isAdmin
      ? 'rgba(245,158,11,' // amber-500
      : label === 'Elite' ? 'rgba(6,182,212,' // cyan-500 (turquoise-like)
      : label === 'Pro' ? 'rgba(59,130,246,' // blue-500
      : label === 'Core' ? 'rgba(124,58,237,' // violet-600 (purple)
      : null;
    const style = color
      ? { textShadow: `0 0 6px ${color}0.55), 0 0 12px ${color}0.35)` }
      : undefined;
    return { label, style } as { label: string; style?: React.CSSProperties };
  }, [session]);

  const steps = React.useMemo<TourStep[]>(() => {
    const mentorAccess = session?.plan === "Pro" || session?.plan === "Elite" || !!session?.isAdmin;
    return [
      {
        id: "welcome",
        title: "Welcome to Jack Of All Trades",
        description: "We'll take a quick tour of the dashboard so you always know where to find signals, alerts, watchlists, mentor, and settings.",
        position: "center",
        primaryLabel: "Start Tour",
      },
      {
        id: "navigation",
        title: "Navigation Sidebar",
        description: "Use the sidebar to jump between every part of the platform. We'll highlight the most important areas next.",
        target: '[data-tour-id="sidebar-nav"]',
        position: "right",
      },
      {
        id: "signals",
        title: "Signals",
        description: "Live trade ideas, curated entries, and strategy callouts live here. Check back daily for fresh setups.",
        target: '[data-tour-id="nav-signals"]',
        position: "right",
      },
      {
        id: "alerts",
        title: "Price Alerts",
        description: "Create automated price alerts so you never miss a move. Alerts sync with your Discord notifications.",
        target: '[data-tour-id="nav-alerts"]',
        position: "right",
      },
      {
        id: "watchlist",
        title: "Watchlist",
        description: "Track tickers you're watching, organize them by priority, and manage entries quickly.",
        target: '[data-tour-id="nav-watchlist"]',
        position: "right",
      },
      {
        id: "mentor",
        title: "AI Mentor",
        description: mentorAccess
          ? "Chat with the mentor for breakdowns, trade reviews, or next steps. It's tuned to your profile and plan."
          : "Upgrade when you're ready for guided mentoring. Here you'll chat with the AI mentor for trade reviews and next steps.",
        target: '[data-tour-id="nav-mentor"]',
        position: "right",
      },
      {
        id: "notifications",
        title: "Realtime Notifications",
        description: "The bell keeps you updated with new signals, alerts, and system notices. You'll also see your unread counts here.",
        target: '[data-tour-id="header-notifications"]',
        position: "bottom",
      },
      {
        id: "account",
        title: "Account & Profile",
        description: "Manage your profile, plan, integrations, and billing details from the Account page.",
        target: '[data-tour-id="nav-account"]',
        position: "right",
      },
      {
        id: "settings",
        title: "Settings",
        description: "Tune preferences, notification options, and platform behavior from Settings whenever you need.",
        target: '[data-tour-id="nav-settings"]',
        position: "right",
      },
      {
        id: "support",
        title: "Need help or documentation?",
        description: "You're all set! Save this dashboard tour anytime from Account settings if you need a refresher.",
        position: "center",
        extraContent: (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Open a support ticket in Discord or browse the FAQ and docs on the main site whenever you have questions.</p>
          </div>
        ),
        actions: [
          {
            label: "Open Support",
            onClick: () => {
              navigate('/dashboard/account', { state: { openFeedback: true } });
            },
          },
          {
            label: "View Docs & FAQ",
            onClick: () => window.open(HELP_URL, "_blank"),
            variant: "outline",
          },
        ],
      },
    ];
  }, [session, navigate]);

  const totalSteps = steps.length;

  const handleNextStep = React.useCallback(() => {
    setTourStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [totalSteps]);

  const handlePrevStep = React.useCallback(() => {
    setTourStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleFinishTour = React.useCallback(() => {
    markTourComplete();
  }, [markTourComplete]);

  const handleSkipRequested = React.useCallback(() => {
    setShowSkipDialog(true);
  }, []);

  const handleSkipConfirmed = React.useCallback(() => {
    markTourComplete();
  }, [markTourComplete]);

  React.useEffect(() => {
    if (isTourOpen) {
      setTourStep(0);
    }
  }, [isTourOpen]);

  const handleLogout = () => {
    try {
      apiFetch('/api/logout', { method: 'POST' }).catch(() => {});
    } finally {
    setSession(null);
      toast.success('Logged out');
    navigate("/");
    }
  };

  const menuItems = React.useMemo<MenuItem[]>(() => {
    const items: MenuItem[] = [
    {
      title: "Overview",
      url: "/dashboard",
      icon: BarChart3,
      isActive: location.pathname === "/dashboard",
        hoverEmerald: false,
      },
      {
        title: "Prices",
        url: "/dashboard/prices",
        icon: DollarSign,
        isActive: location.pathname === "/dashboard/prices",
        hoverEmerald: true, // money green on hover
    },
    {
      title: "Indicators",
      url: "/dashboard/indicators",
      icon: LineChart,
      isActive: location.pathname === "/dashboard/indicators",
      hoverEmerald: false,
    },
    {
      title: "Signals",
      url: "/dashboard/signals",
      icon: TrendingUp,
      isActive: location.pathname === "/dashboard/signals",
        hoverEmerald: false,
    },
    {
      title: "Watchlist",
      url: "/dashboard/watchlist",
      icon: Bookmark,
      isActive: location.pathname === "/dashboard/watchlist",
        hoverEmerald: false,
    },
    {
      title: "News",
      url: "/dashboard/news",
      icon: Newspaper,
      isActive: location.pathname === "/dashboard/news",
        hoverEmerald: false,
    },
    {
      title: "Alerts",
      url: "/dashboard/alerts",
      icon: BellRing,
      isActive: location.pathname === "/dashboard/alerts",
        hoverEmerald: false,
    },
    {
      title: "Mentor",
      url: "/dashboard/mentor",
      icon: MessageSquare,
      isActive: location.pathname === "/dashboard/mentor",
        hoverEmerald: false,
    },
    {
      title: "Notifications",
      url: "/dashboard/notifications",
      icon: Inbox,
      isActive: location.pathname === "/dashboard/notifications",
        hoverEmerald: false,
        badgeCount: unreadCount,
    },
    {
      title: "Account",
      url: "/dashboard/account",
      icon: Settings,
      isActive: location.pathname === "/dashboard/account",
        hoverEmerald: false,
      },
      {
        title: "Settings",
        url: "/dashboard/settings",
        icon: SlidersHorizontal,
        isActive: location.pathname === "/dashboard/settings",
        hoverEmerald: false,
    },
  ];

    if (session?.isAdmin) {
      items.push({
        title: "Admin",
        url: "/dashboard/admin",
        icon: Activity,
        isActive: location.pathname === "/dashboard/admin",
        hoverEmerald: false,
      });
    }

    return items;
  }, [location.pathname, session?.isAdmin, unreadCount]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // React to session updates (e.g., username changes) without full reload
  React.useEffect(() => {
    const onSess = () => force();
    window.addEventListener('joat:session:update', onSess as any);
    return () => window.removeEventListener('joat:session:update', onSess as any);
  }, []);

  // One-time welcome toast per user per session
  React.useEffect(() => {
    if (!session) return;
    try {
      const id = session.userId || session.discordId || 'anon';
      const key = `joat:welcome:shown:${id}`;
      if (!localStorage.getItem(key)) {
        const name = session.username || session.discordUsername || 'there';
        toast.success(`Welcome, ${name}`);
        localStorage.setItem(key, '1');
      }
    } catch {}
  }, [session]);

  const commands = [
    { label: "Overview", path: "/dashboard" },
    { label: "Signals", path: "/dashboard/signals" },
    { label: "Watchlist", path: "/dashboard/watchlist" },
    { label: "Prices", path: "/dashboard/prices" },
    { label: "Indicators", path: "/dashboard/indicators" },
    { label: "News", path: "/dashboard/news" },
    { label: "Alerts", path: "/dashboard/alerts" },
    { label: "Mentor", path: "/dashboard/mentor" },
    { label: "Notifications", path: "/dashboard/notifications" },
    { label: "Account", path: "/dashboard/account" },
    { label: "Settings", path: "/dashboard/settings" },
    { label: "Docs", path: "/docs" },
  ];
  const filtered = commands.filter(c => c.label.toLowerCase().includes(cmdQuery.toLowerCase()));

  // When user visits Notifications tab, mark as read locally
  React.useEffect(() => {
    if (location.pathname === "/dashboard/notifications") {
      setUnreadCount(0);
    }
  }, [location.pathname]);

  // Mouse tracking for top bar glow effect
  React.useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = header.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    const handleMouseLeave = () => {
      setMousePosition({ x: -1000, y: -1000 }); // Hide glow when mouse leaves
    };

    header.addEventListener('mousemove', handleMouseMove);
    header.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      header.removeEventListener('mousemove', handleMouseMove);
      header.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <>
      <TOSAcceptanceModal
        open={showTosModal}
        onAccepted={async () => {
          if (!sessionUserId) {
            setTosAccepted(true);
            setShowTosModal(false);
            return;
          }

          const headers: HeadersInit = { 'Content-Type': 'application/json' };
          if (sessionUserId.startsWith('dev-')) {
            headers['x-dev-user-id'] = sessionUserId;
          }

          try {
            const verifyRes = await apiFetch('/api/preferences', {
              headers,
            });

            if (verifyRes.ok) {
              const data = await verifyRes.json();
              const prefs = data?.preferences || {};
              const accepted = prefs.tosAccepted === true && prefs.privacyAccepted === true;
              setTosAccepted(accepted);
              if (accepted) {
                setShowTosModal(false);
              } else {
                toast.error("We couldn't confirm your acceptance. Please try again.");
                setShowTosModal(true);
              }
            } else {
              toast.error("We couldn't confirm your acceptance. Please try again.");
              setTosAccepted(false);
              setShowTosModal(true);
            }
          } catch (err) {
            console.error('[TOS] Verification failed:', err);
            toast.error("We couldn't confirm your acceptance. Please try again.");
            setTosAccepted(false);
            setShowTosModal(true);
          }
        }}
        sessionUserId={sessionUserId}
      />
      <SidebarProvider>
      <div className="relative flex h-screen w-full overflow-hidden bg-gradient-hero">
        {/* Subtle animated particles behind content */}
        <ParticleBackground />
        <Sidebar variant="inset" className="border-r border-border/30">
          <SidebarHeader className="border-b border-border/30">
            <div className="flex items-center gap-3 px-2 py-4">
              <div className="relative overflow-hidden rounded-xl group/logo cursor-pointer flex-shrink-0">
                <div className="h-9 w-9 rounded-xl ring-1 ring-border overflow-hidden bg-background/50 shadow-sm transition-all duration-300 group-hover/logo:ring-primary/50 group-hover/logo:shadow-md group-hover/logo:shadow-primary/20">
                <img
                  src={joatLogo}
                  alt="JOAT Logo"
                    className="h-full w-full object-cover scale-110 transition-transform duration-300 group-hover/logo:scale-105"
                />
                </div>
                <span className="pointer-events-none absolute -inset-1 rounded-2xl bg-primary/10 blur-md transition-opacity duration-300 group-hover/logo:opacity-60" />
                {/* Shine effect */}
                <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-xl">
                  <div className="h-full w-[60%] bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover/logo:animate-[shine_0.8s_ease-in-out] skew-x-12" />
                </div>
              </div>
              <button
                className="group text-left transition-all duration-300 hover:translate-x-0.5 flex-1 min-w-0"
                onClick={() => navigate('/dashboard')}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[14px] sm:text-[15px] font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-primary/80 bg-clip-text text-transparent transition-all duration-300 group-hover:from-primary/90 group-hover:via-primary/80 group-hover:to-primary whitespace-nowrap">
                    JOAT Dashboard
                  </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-shrink-0">
                  <PlanBadge label={planDisplay.label} className="text-[10px]" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span>Your plan: {planDisplay.label}. Manage or upgrade in Account.</span>
                      </TooltipContent>
                    </Tooltip>
                </div>
                  <div className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-foreground/5 px-2 py-[2px] text-[10px] text-muted-foreground transition-all duration-300 group-hover:border-primary/40 group-hover:text-primary group-hover:bg-primary/5 group-hover:scale-105 w-fit">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/70 transition-all duration-300 group-hover:bg-primary group-hover:shadow-sm group-hover:shadow-primary/50" />
                  Trading Hub
                  </div>
                </div>
              </button>
            </div>
          </SidebarHeader>
          
          <SidebarContent data-tour-id="sidebar-nav">
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => {
                    const tourTarget = MENU_TOUR_IDS[item.url];
                    return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={item.isActive}
                        className={`group/navitem ${item.isActive ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
                      >
                        <button
                          className="flex items-center gap-3"
                          data-tour-id={tourTarget ?? undefined}
                          onClick={() => navigate(item.url)}
                        >
                          <span className="relative inline-flex">
                            <item.icon
                              className={`h-4 w-4 transition-colors duration-200 ${item.isActive ? 'text-primary' : item.hoverEmerald ? 'group-hover/navitem:text-emerald-400' : 'group-hover/navitem:text-yellow-400'}`}
                            />
                            {Number(item.badgeCount) > 0 && (
                              <span
                                className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive shadow-sm shadow-destructive/40 ring-2 ring-background animate-pulse"
                                aria-hidden="true"
                              />
                            )}
                          </span>
                          <span
                            className={`relative inline-flex items-center gap-2 transition-all duration-200 ease-out ${item.isActive ? 'text-primary font-semibold' : item.hoverEmerald ? 'group-hover/navitem:text-emerald-400' : 'group-hover/navitem:text-yellow-400'} group-hover/navitem:translate-x-0.5 after:absolute after:left-0 after:-bottom-0.5 after:h-0.5 after:w-0 after:rounded-full ${item.isActive ? 'after:w-full after:bg-primary/70' : item.hoverEmerald ? 'after:bg-emerald-400/70' : 'after:bg-yellow-400/70'} after:transition-[width] after:duration-300 group-hover/navitem:after:w-full`}
                          >
                            {item.title}
                            {Number(item.badgeCount) > 0 && (
                              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-destructive/90 px-1.5 py-[2px] text-[10px] leading-none text-white shadow-sm shadow-destructive/40">
                                {item.badgeCount > 99 ? '99+' : item.badgeCount}
                              </span>
                            )}
                          </span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-border/30 p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 p-2 h-auto">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session?.avatarUrl || session?.discordAvatarUrl} />
                    <AvatarFallback>
                      {(session?.username || session?.discordUsername || "U").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">{session?.username || session?.discordUsername}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                    <PlanBadge label={planDisplay.label} className="text-[11px]" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span>Your plan: {planDisplay.label}. Go to Account to upgrade.</span>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate("/dashboard/account")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Bell className="mr-2 h-4 w-4" />
                  Notifications
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="relative flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
          {/* Header */}
          <header 
            ref={headerRef}
            className="relative border-b border-border/30 bg-background/80 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.02)] overflow-hidden"
          >
            {/* Subtle top glow */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            
            {/* Mouse-following glow effect */}
            <div 
              className="pointer-events-none absolute z-0"
              style={{
                left: '0px',
                top: '0px',
                transform: `translate(${mousePosition.x}px, ${mousePosition.y}px) translate(-50%, -50%)`,
                opacity: mousePosition.x > 0 && mousePosition.y > 0 ? 0.6 : 0,
                transition: 'opacity 200ms ease-out',
                willChange: 'transform, opacity',
              }}
            >
              <div className="h-40 w-40 rounded-full bg-primary/25 blur-3xl" />
              <div className="absolute inset-0 h-20 w-20 rounded-full bg-primary/40 blur-2xl" />
            </div>
            
            <div className="relative flex h-16 items-center justify-between px-4 sm:px-6 z-10">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div>
                  <h1 className="text-xl font-semibold bg-gradient-to-r from-foreground via-foreground to-primary/70 bg-clip-text text-transparent">
                    {menuItems.find(item => item.isActive)?.title || "Dashboard"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Welcome back, {session?.username}
                  </p>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-3">
                <div className="relative">
                  <Input 
                    placeholder="Search (Cmd/Ctrl+K)" 
                    className="w-64 pl-3 pr-8 h-9 border-border/40 bg-background/50 backdrop-blur-sm shadow-sm hover:border-primary/30 hover:bg-background/70 transition-all" 
                    onFocus={() => setIsCmdOpen(true)}
                    readOnly
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`relative transition-all hover:bg-primary/10 hover:text-primary ${location.pathname === "/dashboard/notifications" ? "text-primary" : ""}`}
                  aria-label="Open notifications"
                  data-tour-id="header-notifications"
                  onClick={() => navigate("/dashboard/notifications")}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[10px] h-2.5 px-[3px] rounded-full bg-destructive text-[9px] leading-[10px] text-white flex items-center justify-center shadow-lg shadow-destructive/50 animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </div>
              
              {/* Enhanced accent strip with glow */}
              <div className="pointer-events-none absolute -bottom-[1px] left-0 right-0 h-[2px] overflow-hidden">
                <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent shadow-[0_0_8px_rgba(251,146,60,0.4),0_0_16px_rgba(251,146,60,0.2)]" />
                <div className="absolute inset-0 h-full w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60 animate-[shimmer_3s_ease-in-out_infinite] shadow-[0_0_12px_rgba(251,146,60,0.6)]" />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6 min-h-0">
            <Outlet />
          </main>
        </div>

        {/* Command Palette */}
        <Dialog open={isCmdOpen} onOpenChange={setIsCmdOpen}>
          <DialogContent className="w-full max-w-[95vw] p-0 overflow-hidden sm:max-w-lg [&>button.absolute]:hidden">
            <div className="border-b px-4 py-3">
              <Input 
                autoFocus 
                placeholder="Search destinations..." 
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
              />
            </div>
            <div className="max-h-80 overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">No results</div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.path}
                    className="w-full text-left px-4 py-2 hover:bg-foreground/5"
                    onClick={() => { setIsCmdOpen(false); navigate(c.path); }}
                  >
                    {c.label}
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {steps.length > 0 && (
          <OnboardingTour
            steps={steps}
            currentStep={tourStep}
            isOpen={isTourOpen}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
            onSkip={handleSkipRequested}
            onFinish={handleFinishTour}
          />
        )}

        <SkipOnboardingDialog
          open={showSkipDialog}
          onOpenChange={setShowSkipDialog}
          onConfirm={handleSkipConfirmed}
        />
      </div>
      </SidebarProvider>
    </>
  );
};

export default DashboardLayout;
