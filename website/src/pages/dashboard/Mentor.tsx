import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { 
  Send, 
  Bot, 
  TrendingUp,
  BookOpen,
  Lightbulb,
  Plus,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  Clipboard,
  Loader2,
  User,
  Pencil,
  RotateCcw,
  MoreVertical,
  Globe,
  Zap,
  Trash2,
  CircleStop,
  Pin,
  PinOff,
  Settings,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BarChart,
  TrendingDown,
  DollarSign,
  Calendar,
  Target,
  AlertTriangle,
  Newspaper
} from "lucide-react";
import { getSession } from "@/lib/session";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import JackPfp from "@/assets/JackOfAllKnowledge.png";
import joatGirl from "@/assets/jackofallknowledgeroundgirl.png";
import PlanBadge from "@/components/PlanBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePortfolioPricing } from "@/hooks/usePortfolioPricing";

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
  type?: "text" | "signal" | "analysis";
  meta?: {
    mode?: "default" | "max";
    startedAt?: number;
    thinkingMs?: number;
    streaming?: boolean;
    sources?: SourceLink[];
  };
}

type SourceLink = {
  label: string;
  url: string;
  domain?: string;
};

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

const Mentor: React.FC = () => {
  const welcomeMessageText = "Welcome. Share a market, symbol, or question and I'll help with clear, actionable insights.";
  const createWelcomeMessage = (): Message => ({
    id: `welcome-${Date.now()}`,
    content: welcomeMessageText,
    sender: "bot",
    timestamp: new Date(),
    type: "text",
  });
  const DEFAULT_MESSAGE_CAPACITY = 10;
  const MIN_MESSAGE_CAPACITY = 5;
  const MAX_MESSAGE_CAPACITY = 20;

  const [messageCapacity, setMessageCapacity] = useState(DEFAULT_MESSAGE_CAPACITY);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAddCoinOpen, setIsAddCoinOpen] = useState(false);
  const [coinSearch, setCoinSearch] = useState("");
  const [isMaxMode, setIsMaxMode] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "like" | "dislike" | undefined>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pinnedMap, setPinnedMap] = useState<Record<string, number>>({});
  const [portfolioPositions, setPortfolioPositions] = useState<PortfolioPosition[]>([]);
  const { positions: pricedPositions, totals: portfolioTotals, loading: portfolioPricingLoading } = usePortfolioPricing(portfolioPositions);
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
  const [tradingProfile, setTradingProfile] = useState<TradingProfile | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [pinnedDialogOpen, setPinnedDialogOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number>(() => (typeof window !== "undefined" ? window.innerWidth : 1024));
  const isMobile = viewportWidth < 640;
  const [sourceDialogState, setSourceDialogState] = useState<SourceLink[] | null>(null);
  const [profileForm, setProfileForm] = useState<TradingProfile>({
    skillLevel: "Intermediate",
    riskAppetite: "Balanced",
    focus: "Both",
    tradingStyle: "Swing trading",
    goals: "Grow account steadily",
  });
  const [thinkingState, setThinkingState] = useState<{ messageId: string | null; stages: string[]; activeIndex: number }>({
    messageId: null,
    stages: [],
    activeIndex: 0,
  });
  const session = getSession();
  const listRef = useRef<HTMLDivElement>(null);
  const streamingRef = useRef<{ id: string | null; timer: any }>({ id: null, timer: null });
  const messageModeRef = useRef<Record<string, "default" | "max">>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingMessageRef = useRef<string | null>(null);
  const cancelRequestedRef = useRef(false);
  const thinkingIntervalRef = useRef<number | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => new Set());

  const userIdentifier = React.useMemo(() => session?.discordId || session?.userId || "anon", [session?.discordId, session?.userId]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const totalMessageLimit = useMemo(() => Math.max(messageCapacity * 2, MIN_MESSAGE_CAPACITY * 2), [messageCapacity]);
  const historyLimit = useMemo(() => Math.min(40, Math.max(6, totalMessageLimit)), [totalMessageLimit]);

  const pinnedMessages = useMemo(() => {
    const pinned = messages.filter((m) => Boolean(pinnedMap[m.id]));
    return pinned.sort((a, b) => (pinnedMap[b.id] ?? 0) - (pinnedMap[a.id] ?? 0));
  }, [messages, pinnedMap]);

  const pinnedCount = pinnedMessages.length;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Derive per-user storage keys (used for optional local caching / prefill)
  const chatKey = useMemo(() => {
    const id = session?.discordId || session?.userId || "anon";
    return `joat:mentor-chat:${id}`;
  }, [session?.discordId, session?.userId]);

  const capacityKey = useMemo(() => {
    const id = session?.discordId || session?.userId || "anon";
    return `joat:mentor-capacity:${id}`;
  }, [session?.discordId, session?.userId]);

  const pinsKey = useMemo(() => {
    const id = session?.discordId || session?.userId || "anon";
    return `joat:mentor-pins:${id}`;
  }, [session?.discordId, session?.userId]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(capacityKey);
      if (!saved) return;
      const parsed = Number(saved);
      if (Number.isFinite(parsed)) {
        const normalized = Math.max(MIN_MESSAGE_CAPACITY, Math.min(MAX_MESSAGE_CAPACITY, Math.round(parsed)));
        setMessageCapacity(normalized);
      }
    } catch (error) {
      console.error('Failed to load message capacity:', error);
    }
  }, [capacityKey]);

  useEffect(() => {
    try {
      localStorage.setItem(capacityKey, String(messageCapacity));
    } catch (error) {
      console.error('Failed to save message capacity:', error);
    }
  }, [capacityKey, messageCapacity]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(pinsKey);
      if (!raw) {
        setPinnedMap({});
        return;
      }
      const parsed = JSON.parse(raw);
      const normalized: Record<string, number> = {};
      if (Array.isArray(parsed)) {
        parsed.forEach((id: any, idx: number) => {
          if (typeof id === 'string') normalized[id] = Date.now() + idx;
        });
      } else if (parsed && typeof parsed === 'object') {
        Object.entries(parsed).forEach(([id, ts]) => {
          if (typeof id === 'string') normalized[id] = Number(ts) || Date.now();
        });
      }
      setPinnedMap(normalized);
    } catch (error) {
      console.error('Failed to load pinned messages:', error);
      setPinnedMap({});
    }
  }, [pinsKey]);

  useEffect(() => {
    try {
      localStorage.setItem(pinsKey, JSON.stringify(pinnedMap));
    } catch (error) {
      console.error('Failed to save pinned messages:', error);
    }
  }, [pinsKey, pinnedMap]);

  useEffect(() => {
    setPinnedMap((prev) => {
      if (!prev || Object.keys(prev).length === 0) return prev;
      let changed = false;
      const next: Record<string, number> = {};
      Object.entries(prev).forEach(([id, ts]) => {
        if (messages.some((m) => m.id === id)) {
          next[id] = ts;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [messages]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length <= totalMessageLimit) return prev;
      return prev.slice(-totalMessageLimit);
    });
  }, [totalMessageLimit]);

  // Load messages from localStorage on mount or when user changes
  useEffect(() => {
    const savedMessages = localStorage.getItem(chatKey);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        // Convert timestamp strings back to Date objects
        const messagesWithDates = parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(messagesWithDates.length ? messagesWithDates : [createWelcomeMessage()]);
      } catch (error) {
        console.error('Failed to load chat history:', error);
        setMessages([createWelcomeMessage()]);
      }
    } else {
      setMessages([createWelcomeMessage()]);
    }
  }, [chatKey]);

  useEffect(() => {
    let cancel = false;
    const loadServerHistory = async () => {
      try {
        const res = await apiFetch('/api/mentor/chat/history');
        if (!res.ok) throw new Error('history_failed');
        const data = await res.json();
        if (cancel) return;
        const serverMessages = Array.isArray(data?.messages) ? data.messages : [];
        const clamp = (val: number) => Math.max(MIN_MESSAGE_CAPACITY, Math.min(MAX_MESSAGE_CAPACITY, Math.round(val)));
        if (data?.settings?.messageCapacity) {
          const clamped = clamp(Number(data.settings.messageCapacity));
          setMessageCapacity(clamped);
          try { localStorage.setItem(capacityKey, String(clamped)); } catch {}
        }
        if (serverMessages.length > 0) {
          const normalized = serverMessages.map((msg: any, idx: number) => {
            const id = String(msg?.messageId || msg?.id || crypto.randomUUID());
            const created = msg?.created_at ? new Date(msg.created_at) : new Date();
            const metaSources = Array.isArray(msg?.metadata?.sources) ? msg.metadata.sources : [];
            return {
              id,
              content: String(msg?.content ?? ''),
              sender: String(msg?.role || 'assistant').startsWith('assistant') ? 'bot' : 'user',
              timestamp: created,
              type: 'text' as const,
              meta: {
                mode: msg?.mode === 'max' ? 'max' : 'default',
                sources: metaSources,
              },
            } as Message;
          });
          setMessages(normalized.length ? normalized : [createWelcomeMessage()]);
          const pinnedNormalized: Record<string, number> = {};
          serverMessages.forEach((msg: any, idx: number) => {
            if (msg?.pinned) {
              const mappedId = String(msg?.messageId || normalized[idx]?.id || `server-${idx}`);
              pinnedNormalized[mappedId] = Date.now() + idx;
            }
          });
          setPinnedMap(pinnedNormalized);
          try {
            localStorage.setItem(chatKey, JSON.stringify(normalized.map((msg) => ({
              ...msg,
              timestamp: msg.timestamp.toISOString(),
            }))));
            localStorage.setItem(pinsKey, JSON.stringify(Object.keys(pinnedNormalized)));
          } catch {}
        }
      } catch (err) {
        console.warn('Failed to load mentor history from server:', err?.message || err);
      } finally {
        if (!cancel) setHistoryLoading(false);
      }
    };
    loadServerHistory();
    return () => { cancel = true; };
  }, [chatKey, capacityKey, pinsKey]);

  // Optional prefill from other pages (e.g., Coin Details → Ask Mentor)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('joat:mentor:prefill');
      const auto = localStorage.getItem('joat:mentor:autorun');
      const symbolPrefill = localStorage.getItem('joat:mentor:prefillSymbol');
      if (raw) {
        localStorage.removeItem('joat:mentor:prefill');
        if (symbolPrefill) localStorage.removeItem('joat:mentor:prefillSymbol');
        const text = JSON.parse(raw);
        if (typeof text === 'string' && text.trim()) {
          if (auto === '1') {
            localStorage.removeItem('joat:mentor:autorun');
            setTimeout(() => sendPrompt(text, { silent: true, symbol: symbolPrefill || undefined }), 0);
          } else {
            setInputValue(text);
          }
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/profile/trading');
        if (!res.ok) return;
        const data = await res.json();
        if (data?.profile) {
          setTradingProfile(data.profile as TradingProfile);
          setProfileForm(data.profile as TradingProfile);
        }
      } catch {}
    })();
  }, []);

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(chatKey, JSON.stringify(messages));
    }
  }, [messages, chatKey]);

  // Auto-scroll when thinking stages update (if user is at bottom)
  useEffect(() => {
    if (!thinkingState.messageId || thinkingState.stages.length === 0) return;
    
    const list = listRef.current;
    if (!list) return;

    // Check if user is near the bottom (within 200px threshold)
    const isNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 200;
    
    if (isNearBottom) {
      // Small delay to allow DOM update, then scroll smoothly
      setTimeout(() => {
        if (list) {
          list.scrollTo({
            top: list.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [thinkingState.activeIndex, thinkingState.stages.length, thinkingState.messageId]);

  useEffect(() => {
    if (historyLoading) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const res = await apiFetch('/api/mentor/chat/settings', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageCapacity }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('settings_failed');
        try { localStorage.setItem(capacityKey, String(messageCapacity)); } catch {}
      } catch (err) {
        console.warn('mentor_settings_sync_failed', err);
      }
    }, 400);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [messageCapacity, historyLoading, capacityKey]);

  const quickActions = [
    {
      title: "Market Analysis",
      description: "Get current market insights",
      icon: TrendingUp,
      prompt: "What's the current market sentiment for crypto?",
      category: "Market"
    },
    {
      title: "Trading Education",
      description: "Learn trading concepts",
      icon: BookOpen,
      prompt: "Explain risk management in trading",
      category: "Education"
    },
    {
      title: "Portfolio Review",
      description: "Analyze your holdings",
      icon: Lightbulb,
      prompt: "Review my current portfolio and suggest improvements",
      category: "Portfolio"
    },
    {
      title: "Price Prediction",
      description: "Forecast asset prices",
      icon: Target,
      prompt: "What's the price prediction for Bitcoin over the next month?",
      category: "Analysis"
    },
    {
      title: "Entry Strategy",
      description: "Best entry points",
      icon: TrendingDown,
      prompt: "What's the best entry strategy for ETH right now?",
      category: "Strategy"
    },
    {
      title: "Exit Strategy",
      description: "When to take profits",
      icon: TrendingUp,
      prompt: "What's a good exit strategy for my current positions?",
      category: "Strategy"
    },
    {
      title: "News Impact",
      description: "How news affects markets",
      icon: Newspaper,
      prompt: "How might recent crypto news impact the market?",
      category: "Market"
    },
    {
      title: "Technical Analysis",
      description: "Chart patterns & indicators",
      icon: BarChart,
      prompt: "Perform a technical analysis on BTC/USD",
      category: "Analysis"
    },
    {
      title: "Risk Assessment",
      description: "Evaluate trade risks",
      icon: AlertTriangle,
      prompt: "What are the risks of holding X coin?",
      category: "Risk"
    },
    {
      title: "Market Trends",
      description: "Identify current trends",
      icon: Sparkles,
      prompt: "What are the current trending cryptocurrencies?",
      category: "Market"
    },
    {
      title: "Portfolio Diversification",
      description: "Balance your portfolio",
      icon: Lightbulb,
      prompt: "How should I diversify my crypto portfolio?",
      category: "Portfolio"
    },
    {
      title: "Support & Resistance",
      description: "Find key price levels",
      icon: Target,
      prompt: "What are the key support and resistance levels for Bitcoin?",
      category: "Analysis"
    },
    {
      title: "Trading Psychology",
      description: "Mindset & emotions",
      icon: BookOpen,
      prompt: "How do I manage trading emotions and avoid FOMO?",
      category: "Education"
    },
    {
      title: "Position Sizing",
      description: "Calculate position size",
      icon: DollarSign,
      prompt: "How should I size my positions based on risk?",
      category: "Strategy"
    },
    {
      title: "Market Cycles",
      description: "Understand market phases",
      icon: Calendar,
      prompt: "What phase of the market cycle are we in?",
      category: "Education"
    }
  ];

  const [showAllPrompts, setShowAllPrompts] = useState(false);
  const visiblePrompts = showAllPrompts ? quickActions : quickActions.slice(0, 3);
  
  // Check if chat is empty (only welcome message)
  const isEmptyChat = useMemo(() => {
    return messages.length <= 1 && (messages.length === 0 || (messages[0]?.sender === "bot" && messages[0]?.content === welcomeMessageText));
  }, [messages]);

  // Source name to URL mapping
  const sourceUrlMap: Record<string, string> = {
    'coindesk': 'https://www.coindesk.com',
    'cointelegraph': 'https://cointelegraph.com',
    'bloomberg': 'https://www.bloomberg.com/crypto',
    'bloomberg crypto news': 'https://www.bloomberg.com/crypto',
    'reuters': 'https://www.reuters.com/business/finance',
    'forbes': 'https://www.forbes.com/crypto-blockchain',
    'decrypt': 'https://decrypt.co',
    'the block': 'https://www.theblock.co',
    'cointelegraph news': 'https://cointelegraph.com',
    'coindesk news': 'https://www.coindesk.com',
    'crypto news': 'https://cointelegraph.com',
  };

  const convertSourceToLink = (text: string): React.ReactNode => {
    const trimmed = String(text).trim();
    const lower = trimmed.toLowerCase();
    
    // Check if it's already a link
    if (trimmed.match(/^\[.*\]\(https?:\/\/.+\)$/)) {
      return text;
    }
    
    // Check if it matches a known source
    for (const [name, url] of Object.entries(sourceUrlMap)) {
      if (lower.includes(name)) {
        return (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline decoration-primary/40 decoration-dotted hover:text-primary/80 transition-colors"
          >
            {trimmed}
          </a>
        );
      }
    }
    
    return text;
  };

  const markdownComponents = useMemo(() => ({
    h3: ({ node, className, children, ...props }: any) => {
      // Hide Sources header if it's empty (only has "No external sources" or similar)
      if (typeof children === 'string' && children.toLowerCase().includes('sources')) {
        const nextSibling = node?.nextSibling;
        if (nextSibling && nextSibling.type === 'paragraph') {
          const text = String(nextSibling.children?.[0]?.value || '').toLowerCase();
          if (text.includes('no external') || text.includes('no sources')) {
            return null;
          }
        }
      }
      return <h3 className={`mt-4 mb-2 text-sm font-semibold text-primary/90 first:mt-0 tracking-wide ${className || ""}`} {...props}>{children}</h3>;
    },
    p: ({ node, className, children, ...props }: any) => {
      // Hide paragraphs that say "No external sources"
      if (typeof children === 'string' && children.toLowerCase().includes('no external sources')) {
        return null;
      }
      return <p className={`text-sm leading-[1.7] text-foreground/90 tracking-wide ${className || ""}`} {...props}>{children}</p>;
    },
    ul: ({ node, className, ...props }: any) => {
      // Check if this is in a Sources section
      const isSources = node?.parent?.children?.some((sibling: any) => 
        sibling.type === 'heading' && 
        sibling.children?.some((child: any) => 
          typeof child.value === 'string' && child.value.toLowerCase().includes('sources')
        )
      );
      return (
        <ul 
          className={`ml-4 list-disc space-y-2 text-sm leading-[1.7] ${isSources ? 'text-foreground/90' : 'text-foreground/90'} ${className || ""}`} 
          {...props} 
        />
      );
    },
    ol: ({ node, className, ...props }: any) => (
      <ol className={`ml-4 list-decimal space-y-1 text-sm text-foreground/90 leading-[1.7] ${className || ""}`} {...props} />
    ),
    li: ({ node, className, children, ...props }: any) => {
      // Check if we're in a Sources list and convert text to links
      const isInSources = node?.parent?.parent?.children?.some((sibling: any) => 
        sibling.type === 'heading' && 
        sibling.children?.some((child: any) => 
          typeof child.value === 'string' && child.value.toLowerCase().includes('sources')
        )
      );
      
      if (isInSources) {
        // Convert children to string if possible
        const childrenStr = Array.isArray(children) 
          ? children.map((c: any) => typeof c === 'string' ? c : (c?.props?.children || '')).join('')
          : (typeof children === 'string' ? children : String(children || ''));
        
        if (childrenStr && !childrenStr.includes('http') && !childrenStr.includes('[')) {
          // Check if it matches a known source
          const lower = childrenStr.toLowerCase().trim();
          for (const [name, url] of Object.entries(sourceUrlMap)) {
            if (lower.includes(name) || name.includes(lower)) {
              return (
                <li className={`leading-relaxed ${className || ""}`} {...props}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline decoration-primary/40 decoration-dotted hover:text-primary/80 transition-colors"
                  >
                    {childrenStr.trim()}
                  </a>
                </li>
              );
            }
          }
        }
      }
      
      return <li className={`leading-[1.7] ${className || ""}`} {...props}>{children}</li>;
    },
    strong: ({ node, className, ...props }: any) => (
      <strong className={`font-semibold text-foreground ${className || ""}`} {...props} />
    ),
    hr: () => <div className="my-4 h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />,
    a: ({ node, href, className, children, ...props }: any) => (
      <a
        href={href || "#"}
        target="_blank"
        rel="noreferrer"
        className={`text-primary underline decoration-primary/40 decoration-dotted hover:text-primary/80 transition-colors ${className || ""}`}
        {...props}
      >
        {children}
      </a>
    ),
  }), []);

  const getPromptForMessage = React.useCallback((id: string) => {
    const index = messages.findIndex((m) => m.id === id);
    if (index <= 0) return "";
    for (let i = index - 1; i >= 0; i -= 1) {
      if (messages[i]?.sender === 'user' && messages[i]?.content) {
        return messages[i].content;
      }
    }
    return "";
  }, [messages]);

  const submitFeedback = async (
    messageId: string,
    reaction: "like" | "dislike" | "clear",
    response: string,
    prompt?: string,
    mode?: "default" | "max"
  ) => {
    if (!response || !response.trim()) return;
    try {
      await apiFetch('/api/mentor/feedback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          reaction,
          response,
          prompt: prompt || '',
          mode: mode || 'default'
        })
      });
    } catch (error) {
      console.error('mentor_feedback_failed', error);
    }
  };

  async function sendPrompt(prompt: string, options?: { silent?: boolean; symbol?: string; mode?: "default" | "max" }) {
    if (!prompt.trim() || isLoading) return;
    const silent = options?.silent ?? false;
    const selectedMode = options?.mode || (isMaxMode ? "max" : "default");
    const historySliceCount = Math.max(0, Math.min(messages.length, historyLimit));
    const historyPayload = messages
      .slice(-historySliceCount)
      .map((msg) => ({
        role: msg.sender === "bot" ? "assistant" : "user",
        content: msg.content
      }))
      .filter((entry) => typeof entry.content === "string" && entry.content.trim().length > 0);

    const startedAt = performance.now();
    setIsLoading(true);
    cancelRequestedRef.current = false;
    const userMessageId = Date.now().toString();
    const botId = (Date.now() + 1).toString();

    if (!silent) {
    const userMessage: Message = {
      id: userMessageId,
        content: prompt,
        sender: 'user',
      timestamp: new Date(),
        type: 'text',
      };
      setMessages(prev => [...prev, userMessage].slice(-totalMessageLimit));
    setInputValue("");
    }

    setMessages(prev => [...prev, {
      id: botId,
      content: "",
      sender: 'bot' as const,
      timestamp: new Date(),
      type: 'text' as const,
      meta: {
        mode: selectedMode,
        startedAt,
        streaming: true,
        sources: [],
      }
    }].slice(-totalMessageLimit));
    setFeedbackMap(prev => ({ ...prev, [botId]: undefined }));
    messageModeRef.current[botId] = selectedMode;
    pendingMessageRef.current = botId;
    startThinkingStages(botId, prompt, webSearchEnabled);

    const payload: Record<string, unknown> = { message: prompt, mode: selectedMode, history: historyPayload, webSearchEnabled, messageId: userMessageId, responseId: botId, capacity: messageCapacity };
    if (options?.symbol) payload.symbol = options.symbol;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await apiFetch('/api/mentor/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const data = await res.json();

      if (!res.ok) {
        // Specific handling for profile / plan related errors
        if (data?.error === 'profile_required') {
          const msg = 'Please fill in your trading profile before using the mentor.';
          setMessages(prev => prev.map(m => m.id === botId ? {
            ...m,
            content: msg,
            meta: { ...(m.meta || {}), streaming: false }
          } : m).slice(-totalMessageLimit));
          return;
        }
      }
      if (data?.settings?.messageCapacity) {
        const serverCap = Math.max(MIN_MESSAGE_CAPACITY, Math.min(MAX_MESSAGE_CAPACITY, Math.round(Number(data.settings.messageCapacity))));
        setMessageCapacity(serverCap);
        try { localStorage.setItem(capacityKey, String(serverCap)); } catch {}
      }
      if (data?.profile) setTradingProfile(data.profile as TradingProfile);
      const answer = data?.answer || 'Please fill in your trading profile before using the mentor.';
      const sources = parseSources(data?.sources, answer);
      const thinkingMs = performance.now() - startedAt;
      stopThinkingStages();
      animateMessage(botId, answer, sources, thinkingMs);
    } catch (error: any) {
      if (error?.name === 'AbortError' && cancelRequestedRef.current) {
        stopThinkingStages();
        return;
      }
      stopThinkingStages();
      setMessages(prev => prev.map(m => m.id === botId ? {
        ...m,
        content: 'Sorry, I could not process that right now.',
        meta: { ...(m.meta || {}), streaming: false }
      } : m).slice(-totalMessageLimit));
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      pendingMessageRef.current = null;
      cancelRequestedRef.current = false;
      stopThinkingStages();
      setIsLoading(false);
    }
  }

  const toggleFeedback = (message: Message, value: "like" | "dislike") => {
    const current = feedbackMap[message.id];
    const next = current === value ? undefined : value;
    setFeedbackMap(prev => ({ ...prev, [message.id]: next }));
    const prompt = getPromptForMessage(message.id);
    const mode = messageModeRef.current[message.id] || 'default';
    submitFeedback(message.id, next ? value : "clear", message.content, prompt, mode);
  };

  const handleCopyMessage = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId(prev => (prev === id ? null : prev));
      }, 2000);
    } catch (error) {
      console.error('mentor_copy_failed', error);
    }
  };

  const formatTimestamp = (date: Date) => {
    try {
      return format(date, "hh:mm a");
    } catch {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const formatCurrency = useCallback((value?: number | null) => {
    if (value == null || Number.isNaN(value)) return "—";
    return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  const formatPercent = useCallback((value?: number | null) => {
    if (value == null || Number.isNaN(value)) return "—";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  }, []);

  const parseSources = useCallback((raw: any, text?: string): SourceLink[] => {
    const map = new Map<string, SourceLink>();
    const push = (url?: string, label?: string) => {
      if (!url) return;
      try {
        const parsed = new URL(url);
        const domain = parsed.hostname.replace(/^www\./, '');
        const key = parsed.href;
        if (!map.has(key)) {
          map.set(key, {
            label: label || domain,
            url: parsed.href,
            domain,
          });
        }
      } catch {}
    };
    if (Array.isArray(raw)) {
      raw.forEach((entry) => push(entry?.url, entry?.label));
    }
    if (text) {
      const regex = /(https?:\/\/[^\s)]+)(?![^[]*\])/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        push(match[1]);
      }
    }
    return Array.from(map.values()).slice(0, 8);
  }, []);

  const animateMessage = useCallback((id: string, fullText: string, sources: SourceLink[], thinkingMs: number) => {
    if (streamingRef.current.timer) {
      clearTimeout(streamingRef.current.timer);
    }
    const total = fullText.length;
    const stepSize = Math.max(2, Math.ceil(total / 180));
    const interval = total > 1500 ? 8 : 14;
    let index = 0;

    const step = () => {
      index = Math.min(total, index + stepSize);
      setMessages(prev => prev.map(m => m.id === id ? {
        ...m,
        content: fullText.slice(0, index),
        meta: {
          ...m.meta,
          thinkingMs,
          streaming: index < total,
          sources,
        }
      } : m).slice(-totalMessageLimit));
      if (index < total) {
        streamingRef.current = { id, timer: window.setTimeout(step, interval) };
      } else {
        streamingRef.current = { id: null, timer: null };
      }
    };

    step();
  }, [setMessages, totalMessageLimit]);

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
      })));
    } catch {}
  }, []);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

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

  const handleSendMessage = async () => {
    await sendPrompt(inputValue);
  };

  const handleQuickAction = (prompt: string) => {
    if (isLoading) return;
    setInputValue(prompt);
  };

  const handleMessageCapacityChange = (value: number[]) => {
    if (!Array.isArray(value) || value.length === 0) return;
    const proposed = Math.round(value[0]);
    const next = Math.max(MIN_MESSAGE_CAPACITY, Math.min(MAX_MESSAGE_CAPACITY, proposed));
    setMessageCapacity(next);
  };

  const togglePinnedMessage = (message: Message) => {
    if (!message?.id || !message.content?.trim()) return;
    const wasPinned = Boolean(pinnedMap[message.id]);
    const nextMap = { ...pinnedMap };
    if (wasPinned) {
      delete nextMap[message.id];
    } else {
      nextMap[message.id] = Date.now();
    }
    setPinnedMap(nextMap);
    try { localStorage.setItem(pinsKey, JSON.stringify(Object.keys(nextMap))); } catch {}
    apiFetch('/api/mentor/chat/pin', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: message.id, pinned: !wasPinned }),
    }).then((res) => {
      if (!res.ok) throw new Error('pin_failed');
    }).catch((err) => {
      console.warn('mentor_pin_failed', err);
      setPinnedMap((prev) => {
        const revert = { ...prev };
        if (wasPinned) revert[message.id] = Date.now(); else delete revert[message.id];
        try { localStorage.setItem(pinsKey, JSON.stringify(Object.keys(revert))); } catch {}
        return revert;
      });
      toast.error('Could not update pinned message');
    });
  };

  const clearAllPinned = () => {
    const ids = Object.keys(pinnedMap);
    setPinnedMap({});
    try { localStorage.removeItem(pinsKey); } catch {}
    ids.forEach((id) => {
      apiFetch('/api/mentor/chat/pin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: id, pinned: false }),
      }).catch((err) => console.warn('mentor_pin_clear_failed', err));
    });
  };

  const startThinkingStages = (messageId: string, prompt: string, usingWebSearch: boolean) => {
    const sanitized = prompt.replace(/\s+/g, " ").trim() || "your request";
    const truncated = sanitized.length > 52 ? `${sanitized.slice(0, 49)}...` : sanitized;
    
    let stages: string[] = [];
    if (usingWebSearch) {
      stages = [
        `Understanding "${truncated}"`,
        "Searching financial news sites",
        "Scanning crypto market sources",
        "Reading trading analysis",
        "Gathering latest insights",
        "Synthesizing findings"
      ];
    } else {
      stages = [
        `Understanding "${truncated}"`,
        "Reviewing your context",
        "Crafting response"
      ];
    }
    
    if (thinkingIntervalRef.current) window.clearInterval(thinkingIntervalRef.current);
    setThinkingState({ messageId, stages, activeIndex: 0 });
    let step = 0;
    const interval = usingWebSearch ? 1200 : 1800;
    thinkingIntervalRef.current = window.setInterval(() => {
      step += 1;
      setThinkingState((prev) => {
        if (prev.messageId !== messageId) return prev;
        const nextIndex = Math.min(step, stages.length - 1);
        if (nextIndex === prev.activeIndex) return prev;
        if (nextIndex >= stages.length - 1 && thinkingIntervalRef.current) {
          window.clearInterval(thinkingIntervalRef.current);
          thinkingIntervalRef.current = null;
        }
        return { ...prev, activeIndex: nextIndex };
      });
    }, interval);
  };

  const stopThinkingStages = () => {
    if (thinkingIntervalRef.current) {
      window.clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
    }
    setThinkingState({ messageId: null, stages: [], activeIndex: 0 });
  };

  const cancelCurrentRequest = (skipToast = false) => {
    if (!abortControllerRef.current && !pendingMessageRef.current) return;
    cancelRequestedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    const pendingId = pendingMessageRef.current;
    if (pendingId) {
      setMessages((prev) => prev.map((message) =>
        message.id === pendingId
          ? {
              ...message,
              content: 'Request canceled.',
              meta: message.meta ? { ...message.meta, streaming: false } : { streaming: false },
            }
          : message
      ).slice(-totalMessageLimit));
      pendingMessageRef.current = null;
    }
    setIsLoading(false);
    stopThinkingStages();
    if (!skipToast) toast('Canceled');
  };

  const doClearChat = () => {
    cancelCurrentRequest(true);
    const isWelcomeOnly = messages.length <= 1 && messages[0]?.sender === "bot" && messages[0]?.content === welcomeMessageText;
    if (isWelcomeOnly) {
      toast.info('Chat is already fresh.');
      setClearConfirmOpen(false);
      return;
    }
    if (streamingRef.current.timer) {
      clearTimeout(streamingRef.current.timer);
      streamingRef.current = { id: null, timer: null };
    }
    setIsLoading(false);
    setInputValue("");
    setFeedbackMap({});
    messageModeRef.current = {};
    setPinnedMap({});
    try {
      localStorage.removeItem(pinsKey);
    } catch {}
    const welcome = createWelcomeMessage();
    setMessages([welcome]);
    localStorage.setItem(chatKey, JSON.stringify([welcome]));
    apiFetch('/api/mentor/chat/history', { method: 'DELETE' }).catch((err) => {
      console.warn('mentor_history_clear_failed', err);
    });
    setClearConfirmOpen(false);
    toast.success('Chat history cleared.');
  };

  const handleClearChat = () => setClearConfirmOpen(true);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Group consecutive messages by sender for cleaner bubbles
  const groups = useMemo(() => {
    const out: Array<{ sender: Message["sender"]; items: Message[] }> = [];
    messages.forEach((m) => {
      const last = out[out.length - 1];
      if (!last || last.sender !== m.sender) out.push({ sender: m.sender, items: [m] });
      else last.items.push(m);
    });
    return out;
  }, [messages]);

  // Auto-scroll to bottom when messages update or loading changes
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  // Cleanup streaming interval on unmount
  useEffect(() => {
    return () => {
      if (streamingRef.current.timer) clearInterval(streamingRef.current.timer);
      if (thinkingIntervalRef.current) window.clearInterval(thinkingIntervalRef.current);
    };
  }, []);

  const userContext = useMemo(() => ({
    username: session?.username || session?.discordUsername || "User",
    plan: session?.isAdmin ? "Admin" : (session?.plan || (session?.isSubscriber ? "Pro" : "Free")),
    defaultTimeframe: "1h",
    risk: "Moderate",
  }), [session]);

  const portfolioSummary = useMemo<PortfolioPreview | null>(() => {
    if (pricedPositions.length) {
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
    }

    const normalize = (items: any[]) => items.map((item) => {
      const quantity = item.quantity != null ? Number(item.quantity) : null;
      const costBasis = item.costBasis != null ? Number(item.costBasis) : (item.cost_basis != null ? Number(item.cost_basis) : null);
      const targetPrice = item.targetPrice != null ? Number(item.targetPrice) : (item.target_price != null ? Number(item.target_price) : null);
      return {
        symbol: String(item.symbol || '').toUpperCase(),
        quantity: Number.isFinite(quantity) ? quantity : null,
        costBasis: Number.isFinite(costBasis) ? costBasis : null,
        targetPrice: Number.isFinite(targetPrice) ? targetPrice : null,
      };
    }).filter((entry) => entry.symbol);

    let normalized: { symbol: string; quantity: number | null; costBasis: number | null; targetPrice: number | null; }[] = [];

    try {
      const raw = localStorage.getItem("joat:portfolio");
      if (portfolioPositions.length) {
        normalized = normalize(portfolioPositions);
      } else if (raw) {
      const data = JSON.parse(raw);
      const holdings = Array.isArray(data?.holdings) ? data.holdings : [];
        normalized = normalize(holdings);
      }
    } catch {}

    if (!normalized.length) return null;

    const totalInvested = normalized.reduce((sum, position) => {
      const shares = position.quantity ?? 0;
      const basis = position.costBasis ?? 0;
      if (!Number.isFinite(shares) || !Number.isFinite(basis)) return sum;
      return sum + shares * basis;
    }, 0);

    const activeTargets = normalized.filter((position) => position.targetPrice != null).length;

    const topHoldings = normalized
      .slice()
      .sort((a, b) => {
        const exposureA = (a.quantity ?? 0) * (a.costBasis ?? 0);
        const exposureB = (b.quantity ?? 0) * (b.costBasis ?? 0);
        return exposureB - exposureA;
      })
      .slice(0, 4)
      .map((position) => ({
        symbol: position.symbol,
        quantity: position.quantity,
        costBasis: position.costBasis,
        currentPrice: null,
        currentValue: position.quantity != null && position.costBasis != null ? position.quantity * position.costBasis : null,
        plValue: null,
        plPercent: null,
      }));

    return {
      count: normalized.length,
      totalInvested,
      currentValue: totalInvested,
      plValue: 0,
      plPercent: null,
      activeTargets,
      topHoldings,
    };
  }, [portfolioPositions, pricedPositions, portfolioTotals]);

  return (
    <>
    {/* Clear Chat Confirm */}
    <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear chat?</DialogTitle>
          <DialogDescription>
            This will remove the entire conversation from this device. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={doClearChat}>Clear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {/* Pinned messages dialog */}
    <Dialog open={pinnedDialogOpen} onOpenChange={setPinnedDialogOpen}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pinned messages</DialogTitle>
          <DialogDescription>All pinned responses from this session.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto space-y-3 pr-1">
          {pinnedMessages.length === 0 ? (
            <div className="rounded-lg border border-border/40 bg-card/60 p-6 text-center text-sm text-muted-foreground">
              No pinned messages yet.
            </div>
          ) : (
            pinnedMessages.map((pinned) => (
              <div key={pinned.id} className="relative rounded-xl border border-border/40 bg-card/80 p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <Bot className="h-3.5 w-3.5" />
                  <span>Mentor</span>
                  <span className="text-muted-foreground/60">&middot;</span>
                  <span>{formatTimestamp(pinned.timestamp)}</span>
                </div>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents as any}>
                  {pinned.content}
                </ReactMarkdown>
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => togglePinnedMessage(pinned)}
                    className="gap-1"
                  >
                    <PinOff className="h-3.5 w-3.5" />
                    Unpin
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          {pinnedMessages.length > 0 && (
            <Button variant="destructive" onClick={clearAllPinned}>Clear all</Button>
          )}
          <DialogClose asChild>
            <Button type="button" variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {/* Mobile settings dialog */}
    <Dialog open={mobileSettingsOpen} onOpenChange={setMobileSettingsOpen}>
      <DialogContent className="h-[90vh] max-w-[95vw] p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/40 px-4 py-3">
          <DialogTitle>Settings & Tools</DialogTitle>
          <DialogDescription>Adjust preferences and access quick actions</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 px-4 py-3">
          {/* Quick prompts */}
          <Card className="animate-comedown border-border/40 bg-card/80 backdrop-blur transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
            <CardHeader>
              <CardTitle className="text-base">Quick prompts</CardTitle>
              <CardDescription>Jumpstart a conversation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-1.5">
                {visiblePrompts.map((action, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="group w-full justify-between h-auto px-2 py-1.5 rounded-md hover:bg-primary/10 border border-border/50 hover:border-primary/40 transition-all duration-300 hover:shadow-sm hover:shadow-primary/10 hover:-translate-y-0.5 hover:scale-[1.02]"
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => { handleQuickAction(action.prompt); setMobileSettingsOpen(false); }}
                    disabled={isLoading}
                  >
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <action.icon className="h-3 w-3 flex-shrink-0 text-muted-foreground transition-all duration-300 group-hover:text-primary group-hover:scale-110" />
                      <div className="flex flex-col items-start min-w-0 flex-1">
                        <span className="text-xs font-medium transition-colors duration-300 group-hover:text-foreground">{action.title}</span>
                        <span className="text-[9px] text-muted-foreground/70 truncate w-full transition-colors duration-300 group-hover:text-muted-foreground">{action.description}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-3 w-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300 flex-shrink-0 ml-1.5" />
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  className="w-full justify-center gap-1.5 h-auto py-1.5 rounded-md hover:bg-primary/10 border border-border/50 hover:border-primary/40 transition-all duration-300 hover:shadow-sm hover:shadow-primary/10 hover:-translate-y-0.5 text-[10px] text-muted-foreground hover:text-primary"
                  onClick={() => setShowAllPrompts(!showAllPrompts)}
                >
                  {showAllPrompts ? (
                    <>
                      <ChevronUp className="h-3 w-3 transition-transform duration-300" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 transition-transform duration-300" />
                      Show More ({quickActions.length - 3} more)
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Trading profile */}
          <Card className="animate-comedown border-border/40 bg-card/80 backdrop-blur transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5" style={{ animationDelay: '100ms' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary transition-all duration-300 hover:scale-110 hover:bg-primary/20 hover:shadow-md hover:shadow-primary/20">
                  <User className="h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-110" />
                </div>
                <div>
                  <CardTitle className="text-base">Trading profile</CardTitle>
                  <CardDescription className="text-xs">Customize your preferences</CardDescription>
                </div>
              </div>
              <Button size="sm" variant="outline" className="transition-all duration-300 hover:border-primary hover:bg-primary/10 hover:shadow-sm hover:shadow-primary/10 hover:-translate-y-0.5 hover:scale-105 group" onClick={() => { setProfileDialogOpen(true); setMobileSettingsOpen(false); }}>
                <Pencil className="mr-1.5 h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-12" />
                Edit
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {tradingProfile ? (
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Skill</div>
                    <div className="font-medium text-sky-400">{tradingProfile.skillLevel}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Risk</div>
                    <div className="font-medium text-amber-400">{tradingProfile.riskAppetite}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Focus</div>
                    <div className="font-medium text-emerald-400">{tradingProfile.focus}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Style</div>
                    <div className="font-medium text-violet-400 truncate">{tradingProfile.tradingStyle}</div>
                  </div>
                  {tradingProfile.goals && (
                    <div className="col-span-2 space-y-1 mt-1 pt-2 border-t border-border/40">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Goals</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{tradingProfile.goals}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-xs text-muted-foreground mb-2">No trading profile yet</p>
                  <Button size="sm" variant="outline" onClick={() => { setProfileDialogOpen(true); setMobileSettingsOpen(false); }}>
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
              {portfolioSummary && (
                <div className="mt-3 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-medium text-primary mb-3">
                    <span>Portfolio snapshot</span>
                    <span>{portfolioSummary.count} holdings</span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {portfolioSummary.topHoldings.map((holding) => {
                      const position = pricedPositions.find(p => p.symbol === holding.symbol);
                      const plClass = holding.plValue != null
                        ? holding.plValue > 0 ? 'text-success' : holding.plValue < 0 ? 'text-destructive' : 'text-muted-foreground'
                        : 'text-muted-foreground';
                      return (
                        <div
                          key={holding.symbol}
                          className="flex items-center gap-3 rounded-xl border border-border/20 bg-background/70 px-3 py-2 shadow-inner"
                        >
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/20 text-xs font-semibold text-primary/90">
                            {holding.symbol.slice(0, 3)}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between text-[12px] font-medium text-foreground/90">
                              <span>{holding.symbol}</span>
                              <span className="text-muted-foreground text-[11px] font-normal">
                                {holding.currentValue != null ? formatCurrency(holding.currentValue) : '—'}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground/80">
                              {holding.quantity != null ? (
                                <span>{holding.quantity} {holding.quantity === 1 ? 'unit' : 'units'}</span>
                              ) : (
                                <span>Qty —</span>
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
                          {position && (
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
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 space-y-2 text-[11px] text-muted-foreground/80">
                    <div className="flex items-center justify-between">
                      <span>Invested capital</span>
                      <span className="text-right font-medium text-foreground">
                        {formatCurrency(portfolioSummary.totalInvested)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Current value</span>
                      <span className="text-right font-medium text-foreground">
                        {formatCurrency(portfolioSummary.currentValue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Unrealized P/L</span>
                      <span className={`text-right font-medium ${portfolioSummary.plValue > 0 ? 'text-success' : portfolioSummary.plValue < 0 ? 'text-destructive' : 'text-foreground'}`}>
                        {formatCurrency(portfolioSummary.plValue)}{portfolioSummary.plPercent != null ? ` (${formatPercent(portfolioSummary.plPercent)})` : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Targets set</span>
                      <span className="text-right font-medium text-foreground">
                        {portfolioSummary.activeTargets}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Insights */}
          <Card className="border-border/40 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Insights</CardTitle>
              </div>
              <CardDescription className="text-xs">Session overview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/40 bg-background/60 p-2.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Messages</div>
                  <div className="text-lg font-semibold text-foreground">{messages.filter(m => m.sender === 'user').length}</div>
                </div>
                <div className="rounded-lg border border-border/40 bg-background/60 p-2.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Avg Response</div>
                  <div className="text-lg font-semibold text-foreground">
                    {(() => {
                      const botMessages = messages.filter(m => m.sender === 'bot' && m.meta?.thinkingMs);
                      if (botMessages.length === 0) return '—';
                      const avg = botMessages.reduce((sum, m) => sum + (m.meta.thinkingMs || 0), 0) / botMessages.length;
                      return `${(avg / 1000).toFixed(1)}s`;
                    })()}
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-border/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Message capacity</div>
                    <p className="text-[11px] text-muted-foreground/80">Mentor keeps this many of your latest turns.</p>
                  </div>
                  <span className="text-base font-semibold text-primary">{messageCapacity}</span>
                </div>
                <div className="space-y-2">
                  <Slider
                    value={[messageCapacity]}
                    min={MIN_MESSAGE_CAPACITY}
                    max={MAX_MESSAGE_CAPACITY}
                    step={1}
                    onValueChange={(value) => handleMessageCapacityChange(value)}
                    className="mt-1"
                    aria-label="Message capacity"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{MIN_MESSAGE_CAPACITY} msgs</span>
                    <span>{MAX_MESSAGE_CAPACITY} msgs</span>
                  </div>
                </div>
              </div>
              {portfolioSummary && (
                <div className="pt-3 border-t border-border/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Portfolio</span>
                    <div className="text-right text-[11px] leading-tight">
                      <div className="font-medium text-primary">{portfolioSummary.count} assets</div>
                      <div className="text-muted-foreground">{formatCurrency(portfolioSummary.currentValue)}</div>
                      <div className={`${portfolioSummary.plValue > 0 ? 'text-success' : portfolioSummary.plValue < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {formatCurrency(portfolioSummary.plValue)}{portfolioSummary.plPercent != null ? ` (${formatPercent(portfolioSummary.plPercent)})` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {portfolioSummary.topHoldings.map((holding) => (
                      <span
                        key={`summary-${holding.symbol}`}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary"
                      >
                        <span>{holding.symbol}</span>
                        {holding.quantity != null && (
                          <span className="text-primary/70">{holding.quantity}</span>
                        )}
                        {holding.plPercent != null && (
                          <span className={holding.plPercent > 0 ? 'text-success' : holding.plPercent < 0 ? 'text-destructive' : 'text-primary/70'}>
                            {formatPercent(holding.plPercent)}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <DialogFooter className="border-t border-border/40 px-4 py-3">
          <DialogClose asChild>
            <Button type="button" variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={!!sourceDialogState} onOpenChange={(open) => { if (!open) setSourceDialogState(null); }}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sources</DialogTitle>
          <DialogDescription>Tap a source to open it in a new tab.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 pt-2">
          {sourceDialogState?.map((source) => (
            <div key={source.url} className="w-full">
              <SourceChip source={source} />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
    <div className="relative -mx-4 flex h-[calc(100vh-4rem)] -mt-6 flex-col overflow-hidden bg-transparent px-1 sm:mx-0 sm:px-0 lg:-mt-6 lg:flex-row lg:gap-6 lg:h-[calc(100vh-5.5rem)]">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 z-30 h-9 w-9 rounded-full border border-border/50 bg-background/90 text-muted-foreground shadow-lg shadow-black/20 backdrop-blur transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary lg:hidden"
        onClick={() => setMobileSettingsOpen(true)}
        aria-label="Settings"
      >
        <Settings className="h-4 w-4" />
      </Button>
        {/* Chat Interface */}
      <div className="order-1 flex-1 min-w-0 min-h-0 lg:order-1">
        <Card className="relative flex h-full min-h-0 flex-col rounded-3xl border-0 !bg-transparent bg-transparent shadow-none backdrop-blur-0 sm:rounded-[28px] lg:mx-0 lg:border-0 lg:!bg-transparent lg:shadow-none lg:backdrop-blur-0">
            <div className="pointer-events-none absolute inset-x-6 top-2 hidden h-20 rounded-full bg-gradient-to-b from-primary/25 via-primary/5 to-transparent blur-3xl opacity-70 lg:block" />
            {/* Floating images - only show when empty */}
            {isEmptyChat && (
              <>
                <img 
                  src={JackPfp} 
                  alt="" 
                  className="absolute top-20 left-12 w-32 h-32 opacity-40 floating-image pointer-events-none hidden lg:block"
                  style={{ animationDelay: '0s' }}
                />
                <img 
                  src={joatGirl} 
                  alt="" 
                  className="absolute bottom-32 right-16 w-36 h-36 opacity-40 floating-image pointer-events-none hidden lg:block"
                  style={{ animationDelay: '1s' }}
                />
              </>
            )}
            
            {/* Empty state prompts - above chatbar when empty */}
            {isEmptyChat && (
              <div className="flex-1 flex items-center justify-center px-4 pb-4 pt-8 animate-in fade-in duration-500">
                <div className="w-full max-w-2xl space-y-3">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold mb-2 bg-gradient-to-r from-foreground via-foreground to-primary/80 bg-clip-text text-transparent">
                      Get started with a quick prompt
                    </h3>
                    <p className="text-sm text-muted-foreground">Choose a prompt below to begin your conversation</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {quickActions.slice(0, 4).map((action, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="group justify-start h-auto px-4 py-3 rounded-xl border border-border/50 hover:border-primary/50 bg-background/60 hover:bg-primary/10 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4"
                        style={{ animationDelay: `${index * 100}ms` }}
                        onClick={async () => {
                          await sendPrompt(action.prompt);
                        }}
                        disabled={isLoading}
                      >
                        <action.icon className="h-5 w-5 mr-3 text-muted-foreground transition-colors duration-300 group-hover:text-primary" />
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-medium transition-colors duration-300 group-hover:text-foreground">{action.title}</span>
                          <span className="text-xs text-muted-foreground transition-colors duration-300 group-hover:text-muted-foreground/80">{action.description}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 ml-auto opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Messages */}
            <div 
              ref={listRef} 
              className={`flex-1 min-h-0 overflow-y-auto space-y-4 p-3 pt-10 pb-14 sm:p-5 sm:pt-12 lg:pt-8 scrollbar transition-opacity duration-500 ${
                isEmptyChat ? 'opacity-0 absolute inset-0 pointer-events-none' : 'opacity-100'
              }`}
            >
                {groups.map((group, gi) => (
                  <div key={gi} className={`flex ${group.sender === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`flex items-end gap-3 ${group.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
                      {/* Avatar shown once per group */}
                      <div className="self-end">
                        {group.sender === "bot" ? (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={JackPfp} />
                            <AvatarFallback>
                              <Bot className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={session?.avatarUrl || session?.discordAvatarUrl} />
                            <AvatarFallback>
                              {(session?.username || session?.discordUsername || "U").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                      {/* Bubble stack */}
                      <div className="flex flex-col gap-2 max-w-[96%] sm:max-w-[82%]">
                        {group.items.map((message) => {
                          const isBot = group.sender === "bot";
                          const feedback = feedbackMap[message.id];
                          const meta = message.meta || {};
                          const thinkingDisplay = meta.streaming
                            ? (thinkingState.messageId === message.id && thinkingState.stages.length
                                ? thinkingState.stages[Math.min(thinkingState.activeIndex, thinkingState.stages.length - 1)]
                                : 'thinking…')
                            : meta.thinkingMs != null
                              ? `responded in ${(meta.thinkingMs / 1000).toFixed(2)}s`
                              : undefined;
                          const showLoader = isBot && !message.content;
                          const isPinned = Boolean(pinnedMap[message.id]);
                          const baseBubbleClasses = isBot
                            ? "bg-card/95 border-border/60 rounded-bl-sm border-l-2 border-l-primary/50 shadow-md hover:shadow-lg transition-all duration-200"
                            : "bg-primary/10 border-primary/20 text-foreground rounded-br-sm shadow-sm hover:shadow-md transition-all duration-200";
                          const pinnedClasses = isPinned ? "ring-1 ring-primary/40 border-primary/40 shadow-lg shadow-primary/20" : "";
                          const bubblePadding = isBot ? "pr-9" : "";

                          return (
                          <div
                            key={message.id}
                              className={`group/message relative rounded-2xl px-4 py-3 text-sm leading-relaxed border transition-all duration-200 ${baseBubbleClasses} ${pinnedClasses} ${bubblePadding}`}
                            >
                              {isBot && !showLoader && message.content && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    togglePinnedMessage(message);
                                  }}
                                  aria-label={isPinned ? "Unpin message" : "Pin message"}
                                  aria-pressed={isPinned}
                                  className={`absolute top-2 right-2 rounded-full border border-border/50 bg-background/80 p-1 text-muted-foreground transition-all hover:border-primary/40 hover:text-primary ${isPinned ? 'border-primary/50 bg-primary/15 text-primary shadow-sm animate-in fade-in zoom-in-95' : ''}`}
                          >
                                  <Pin className={`h-3.5 w-3.5 ${isPinned ? 'fill-current' : ''}`} />
                                </button>
                              )}
                              {isBot && (
                                <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                <Bot className="h-3.5 w-3.5" />
                                <span className="font-medium">Mentor</span>
                                  </span>
                                  {meta.mode === 'max' && (
                                    <Badge className="hidden h-5 border-primary/40 bg-primary/10 text-primary lg:inline-flex" variant="outline">Max</Badge>
                                  )}
                                  {isPinned && (
                                    <Badge className="h-5 border-primary/40 bg-primary/10 text-primary animate-in fade-in" variant="outline">Pinned</Badge>
                                  )}
                              </div>
                            )}

                              {isBot && meta.mode === 'max' && meta.thinkingMs != null && !meta.streaming && (
                                <div className="mb-2 text-[10px] text-muted-foreground/70 italic">
                                  Thought for {((meta.thinkingMs || 0) / 1000).toFixed(1)}s
                                </div>
                              )}

                              <div className="space-y-2">
                                {isBot ? (
                                  <div>
                                    {showLoader && (
                                      <div className="flex flex-col gap-3 py-2 animate-in fade-in duration-300">
                                        {thinkingState.messageId === message.id && thinkingState.stages.length > 0 ? (
                                          <div className="space-y-2">
                                            {thinkingState.stages.slice(0, thinkingState.activeIndex + 1).map((stage, idx) => (
                                              <div
                                                key={idx}
                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all duration-500 ${
                                                  idx === thinkingState.activeIndex
                                                    ? 'bg-primary/10 border-primary/30 text-foreground'
                                                    : 'bg-muted/30 border-border/20 text-muted-foreground opacity-60'
                                                }`}
                                              >
                                                <Loader2 className={`h-3.5 w-3.5 ${idx === thinkingState.activeIndex ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
                                                <span className="text-xs font-medium">{stage}</span>
                                                {idx === thinkingState.activeIndex && (
                                                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            <span>Thinking...</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {!showLoader && (
                                      <div className="animate-in fade-in slide-in-from-bottom-3 duration-300 font-normal tracking-wide [&_p]:leading-[1.7] [&_li]:leading-[1.7]">
                                        <ReactMarkdown
                                          remarkPlugins={[remarkGfm]}
                                          components={markdownComponents as any}
                                        >
                              {message.content}
                                        </ReactMarkdown>
                                        {meta.streaming && (
                                          <span className="ml-1 inline-block h-4 w-2 align-[-2px] rounded-sm bg-primary/70 animate-pulse" />
                              )}
                            </div>
                                    )}
                          </div>
                                ) : (
                                  <p className="whitespace-pre-wrap text-sm leading-[1.7] text-foreground tracking-wide font-normal">
                                    {message.content}
                                  </p>
                                )}
                            </div>

                              {isBot && !showLoader && !meta.streaming && meta.sources && Array.isArray(meta.sources) && meta.sources.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                  {meta.sources.map((source) => (
                                    <SourceChip key={source.url} source={source} />
                        ))}
                      </div>
                              )}

                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-2">
                                  {formatTimestamp(message.timestamp)}
                                  {isBot && meta.thinkingMs != null && !meta.streaming && (
                                    <span className="text-[9px] text-muted-foreground/70">• {((meta.thinkingMs || 0) / 1000).toFixed(1)}s</span>
                                  )}
                                </span>
                                {isBot && message.content && !showLoader && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const prompt = getPromptForMessage(message.id);
                                        if (prompt) {
                                          await sendPrompt(prompt, { mode: meta.mode || 'default' });
                                        }
                                      }}
                                      className="flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 transition-all hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
                                      title="Regenerate response"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                      <span className="hidden sm:inline">Regenerate</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleFeedback(message, "like")}
                                      className={`flex items-center gap-1 rounded-full border px-2 py-1 transition-all focus:outline-none focus:ring-1 focus:ring-primary/40 ${
                                        feedback === "like"
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "border-border/60 hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
                                      }`}
                                      aria-pressed={feedback === "like"}
                                    >
                                      <ThumbsUp className="h-3.5 w-3.5" />
                                      <span className="hidden sm:inline">Like</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleFeedback(message, "dislike")}
                                      className={`flex items-center gap-1 rounded-full border px-2 py-1 transition-all focus:outline-none focus:ring-1 focus:ring-primary/40 ${
                                        feedback === "dislike"
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "border-border/60 hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
                                      }`}
                                      aria-pressed={feedback === "dislike"}
                                    >
                                      <ThumbsDown className="h-3.5 w-3.5" />
                                      <span className="hidden sm:inline">Dislike</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyMessage(message.id, message.content)}
                                      className={`flex items-center gap-1 rounded-full border px-2 py-1 transition-all focus:outline-none focus:ring-1 focus:ring-primary/40 ${
                                        copiedId === message.id
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "border-border/60 hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
                                      }`}
                                    >
                                      <Clipboard className="h-3.5 w-3.5" />
                                      <span className="hidden sm:inline">{copiedId === message.id ? "Copied" : "Copy"}</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}

            </div>

            {/* Disclaimer */}
            <div className="px-6 pt-0 pb-0 text-center">
              <p className="text-[7px] text-muted-foreground/60">This is not financial advice, trade at your own risk.</p>
            </div>

            {/* Input */}
            <div className="sticky bottom-0 px-2 pb-3 pt-2 sm:px-4 lg:px-6 lg:pb-3 lg:pt-3">
              <div className={`flex flex-col gap-3 rounded-3xl border border-border/25 bg-background/70 px-3 py-3 shadow-2xl shadow-black/15 backdrop-blur-sm transition-all duration-500 sm:px-4 sm:py-3.5 lg:px-5 lg:py-4 ${isEmptyChat ? 'chatbar-glow' : ''}`}>
              <div className={`relative z-10 flex flex-wrap items-center justify-between gap-1 sm:gap-2 text-[11px] text-muted-foreground transition-opacity duration-500 ${isEmptyChat ? 'opacity-60' : 'opacity-100'}`}>
                <div className="flex flex-nowrap items-center gap-2 sm:gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                <Button
                        type="button"
                  variant="outline"
                  size="icon"
                        className="relative h-7 w-7 sm:h-8 sm:w-8 rounded-full border-border/50 text-muted-foreground transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                        aria-label="Pinned messages"
                      >
                        <Pin className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        {pinnedCount > 0 && (
                          <span className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-primary text-[9px] font-semibold text-background">
                            {pinnedCount}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[min(92vw,24rem)] space-y-3 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pinned ({pinnedCount})</span>
                        <div className="flex items-center gap-2">
                          {pinnedCount > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={() => setPinnedDialogOpen(true)}
                                className="rounded-full border border-border/50 px-2 py-0.5 text-[10px] font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                              >
                                Expand
                              </button>
                              <button
                                type="button"
                                onClick={clearAllPinned}
                                className="text-[10px] font-medium text-destructive hover:underline"
                              >
                                Clear all
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {pinnedCount === 0 ? (
                        <p className="text-xs text-muted-foreground/80">No pinned messages yet.</p>
                      ) : (
                        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                          {pinnedMessages.map((pinned) => (
                            <div key={pinned.id} className="relative rounded-lg border border-border/40 bg-card/80 p-3 text-xs shadow-sm">
                              <button
                                type="button"
                                className="absolute top-2 right-2 rounded-full p-1 text-muted-foreground transition-colors hover:text-destructive"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  togglePinnedMessage(pinned);
                                }}
                                aria-label="Unpin message"
                              >
                                <PinOff className="h-3.5 w-3.5" />
                              </button>
                              <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                                <Bot className="h-3 w-3" />
                                <span>Mentor</span>
                                <span className="text-muted-foreground/60">&middot;</span>
                                <span>{formatTimestamp(pinned.timestamp)}</span>
                              </div>
                              <div className="space-y-2 text-foreground/90">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents as any}>
                                  {pinned.content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 sm:gap-2 ml-3 lg:ml-2">
                        <div className="relative inline-flex items-center">
                          <Switch 
                            id="mentor-max-mode" 
                            checked={isMaxMode} 
                            onCheckedChange={setIsMaxMode} 
                            className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-primary data-[state=checked]:via-primary/80 data-[state=checked]:to-primary data-[state=unchecked]:bg-input/60 h-5 w-8 sm:h-7 sm:w-12 transition-all duration-300 hover:scale-105" 
                          />
                          <div className="pointer-events-none absolute inset-0 flex items-center">
                            {isMaxMode && (
                              <Zap className="absolute left-1 sm:left-2 z-10 h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 text-background/90 transition-all duration-200 animate-in fade-in" />
                            )}
                          </div>
                        </div>
                        <Label htmlFor="mentor-max-mode" className="cursor-pointer text-[10px] sm:text-[11px] font-medium text-muted-foreground" onClick={() => setIsMaxMode(!isMaxMode)}>Max mode</Label>
                        {isMaxMode && <Badge className="hidden border border-primary/40 bg-primary/10 px-1.5 py-0 text-[9px] uppercase tracking-wide text-primary lg:inline-flex">Deep</Badge>}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8} avoidCollisions>
                      <p className="text-xs">Deeper analysis with more context</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-pressed={webSearchEnabled}
                          onClick={() => setWebSearchEnabled((prev) => !prev)}
                          className={`h-7 w-7 rounded-full border transition-all duration-300 sm:h-9 sm:w-9 ${webSearchEnabled ? 'border-blue-500 bg-blue-500/15 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.35)] hover:scale-110 hover:shadow-[0_0_16px_rgba(59,130,246,0.5)]' : 'border-border/50 text-muted-foreground hover:border-blue-400 hover:text-blue-400 hover:scale-110 hover:shadow-md hover:shadow-blue-400/20'} active:scale-95`}
                          aria-label="Toggle web search"
                        >
                          <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <span className="cursor-pointer text-[10px] sm:text-[11px] font-medium text-muted-foreground" onClick={() => setWebSearchEnabled((prev) => !prev)}>Web search</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Toggle web search for real-time information.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  {(thinkingState.messageId || isLoading) && (
                    <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-muted-foreground animate-in fade-in slide-in-from-left-3 duration-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span className="text-xs font-medium transition-all duration-300">
                        {thinkingState.stages[thinkingState.activeIndex] || 'Mentor is thinking...'}
                      </span>
                    </div>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full border border-border/50 text-muted-foreground transition-all duration-300 hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive hover:scale-110 hover:shadow-md hover:shadow-destructive/20 sm:h-9 sm:w-9 active:scale-95"
                        onClick={handleClearChat}
                        disabled={isLoading}
                        aria-label="Clear chat"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Clear chat history</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className={`relative z-10 flex items-center gap-2 transition-opacity duration-500 ${isEmptyChat ? 'opacity-60' : 'opacity-100'}`}>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full border-border/40 sm:h-9 sm:w-9 lg:h-10 lg:w-10"
                  onClick={() => setIsAddCoinOpen(true)}
                  disabled={isLoading}
                >
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about a symbol..."
                  disabled={isLoading}
                        className="flex-1 rounded-full border-border/40 bg-background/85 px-3 text-[11px] placeholder:text-[11px] sm:px-4 sm:text-sm sm:placeholder:text-sm shadow-inner shadow-black/10 transition-all duration-300 hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0 focus-visible:scale-[1.02]"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="h-8 min-w-[64px] rounded-full px-3 sm:h-9 sm:min-w-[80px] sm:px-4 lg:h-10 lg:min-w-[96px] transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                  <span className="ml-1.5 hidden text-xs sm:inline sm:text-sm">{isLoading ? 'Sending…' : 'Send'}</span>
                </Button>
                {isLoading && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 rounded-full border border-destructive/50 px-2 text-destructive transition-all hover:bg-destructive/10 sm:h-9 sm:px-3 lg:h-10"
                    onClick={() => cancelCurrentRequest()}
                  >
                    <CircleStop className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="ml-1.5 hidden text-xs sm:inline">Stop</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
          </Card>
        </div>

        {/* Right column - Desktop only */}
        <div className="hidden lg:block order-2 w-80 space-y-4 overflow-y-auto pr-2">
          <Card className="animate-comedown border-border/40 bg-card/80 backdrop-blur transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle className="text-base">Quick prompts</CardTitle>
              <CardDescription>Jumpstart a conversation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-1.5">
                {visiblePrompts.map((action, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="group w-full justify-between h-auto px-2 py-1.5 rounded-md hover:bg-primary/10 border border-border/50 hover:border-primary/40 transition-all duration-300 hover:shadow-sm hover:shadow-primary/10 hover:-translate-y-0.5 hover:scale-[1.02]"
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => handleQuickAction(action.prompt)}
                    disabled={isLoading}
                  >
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <action.icon className="h-3 w-3 flex-shrink-0 text-muted-foreground transition-all duration-300 group-hover:text-primary group-hover:scale-110" />
                      <div className="flex flex-col items-start min-w-0 flex-1">
                        <span className="text-xs font-medium transition-colors duration-300 group-hover:text-foreground">{action.title}</span>
                        <span className="text-[9px] text-muted-foreground/70 truncate w-full transition-colors duration-300 group-hover:text-muted-foreground">{action.description}</span>
                    </div>
                    </div>
                    <ArrowRight className="h-3 w-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300 flex-shrink-0 ml-1.5" />
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  className="w-full justify-center gap-1.5 h-auto py-1.5 rounded-md hover:bg-primary/10 border border-border/50 hover:border-primary/40 transition-all duration-300 hover:shadow-sm hover:shadow-primary/10 hover:-translate-y-0.5 text-[10px] text-muted-foreground hover:text-primary"
                  onClick={() => setShowAllPrompts(!showAllPrompts)}
                >
                  {showAllPrompts ? (
                    <>
                      <ChevronUp className="h-3 w-3 transition-transform duration-300" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 transition-transform duration-300" />
                      Show More ({quickActions.length - 3} more)
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-comedown border-border/40 bg-card/80 backdrop-blur transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5" style={{ animationDelay: '100ms' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary transition-all duration-300 hover:scale-110 hover:bg-primary/20 hover:shadow-md hover:shadow-primary/20">
                  <User className="h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-110" />
                </div>
                <div>
                  <CardTitle className="text-base">Trading profile</CardTitle>
                  <CardDescription className="text-xs">Customize your preferences</CardDescription>
                </div>
              </div>
              <Button size="sm" variant="outline" className="transition-all duration-300 hover:border-primary hover:bg-primary/10 hover:shadow-sm hover:shadow-primary/10 hover:-translate-y-0.5 hover:scale-105 group" onClick={() => setProfileDialogOpen(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-12" />
                Edit
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {tradingProfile ? (
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Skill</div>
                    <div className="font-medium text-sky-400">{tradingProfile.skillLevel}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Risk</div>
                    <div className="font-medium text-amber-400">{tradingProfile.riskAppetite}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Focus</div>
                    <div className="font-medium text-emerald-400">{tradingProfile.focus}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Style</div>
                    <div className="font-medium text-violet-400 truncate">{tradingProfile.tradingStyle}</div>
                  </div>
                  {tradingProfile.goals && (
                    <div className="col-span-2 space-y-1 mt-1 pt-2 border-t border-border/40">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Goals</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{tradingProfile.goals}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2">
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
              {portfolioSummary && (
                <div className="mt-3 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-medium text-primary mb-3">
                    <span>Portfolio snapshot</span>
                    <span>{portfolioSummary.count} holdings</span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {portfolioSummary.topHoldings.map((holding) => {
                      const position = pricedPositions.find(p => p.symbol === holding.symbol);
                      return (
                        <div
                          key={`desktop-${holding.symbol}`}
                          className="flex items-center gap-3 rounded-xl border border-border/20 bg-background/70 px-3 py-2 shadow-inner"
                        >
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/20 text-xs font-semibold text-primary/90">
                            {holding.symbol.slice(0, 3)}
                          </div>
                          <div className="flex-1 space-y-0.5">
                            <div className="flex items-center justify-between text-[12px] font-medium text-foreground/90">
                              <span>{holding.symbol}</span>
                              {holding.exposure != null && (
                                <span className="text-muted-foreground text-[11px] font-normal">
                                  {formatCurrency(holding.exposure)}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground/80">
                              {holding.quantity != null ? (
                                <span>{holding.quantity} {holding.quantity === 1 ? 'unit' : 'units'}</span>
                              ) : (
                                <span>Qty —</span>
                              )}
                              {holding.costBasis != null && (
                                <span>Avg {formatCurrency(holding.costBasis)}</span>
                              )}
                              {holding.targetPrice != null && (
                                <span>Target {formatCurrency(holding.targetPrice)}</span>
                              )}
                            </div>
                          </div>
                          {position && (
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
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 text-[11px] text-muted-foreground/80">
                    <div>Invested capital</div>
                    <div className="text-right font-medium text-foreground">
                      {formatCurrency(portfolioSummary.totalInvested)}
                    </div>
                    <div>Targets set</div>
                    <div className="text-right font-medium text-foreground">
                      {portfolioSummary.activeTargets}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversation Insights */}
          <Card className="animate-comedown border-border/40 bg-card/80 backdrop-blur transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5" style={{ animationDelay: '200ms' }}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary transition-transform duration-300 hover:scale-110" />
                <CardTitle className="text-sm">Insights</CardTitle>
              </div>
              <CardDescription className="text-xs">Session overview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/40 bg-background/60 p-2.5 transition-all duration-300 hover:border-primary/40 hover:bg-background/80 hover:shadow-sm hover:shadow-primary/10 hover:scale-[1.02]">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Messages</div>
                  <div className="text-lg font-semibold text-foreground">{messages.filter(m => m.sender === 'user').length}</div>
                </div>
                <div className="rounded-lg border border-border/40 bg-background/60 p-2.5 transition-all duration-300 hover:border-primary/40 hover:bg-background/80 hover:shadow-sm hover:shadow-primary/10 hover:scale-[1.02]">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Avg Response</div>
                  <div className="text-lg font-semibold text-foreground">
                    {(() => {
                      const botMessages = messages.filter(m => m.sender === 'bot' && m.meta?.thinkingMs);
                      if (botMessages.length === 0) return '—';
                      const avg = botMessages.reduce((sum, m) => sum + (m.meta.thinkingMs || 0), 0) / botMessages.length;
                      return `${(avg / 1000).toFixed(1)}s`;
                    })()}
                </div>
              </div>
              </div>
              <div className="pt-3 border-t border-border/40 space-y-3">
                <div className="flex items-center justify-between">
              <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Message capacity</div>
                    <p className="text-[11px] text-muted-foreground/80">Mentor keeps this many of your latest turns.</p>
                    </div>
                  <span className="text-base font-semibold text-primary">{messageCapacity}</span>
                  </div>
                <div className="space-y-2">
                  <Slider
                    value={[messageCapacity]}
                    min={MIN_MESSAGE_CAPACITY}
                    max={MAX_MESSAGE_CAPACITY}
                    step={1}
                    onValueChange={(value) => handleMessageCapacityChange(value)}
                    className="mt-1"
                    aria-label="Message capacity"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{MIN_MESSAGE_CAPACITY} msgs</span>
                    <span>{MAX_MESSAGE_CAPACITY} msgs</span>
              </div>
                </div>
              </div>
              {portfolioSummary && (
                <div className="pt-3 border-t border-border/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Portfolio</span>
                    <div className="text-right text-[11px] leading-tight">
                      <div className="font-medium text-primary">{portfolioSummary.count} assets</div>
                      <div className="text-muted-foreground">{formatCurrency(portfolioSummary.totalInvested)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {portfolioSummary.topHoldings.map((holding) => (
                      <span
                        key={`insight-${holding.symbol}`}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary"
                      >
                        <span>{holding.symbol}</span>
                        {holding.quantity != null && (
                          <span className="text-primary/70">{holding.quantity}</span>
                )}
                      </span>
                    ))}
              </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Coins Dialog */}
      <Dialog open={isAddCoinOpen} onOpenChange={setIsAddCoinOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add coins</DialogTitle>
            <DialogDescription>Search and select coins to analyze quickly.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search coins..."
              value={coinSearch}
              onChange={(e) => setCoinSearch(e.target.value)}
            />
            <div className="max-h-80 overflow-y-auto pr-1">
              <div className="grid gap-2 sm:grid-cols-2">
                {COIN_LIST.filter(c =>
                  c.symbol.toLowerCase().includes(coinSearch.toLowerCase()) ||
                  c.name.toLowerCase().includes(coinSearch.toLowerCase())
                ).map((coin) => (
                  <button
                    key={coin.symbol}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/60 px-3 py-2 text-left hover:bg-foreground/5"
                    onClick={() => {
                      setIsAddCoinOpen(false);
                      const msg = `Tell me about ${coin.symbol}`;
                      sendPrompt(msg, { symbol: coin.symbol });
                    }}
                  >
                    <CoinLogo color={coin.color} label={coin.symbol} />
                    <div>
                      <div className="text-sm font-medium">{coin.name}</div>
                      <div className="text-xs text-muted-foreground">{coin.symbol}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update trading profile</DialogTitle>
            <DialogDescription>Helps Mentor tailor tone, depth, and risk guidance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Skill level</Label>
                <Select value={profileForm.skillLevel} onValueChange={(value: TradingProfile["skillLevel"]) => setProfileForm(prev => ({ ...prev, skillLevel: value }))}>
                  <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/80 transition-all hover:border-primary/60 hover:shadow-sm">
                    <SelectValue placeholder="Select skill" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
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
                  <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/80 transition-all hover:border-primary/60 hover:shadow-sm">
                    <SelectValue placeholder="Select risk" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
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
                <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background/80 transition-all hover:border-primary/60 hover:shadow-sm">
                  <SelectValue placeholder="Choose focus" />
                </SelectTrigger>
                <SelectContent className="z-[100]">
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
              {portfolioPositions.length > 0 ? (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {portfolioPositions.slice(0, 5).map((position) => (
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
                  ))}
                  {portfolioPositions.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{portfolioPositions.length - 5} more positions
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
            <Button disabled={profileSaving} onClick={async () => {
              setProfileSaving(true);
              try {
                const res = await apiFetch('/api/profile/trading', {
                  method: 'POST',
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
            }}>
              {profileSaving ? 'Saving…' : 'Save profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Portfolio Dialog */}
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
              <Label htmlFor="mentor-portfolio-symbol">Symbol</Label>
              <Input
                id="mentor-portfolio-symbol"
                placeholder="BTC"
                value={portfolioForm.symbol}
                onChange={(e) => updatePortfolioField('symbol', e.target.value.toUpperCase())}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mentor-portfolio-qty">Quantity</Label>
                <Input
                  id="mentor-portfolio-qty"
                  placeholder="e.g. 1.5"
                  value={portfolioForm.quantity}
                  onChange={(e) => updatePortfolioField('quantity', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mentor-portfolio-cost">Cost basis</Label>
                <Input
                  id="mentor-portfolio-cost"
                  placeholder="e.g. 28500"
                  value={portfolioForm.costBasis}
                  onChange={(e) => updatePortfolioField('costBasis', e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mentor-portfolio-target">Target price</Label>
                <Input
                  id="mentor-portfolio-target"
                  placeholder="e.g. 36000"
                  value={portfolioForm.targetPrice}
                  onChange={(e) => updatePortfolioField('targetPrice', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mentor-portfolio-timeframe">Timeframe</Label>
                <Input
                  id="mentor-portfolio-timeframe"
                  placeholder="Swing, Long-term"
                  value={portfolioForm.timeframe}
                  onChange={(e) => updatePortfolioField('timeframe', e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mentor-portfolio-risk">Risk</Label>
                <Input
                  id="mentor-portfolio-risk"
                  placeholder="Low / Med / High"
                  value={portfolioForm.risk}
                  onChange={(e) => updatePortfolioField('risk', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mentor-portfolio-confidence">Confidence %</Label>
                <Input
                  id="mentor-portfolio-confidence"
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
              <Label htmlFor="mentor-portfolio-strategy">Strategy</Label>
              <Input
                id="mentor-portfolio-strategy"
                placeholder="e.g. Breakout swing, DCA"
                value={portfolioForm.strategy}
                onChange={(e) => updatePortfolioField('strategy', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mentor-portfolio-notes">Notes</Label>
              <Textarea
                id="mentor-portfolio-notes"
                placeholder="Optional notes"
                className="min-h-[80px]"
                value={portfolioForm.notes}
                onChange={(e) => updatePortfolioField('notes', e.target.value)}
              />
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
    </>
  );
};

const SourceChip: React.FC<{ source: SourceLink }> = ({ source }) => {
  let domain = source.domain;
  if (!domain) {
    try {
      const parsed = new URL(source.url);
      domain = parsed.hostname.replace(/^www\./, '');
    } catch {
      domain = source.label;
    }
  }
  const fallbackInitial = domain?.charAt(0)?.toUpperCase() || '↗';
  const favicon = domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : '';
  const [iconError, setIconError] = React.useState(false);

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="group inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-all hover:border-primary/60 hover:bg-primary/10 hover:text-primary hover:shadow-sm"
    >
      {!iconError && favicon ? (
        <img
          src={favicon}
          alt=""
          className="h-4 w-4 rounded-full border border-border/40 transition-transform group-hover:scale-110"
          onError={() => setIconError(true)}
        />
      ) : (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
          {fallbackInitial}
        </span>
      )}
      <span className="pr-1">{domain}</span>
    </a>
  );
};

const ProfileStat: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div className="rounded-lg border border-border/40 bg-card/60 px-3 py-2 text-xs transition-all duration-300 hover:border-primary/40 hover:bg-card/80 hover:shadow-sm hover:shadow-primary/10 hover:-translate-y-0.5 hover:scale-[1.02]">
    <div className="uppercase tracking-wide text-[10px] text-muted-foreground transition-colors duration-300">{label}</div>
    <div className={`mt-1 text-sm font-semibold ${color} transition-transform duration-300 hover:scale-105`}>{value}</div>
  </div>
);

const MobileSourcePreview: React.FC<{ sources: SourceLink[]; onOpen: () => void }> = ({ sources, onOpen }) => {
  const preview = sources.slice(0, 3);

  const resolveDomain = (source: SourceLink) => {
    if (source.domain) return source.domain;
    try {
      return new URL(source.url).hostname.replace(/^www\./, "");
    } catch {
      return source.label;
    }
  };

  const primary = preview[0];
  const primaryDomain = primary ? resolveDomain(primary) : null;
  const primaryIcon = primaryDomain ? `https://icons.duckduckgo.com/ip3/${primaryDomain}.ico` : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative w-full overflow-hidden rounded-xl border border-border/40 bg-background/70 p-2 text-left shadow-sm transition-all duration-200 hover:border-primary/60 hover:bg-primary/5 active:scale-[0.98]"
    >
      {primaryIcon && (
        <div
          className="pointer-events-none absolute inset-0 opacity-15 blur-xl"
          style={{ backgroundImage: `url(${primaryIcon})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/95 via-background/90 to-background/95" />
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sources</span>
          <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {sources.length}
          </span>
          <div className="flex items-center gap-1 min-w-0 overflow-hidden">
            {preview.slice(0, 2).map((source) => {
              const domain = resolveDomain(source);
              return (
                <span
                  key={source.url}
                  className="rounded-full border border-border/50 bg-background/80 px-1.5 py-0.5 text-[9px] font-medium text-foreground/70 truncate max-w-[80px]"
                >
                  {domain}
                </span>
              );
            })}
            {sources.length > 2 && (
              <span className="text-[9px] font-medium text-muted-foreground">+{sources.length - 2}</span>
            )}
          </div>
        </div>
        <ArrowRight className="h-3 w-3 text-primary flex-shrink-0" />
      </div>
    </button>
  );
};

// Coin logo component: tries public cryptocurrency-icons repo; falls back to generated badge
const CoinLogo: React.FC<{ color: string; label: string }> = ({ color, label }) => {
  const [failed, setFailed] = React.useState(false);
  const sym = label.toLowerCase();
  const url = `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/svg/color/${sym}.svg`;

  if (!failed) {
    return (
      <img
        src={url}
        alt={`${label} logo`}
        onError={() => setFailed(true)}
        loading="lazy"
        className="h-7 w-7 rounded-full bg-foreground/5 p-0.5 shadow-sm"
      />
    );
  }

  // Fallback simple SVG badge
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" className="shrink-0">
      <defs>
        <radialGradient id={`g-${label}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </radialGradient>
      </defs>
      <circle cx="14" cy="14" r="13" fill={`url(#g-${label})`} stroke={color} strokeWidth="1" />
      <text x="14" y="17" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">{label}</text>
    </svg>
  );
};

type CoinMeta = { symbol: string; name: string; color: string };
const COIN_LIST: CoinMeta[] = [
  { symbol: "BTC", name: "Bitcoin", color: "#F7931A" },
  { symbol: "ETH", name: "Ethereum", color: "#627EEA" },
  { symbol: "SOL", name: "Solana", color: "#14F195" },
  { symbol: "BNB", name: "BNB", color: "#F3BA2F" },
  { symbol: "XRP", name: "XRP", color: "#23292F" },
  { symbol: "ADA", name: "Cardano", color: "#0033AD" },
  { symbol: "DOGE", name: "Dogecoin", color: "#C2A633" },
  { symbol: "MATIC", name: "Polygon", color: "#8247E5" },
  { symbol: "AVAX", name: "Avalanche", color: "#E84142" },
  { symbol: "DOT", name: "Polkadot", color: "#E6007A" },
  { symbol: "LTC", name: "Litecoin", color: "#345D9D" },
  { symbol: "LINK", name: "Chainlink", color: "#2A5ADA" },
  { symbol: "UNI", name: "Uniswap", color: "#FF007A" },
  { symbol: "ATOM", name: "Cosmos", color: "#2E3148" },
  { symbol: "NEAR", name: "NEAR", color: "#000000" },
  { symbol: "APT", name: "Aptos", color: "#1B1F23" },
  { symbol: "ARB", name: "Arbitrum", color: "#2D374B" },
  { symbol: "OP", name: "Optimism", color: "#FF0420" },
  { symbol: "FIL", name: "Filecoin", color: "#21C1D6" },
  { symbol: "ICP", name: "Internet Computer", color: "#F94EAD" },
];

export default Mentor;
