import React from "react";
import { Link } from "react-router-dom";
import {
  BellRing,
  BookOpen,
  Bot,
  ChartCandlestick,
  CheckCircle2,
  Compass,
  Database,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Lock,
  MessagesSquare,
  MonitorSmartphone,
  Server,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Workflow,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type FeatureCard = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  points: string[];
};

type PlanDetail = {
  plan: string;
  bestFor: string;
  signals: string;
  mentor: string;
  alerts: string;
  extras: string[];
};

type ServiceItem = {
  id: string;
  title: string;
  summary: string;
  icon: React.ComponentType<{ className?: string }>;
  bullets: string[];
};

type DataModelEntry = {
  table: string;
  purpose: string;
  columns: string[];
};

const serviceOverview: ServiceItem[] = [
  {
    id: "web-app",
    title: "Web Dashboard",
    summary: "React + Vite single-page application that surfaces every trading workflow in one place.",
    icon: LayoutDashboard,
    bullets: [
      "Routing defined in `App.tsx` separates the public site from protected `/dashboard/*` views with plan-aware guards.",
      "Local caches hydrate instantly (watchlists, notifications) and reconcile with server APIs for authoritative data.",
      "shadcn/ui + Tailwind deliver consistent dark-mode components, keyboard support, and accessible focus states.",
    ],
  },
  {
    id: "api",
    title: "Express API & WebSocket Hub",
    summary: "Node service in `website/server/server.js` issues sessions, exposes REST endpoints, and streams updates.",
    icon: Server,
    bullets: [
      "JWT sessions are stored in httpOnly cookies with 7-day expiry and `sameSite` protection for authenticated traffic.",
      "Endpoints cover announcements, alerts, watchlists, portfolio entries, mentor feedback, and admin plan management.",
      "WebSocket layer fans out price subscriptions and alert notifications with subscribe/unsubscribe handshakes.",
    ],
  },
  {
    id: "signals-bot",
    title: "Signals Bot (Python)",
    summary: "`signals-bot/main.py` generates trade ideas and keeps Discord and the dashboard perfectly mirrored.",
    icon: ChartCandlestick,
    bullets: [
      "Candidates are scored, deduplicated via `has_recent_signal`, and enriched with entry, targets, and stop context.",
      "`generate_signal_chart` attaches technical snapshots while embeds publish to Discord with action views.",
      "Subscribers receive synchronized DMs; fallback logic fetches users when not cached and records metrics per send.",
    ],
  },
  {
    id: "alerts-pipeline",
    title: "Alert Delivery",
    summary: "Alert creation flows from the dashboard into shared storage and back out through bots and notifications.",
    icon: BellRing,
    bullets: [
      "`SetAlertModal` validates user input and persists alerts through `/api/alerts`, including percent and price triggers.",
      "The Python bot normalizes triggers, tracks cooldowns per user-symbol pair, and writes `last_triggered_at` history.",
      "Triggering an alert posts Discord DMs with `AlertActionsView` and calls `/api/alerts/trigger-notify` for in-app badges.",
    ],
  },
  {
    id: "mentor-bot",
    title: "Trading Mentor Bot",
    summary: "Node-based Discord bot that personalizes coaching with data from the shared Neon database.",
    icon: Bot,
    bullets: [
      "Commands such as `/setup`, `/progress`, `/portfolio`, and `/watchlist` reference the same user records as the web app.",
      "Profiles capture experience, timeframe, risk tolerance, and goals so guidance stays contextual.",
      "Feedback endpoints log mentor reactions for admins to audit quality and iterate on prompt engineering.",
    ],
  },
  {
    id: "support-workflow",
    title: "Support & Feedback",
    summary: "Feedback dialog, Discord workflows, and admin tooling keep customer issues visible end-to-end.",
    icon: MessagesSquare,
    bullets: [
      "`POST /api/feedback` stores severity, category, attachments, and user identity in `user_feedback`.",
      "Admins triage submissions inside the dashboard; updates sync back to reporters via notifications and Discord.",
      "Mentor-specific feedback is archived in `mentor_feedback` with prompt metadata for compliance review.",
    ],
  },
];

const dataModel: DataModelEntry[] = [
  {
    table: "users",
    purpose: "Primary identity record for Discord members and in-app subscribers.",
    columns: [
      "discord_id (PK)",
      "plan, is_admin",
      "preferences JSON (tour, settings, feature flags)",
      "trial_started_at / trial_ends_at / trial_used",
      "created_at, updated_at",
    ],
  },
  {
    table: "alerts",
    purpose: "Stores alert definitions for both price and percent triggers across asset types.",
    columns: [
      "id (serial PK), user_id, symbol, type, direction",
      "threshold, window_tf, cooldown, active",
      "asset_type, display_symbol, display_name",
      "created_at, last_triggered_at",
    ],
  },
  {
    table: "watchlist",
    purpose: "Ordered watchlists that sync between local storage, API responses, and websocket subscriptions.",
    columns: [
      "user_id, symbol, position",
      "asset_type, display_symbol, display_name",
      "created_at index for auditability",
    ],
  },
  {
    table: "portfolio_positions",
    purpose: "Tracks portfolio exposure, risk notes, and targets to inform mentor and signals context.",
    columns: [
      "user_id, symbol, quantity, cost_basis",
      "target_price, risk, timeframe, strategy",
      "confidence, notes, updated_at, closed_at, exit_price",
    ],
  },
  {
    table: "announcements",
    purpose: "Admin-authored broadcasts surfaced in the Notifications hub and Discord mirrors.",
    columns: [
      "id (serial PK), title, body",
      "audience filter, created_at",
    ],
  },
  {
    table: "user_feedback & mentor_feedback",
    purpose: "Records incoming issues plus AI mentor ratings so the team can remediate and audit responses.",
    columns: [
      "user_id, username, plan",
      "category, severity, status, resolution_notes",
      "prompt / response metadata, timestamps",
    ],
  },
];

const foundationHighlights: FeatureCard[] = [
  {
    id: "architecture",
    title: "Platform Architecture",
    description:
      "Web dashboard, API, and Discord bots all operate against the same Neon PostgreSQL dataset and session model.",
    icon: LayoutDashboard,
    badge: "Core Services",
    points: [
      "React + TypeScript front-end compiled with Vite; shadcn/ui supplies accessible, themeable components.",
      "Express server in `server/server.js` brokers Discord OAuth, signs JWT cookies, and exposes `/api/*` routes.",
      "Shared database tables cover users, alerts, watchlists, portfolio positions, announcements, and feedback.",
      "Signals and mentor bots reuse the same records so Discord interactions stay in lockstep with the dashboard.",
    ],
  },
  {
    id: "reliability",
    title: "Reliability & Safeguards",
    description:
      "Resiliency checks in every service ensure signals, alerts, and notifications remain trustworthy during volatility.",
    icon: TimerReset,
    points: [
      "Circuit breakers wrap external price fetches and provide deterministic fallbacks when vendors throttle.",
      "Per-user cooldowns (`_is_on_cooldown`) stop duplicate alert requests before they ever hit the provider APIs.",
      "Alert DMs retry without interactive views, log failures, and never silently drop a trigger.",
      "Each alert trigger calls `/api/alerts/trigger-notify` so dashboard badges update the moment Discord pings fire.",
    ],
  },
  {
    id: "design",
    title: "Design Principles",
    description:
      "The interface prioritizes actionable context and disciplined workflows for traders and admins alike.",
    icon: Compass,
    points: [
      "High-contrast dark theme, responsive grids, and keyboard shortcuts built into navigation components.",
      "Confirmation dialogs wrap destructive actions; copy mirrors the language used inside Discord automations.",
      "Empty states and walkthrough chips in dashboard views guide new members through required steps.",
      "Motion is subtle and purposeful—glows, blurs, and chart transitions highlight decision points without noise.",
    ],
  },
];

const featureDeepDive: FeatureCard[] = [
  {
    id: "signals",
    title: "Signals Engine",
    description:
      "Python research pipeline scores opportunities and delivers synchronized Discord + dashboard breakdowns.",
    icon: ChartCandlestick,
    points: [
      "Deduplication via `has_recent_signal` stops repeated calls on the same symbol within the duplicate window.",
      "Embeds publish entry range, targets, stop loss, timeframe, catalyst context, and include generated charts when available.",
      "Signals post to Discord with interactive views and mirror key fields into subscriber DMs for immediate action.",
      "Analytics counters track button clicks, DMs sent, and dispatch outcomes to monitor quality over time.",
    ],
  },
  {
    id: "alerts",
    title: "Price Alerts",
    description:
      "Cross-channel alerting keeps the dashboard, Discord, and websocket subscribers aligned in real time.",
    icon: Zap,
    points: [
      "Set alerts from Discord or the dashboard; the same modal writes to Neon via `/api/alerts` for persistence.",
      "Supports price and percent triggers, directionality, optional cooldowns, and asset metadata for downstream context.",
      "Alert workers store `last_triggered_at`, attempt DM delivery with `AlertActionsView`, then retry without views if needed.",
      "Website listeners receive `/api/alerts/trigger-notify` events so in-app notifications and toasts reflect the trigger instantly.",
    ],
  },
  {
    id: "mentor",
    title: "AI Mentor",
    description:
      "Discord-first assistant that pulls from shared preferences, portfolio context, and course material.",
    icon: Sparkles,
    points: [
      "Profiles created through `/setup` capture experience, timeframe, risk tolerance, and goals for tailored prompts.",
      "Commands like `/portfolio`, `/watchlist`, and `/progress` read directly from Neon data populated by the dashboard.",
      "Mentor feedback endpoint logs reactions and responses, enabling admins to audit AI guidance quality.",
      "Plan gating inside the dashboard and bots enforces access (e.g., Pro and Elite unlock unlimited mentor sessions).",
    ],
  },
  {
    id: "watchlist",
    title: "Watchlists & Portfolio",
    description:
      "Portfolio tooling captures exposure, targets, and risk so alerts and mentoring remain contextual.",
    icon: ListChecks,
    points: [
      "Drag-and-drop ordering persists via `/api/watchlist`; local cache syncs with server data on load.",
      "CSV importer tokenizes symbols and bulk adds them while deduplicating invalid entries.",
      "Websocket subscriptions stream sparkline data for tracked symbols to keep cards fresh.",
      "Portfolio records store quantity, cost basis, target price, risk, timeframe, notes, and strategy metadata.",
    ],
  },
  {
    id: "notifications",
    title: "Notifications Hub",
    description:
      "Single location for announcements, alert history, admin pings, and system status updates.",
    icon: MonitorSmartphone,
    points: [
      "Announcements originate from admins via `/api/announcements` and are cached locally for quick load times.",
      "Signal, alert, and system notifications persist identifiers so users cannot dismiss someone else’s updates.",
      "Local storage mirrors dismissed/read sets, then syncs once the session replays data from the API.",
      "Admin-only notices stay hidden from standard plans using session role checks before rendering actions.",
    ],
  },
  {
    id: "support",
    title: "Feedback & Support",
    description:
      "Issue intake and Discord workflows keep the support queue triaged without losing context.",
    icon: LifeBuoy,
    points: [
      "Dashboard feedback dialog posts to `/api/feedback`, storing severity, category, status, and resolution notes.",
      "Discord support tickets mirror submissions so traders can stay in their preferred channel.",
      "Admins receive actionable metadata (plan, username, Discord handle) with every ticket to accelerate fixes.",
      "Mentor feedback endpoints allow rating AI answers, feeding compliance and product refinement loops.",
    ],
  },
];

const planComparison: PlanDetail[] = [
  {
    plan: "Free",
    bestFor: "Discord members sampling signals and learning resources before subscribing.",
    signals: "Preview access in Discord",
    mentor: "Community discussion only",
    alerts: "3 active price alerts",
    extras: [
      "Discord community channels",
      "Market discussion & news feed",
      "Access to free PDFs and resources",
    ],
  },
  {
    plan: "Core",
    bestFor: "Active traders who rely on daily signals, alerts, and structured watchlists.",
    signals: "Up to 5 AI signals per day",
    mentor: "Basic Mentor access",
    alerts: "10 active alerts",
    extras: [
      "AI-powered daily signals",
      "Custom watchlists & price alerts",
      "Live market news feed",
      "Priority support",
    ],
  },
  {
    plan: "Pro",
    bestFor: "Teams that need advanced mentoring, automation, and detailed signal throughput.",
    signals: "Up to 15 AI signals per day",
    mentor: "Unlimited AI Mentor conversations",
    alerts: "25 active alerts",
    extras: [
      "Full AI Mentor (chat + deep analysis)",
      "Advanced education & Pine assistant",
      "Indicator library access",
      "Monthly giveaways (2 tickets)",
    ],
  },
  {
    plan: "Elite",
    bestFor: "Full-time traders and partner desks requiring concierge mentorship and rapid experimentation.",
    signals: "Unlimited AI signals",
    mentor: "Priority Mentor + private channels",
    alerts: "Unlimited alerts",
    extras: [
      "1-on-1 live mentorship",
      "VIP-only Discord channels",
      "Unlimited memecoin snipes (high-frequency alert stream)",
      "Early access to features",
    ],
  },
];

const automationPlaybook = [
  {
    title: "Signal Lifecycle",
    description:
      "Signals originate from the research pipeline, move through automated validation, and land simultaneously in the dashboard and Discord. Manual overrides allow analysts to annotate or pause delivery when macro context changes.",
  },
  {
    title: "Alert Execution",
    description:
      "Users define triggers (static, trailing, ratio-based). The alert service runs distributed workers with per-user quotas. When a threshold hits, payloads are deduplicated, persisted, and relayed via websockets, Discord DMs, and optional email.",
  },
  {
    title: "Support Escalation",
    description:
      "Feedback submissions classify severity. P1 issues wake admins, P2 create a Discord thread, P3 enters the triage board. Status updates feed back to the reporter's notification hub.",
  },
];

const complianceHighlights = [
  "Session cookies are JWT-signed, httpOnly, and respect `sameSite` + `secure` flags for authenticated requests.",
  "Admin APIs verify `isAdmin` before exposing user management, plan overrides, or feedback resolution tools.",
  "Internal bot integrations (e.g., `/api/alerts/trigger-notify`) require the `x-internal-key` shared secret when configured.",
  "User and mentor feedback tables capture severity, status, admin assignee, and resolution notes for audit trails.",
  "Exports, deletions, and plan updates run through centralized helpers to keep Neon data consistent across services.",
];

const faqEntries = [
  {
    question: "Where are onboarding completions stored?",
    answer:
      "Onboarding preferences persist in Neon/PostgreSQL under the users table `preferences` JSON column. We never rely on localStorage for production-critical state.",
  },
  {
    question: "How do dev logins differ from production users?",
    answer:
      "Dev logins use `dev-` user IDs and have isolated preference rows. They mirror the production flow (tour, notifications, feedback) without risking live customer records.",
  },
  {
    question: "What happens when I skip the onboarding tour?",
    answer:
      "Skip triggers a confirmation dialog, then writes `onboardingCompleted` to preferences. You can relaunch the tour anytime from Account → Experience.",
  },
  {
    question: "How fast do admins respond to critical feedback?",
    answer:
      "Critical submissions page the admin roster instantly. Response targets are &lt;15 minutes during market hours and &lt;1 hour outside of them.",
  },
  {
    question: "Can I export my historical data?",
    answer:
      "Yes. Watchlists, portfolio performance, and signal history all expose export buttons. Admins can fulfill compliance-grade exports on request.",
  },
];

const Docs = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-slate-950 text-foreground">
      {/* Simple Docs Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:flex-nowrap sm:px-6">
          <div className="flex flex-wrap items-center gap-2 text-sm sm:gap-4">
            <Link to="/dashboard" className="text-xl font-bold text-foreground hover:text-primary transition-colors">
              Jack Of All Trades
            </Link>
            <span className="text-foreground/70">/</span>
            <span className="text-sm font-medium text-foreground">Documentation</span>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-2 justify-center sm:w-auto"
              asChild
            >
              <Link to="/dashboard">
                <Workflow className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 justify-center sm:w-auto"
              onClick={() => window.open("https://discord.gg/sjsJwdZPew", "_blank", "noopener noreferrer")}
            >
              <LifeBuoy className="h-4 w-4" />
              Support
            </Button>
          </div>
        </div>
      </header>
      <main className="relative">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-900/40 via-background to-background pt-24 pb-20">
          <div className="absolute inset-0 opacity-[0.04]">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 20%, hsl(var(--accent)) 2px, transparent 2px), radial-gradient(circle at 80% 80%, hsl(var(--primary)) 2px, transparent 2px)",
                backgroundSize: "90px 90px",
              }}
            />
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-accent/30 via-transparent to-transparent blur-3xl opacity-70" />
          <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 text-center lg:px-8">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-foreground">
              Jack Of All Trades • Product Documentation
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Platform Documentation
            </h1>
            <p className="max-w-3xl text-base text-foreground sm:text-lg">
              Comprehensive technical documentation covering platform architecture, features, workflows, and operational procedures. 
              This resource is designed for traders, analysts, and administrators who require detailed understanding of system capabilities, 
              integration points, and best practices.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to="/dashboard">
                  <Workflow className="h-4 w-4" />
                  Return to Dashboard
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2 border-primary/40 bg-primary/5 hover:bg-primary/10"
                onClick={() => window.open("https://discord.gg/sjsJwdZPew", "_blank", "noopener noreferrer")}
              >
                <LifeBuoy className="h-4 w-4" />
                Contact Support
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="gap-2 text-foreground hover:text-primary"
                onClick={() => {
                  const element = document.getElementById("feature-deep-dive");
                  element?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <BookOpen className="h-4 w-4" />
                Jump to Feature Deep Dive
              </Button>
            </div>
          </div>
        </section>

        {/* Quick navigation */}
        <section className="relative z-10 mx-auto -mt-10 max-w-5xl rounded-3xl border border-border/40 bg-background/95 p-6 shadow-2xl shadow-primary/10 backdrop-blur lg:-mt-16 lg:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">Documentation Index</p>
              <h2 className="text-2xl font-bold text-foreground">Choose where you want to start</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["services", "Service Map"],
                ["foundation", "Foundation"],
                ["data-model", "Data Model"],
                ["getting-started", "Getting Started"],
                ["feature-deep-dive", "Features"],
                ["plans", "Plans"],
                ["automation", "Automation"],
                ["security", "Security"],
                ["support", "Support"],
                ["faq", "FAQ"],
              ].map(([id, label]) => (
                <Button
                  key={id}
                  variant="outline"
                  className="rounded-full border border-border/60 bg-background/80 text-sm !text-foreground hover:border-primary/60 hover:bg-primary/10"
                  onClick={() => {
                    const el = document.getElementById(id);
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Service Overview */}
        <section id="services" className="mx-auto mt-20 max-w-6xl space-y-8 px-6 lg:px-8">
          <header className="space-y-2">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              Service Topology
            </Badge>
            <h2 className="text-3xl font-bold text-foreground">How each system component works together</h2>
            <p className="max-w-3xl text-foreground">
              Every experience inside Jack Of All Trades is backed by a specific service. Use this map to understand
              which layer owns a workflow and where to look when troubleshooting or extending functionality.
            </p>
          </header>
          <div className="grid gap-6 md:grid-cols-2">
            {serviceOverview.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.id}
                  className="flex h-full flex-col gap-4 rounded-3xl border border-border/40 bg-background/85 p-6 shadow-lg shadow-primary/10 transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-primary/20"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                      <p className="text-sm text-foreground/80">{item.summary}</p>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm text-foreground">
                    {item.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4 text-primary/80" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        {/* Data Model */}
        <section id="data-model" className="mx-auto mt-20 max-w-6xl rounded-3xl border border-border/40 bg-background/85 p-8 shadow-2xl shadow-secondary/10 lg:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-sm space-y-3">
              <Badge variant="outline" className="border-secondary/40 bg-secondary/10 text-secondary-foreground">
                Data Model
              </Badge>
              <h2 className="text-3xl font-bold text-foreground">Shared tables that power the platform</h2>
              <p className="text-sm text-foreground">
                The dashboard, bots, and API treat Neon as the single source of truth. Understanding these tables is key
                when debugging data drift, building exports, or extending the product surface.
              </p>
            </div>
            <div className="flex-1 space-y-6">
              {dataModel.map((entry) => (
                <div key={entry.table} className="rounded-2xl border border-border/30 bg-foreground/[0.04] p-6">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                      <Database className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{entry.table}</h3>
                      <p className="text-sm text-foreground/80">{entry.purpose}</p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm text-foreground">
                    {entry.columns.map((column) => (
                      <li key={column} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-secondary/80" />
                        <span>{column}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Foundation */}
        <section id="foundation" className="mx-auto mt-16 max-w-6xl space-y-8 px-6 lg:px-8">
          <header className="space-y-2">
            <Badge variant="outline" className="rounded-full border-accent/40 bg-accent/10 text-accent-foreground">
              Platform Fundamentals
            </Badge>
            <h2 className="text-3xl font-bold text-foreground">How the platform is engineered</h2>
            <p className="max-w-3xl text-foreground">
              Understand the fundamentals before diving into execution. Our infrastructure choices aim to give traders
              the performance they expect while keeping operations predictable for admins.
            </p>
          </header>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {foundationHighlights.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.id}
                  className="relative flex h-full flex-col gap-4 rounded-2xl border border-border/40 bg-background/80 p-6 shadow-lg shadow-foreground/5 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-primary/10"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{card.title}</h3>
                      {card.badge && (
                        <span className="text-xs font-medium uppercase tracking-wide text-primary/80">{card.badge}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-foreground">{card.description}</p>
                  <ul className="mt-2 space-y-2 text-sm text-foreground">
                    {card.points.map((point) => (
                      <li key={point} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary/80" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        {/* Getting Started timeline */}
        <section id="getting-started" className="mx-auto mt-20 max-w-5xl rounded-3xl border border-border/40 bg-background/80 p-8 shadow-xl shadow-primary/10 lg:p-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-sm space-y-3">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                Onboarding Blueprint
              </Badge>
              <h2 className="text-3xl font-bold text-foreground">Trading-ready in five deliberate steps</h2>
              <p className="text-sm text-foreground">
                Whether you are a first-time member or an admin provisioning access, the onboarding flow keeps everyone
                aligned. The onboarding tour is only the beginning — each step below links to a dashboard view or admin
                checklist.
              </p>
            </div>
            <div className="flex-1 space-y-6">
              {[
                {
                  title: "1. Secure sign-in",
                  detail:
                    "Login exclusively through Discord OAuth or approved dev credentials. Session cookies hydrate the dashboard automatically.",
                },
                {
                  title: "2. Guided tour & preferences",
                  detail:
                    "The onboarding tour spotlights navigation, signals, alerts, notifications, and support. Completion status saves to Neon preferences — no localStorage.",
                },
                {
                  title: "3. Account setup",
                  detail:
                    "Head to Account → Profile to update trading style, risk appetite, and Discord username. These enrich mentor prompts and signal context.",
                },
                {
                  title: "4. Portfolio & alerts",
                  detail:
                    "Import positions, set watchlist priorities, and configure price alerts. Alerts stay in sync with Discord so you can triage from anywhere.",
                },
                {
                  title: "5. Continuous education",
                  detail:
                    "Bookmark this documentation, review the FAQ, and join the weekly recap call. Elite users gain access to private coaching and desk resources.",
                },
              ].map((item, index) => (
                <div key={item.title} className="relative rounded-2xl border border-border/30 bg-foreground/[0.04] p-5">
                  <span className="absolute -top-3 left-5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/40">
                    {index + 1}
                  </span>
                  <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm text-foreground">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Feature Deep Dive */}
        <section id="feature-deep-dive" className="mx-auto mt-20 max-w-6xl space-y-8 px-6 lg:px-8">
          <header className="space-y-2">
            <Badge variant="outline" className="border-secondary/40 bg-secondary/10 text-secondary-foreground">
              Feature Deep Dive
            </Badge>
            <h2 className="text-3xl font-bold text-foreground">Every product surface, explained</h2>
            <p className="max-w-3xl text-foreground">
              Use these cards as a tactical playbook. Each feature section includes how data flows, what admins can tune,
              and how premium plans expand capabilities.
            </p>
          </header>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {featureDeepDive.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.id}
                  className="group relative flex h-full flex-col gap-4 rounded-3xl border border-border/40 bg-gradient-to-br from-background/90 via-background to-slate-950/80 p-6 shadow-lg shadow-foreground/5 transition-all duration-300 hover:-translate-y-1 hover:border-secondary/40 hover:shadow-secondary/20"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{card.title}</h3>
                      {card.badge && (
                        <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-secondary">
                          {card.badge}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-foreground">{card.description}</p>
                  <ul className="space-y-2 text-sm text-foreground">
                    {card.points.map((point) => (
                      <li key={point} className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4 text-secondary/80" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        {/* Plans */}
        <section id="plans" className="mx-auto mt-20 max-w-6xl space-y-8 px-6 lg:px-8">
          <header className="space-y-2">
            <Badge variant="outline" className="border-emerald-400/50 bg-emerald-500/10 text-emerald-300">
              Plan Comparison
            </Badge>
            <h2 className="text-3xl font-bold text-foreground">Choose the intensity that matches your trading desk</h2>
            <p className="max-w-3xl text-foreground">
              All plans include secure authentication, onboarding tour access, notifications hub, and community channels.
              Upgrade tiers unlock deeper automation, AI capabilities, and priority support.
            </p>
          </header>
          <div className="overflow-hidden rounded-3xl border border-border/30 bg-background/90 shadow-xl shadow-emerald-500/10">
            <div className="grid grid-cols-1 divide-y divide-border/40 md:grid-cols-4 md:divide-y-0 md:divide-x">
              {planComparison.map((plan) => (
                <div key={plan.plan} className="flex flex-col gap-4 p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-foreground">{plan.plan}</h3>
                    <Badge variant="secondary" className="rounded-full bg-emerald-500/10 text-emerald-300">
                      {plan.signals.split(" ")[0]} Signals
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground">{plan.bestFor}</p>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-foreground font-semibold">Signals</p>
                      <p className="text-foreground">{plan.signals}</p>
                    </div>
                    <div>
                      <p className="text-foreground font-semibold">Mentor</p>
                      <p className="text-foreground">{plan.mentor}</p>
                    </div>
                    <div>
                      <p className="text-foreground font-semibold">Price Alerts</p>
                      <p className="text-foreground">{plan.alerts}</p>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm text-foreground">
                    {plan.extras.map((extra) => (
                      <li key={extra} className="flex items-start gap-2">
                        <Sparkles className="mt-0.5 h-4 w-4 text-emerald-300/80" />
                        <span>{extra}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Automation Playbook */}
        <section id="automation" className="mx-auto mt-20 max-w-5xl rounded-3xl border border-border/40 bg-gradient-to-br from-background via-background/95 to-slate-900/80 p-8 shadow-2xl shadow-primary/10 lg:p-12">
          <div className="space-y-6">
            <div className="space-y-3">
              <Badge variant="outline" className="border-blue-400/50 bg-blue-500/10 text-blue-200">
                Automation Playbook
              </Badge>
              <h2 className="text-3xl font-bold text-foreground">Operational workflows that keep traders in sync</h2>
              <p className="text-sm text-foreground">
                Automation is a multiplier when everyone understands the sequence. The playbook below breaks down our
                most important flows so you can reason about incident impact, feature requests, or custom integrations.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              {automationPlaybook.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-border/40 bg-background/80 p-6 shadow-lg shadow-blue-500/10"
                >
                  <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-3 text-sm text-foreground leading-relaxed">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Security & Compliance */}
        <section id="security" className="mx-auto mt-20 max-w-5xl space-y-6 px-6 lg:px-8">
          <header className="space-y-2">
            <Badge variant="outline" className="border-red-400/50 bg-red-500/10 text-red-200">
              Security & Compliance
            </Badge>
            <h2 className="text-3xl font-bold text-foreground">Protecting traders, data, and the brand</h2>
            <p className="max-w-3xl text-foreground">
              Robust security is non-negotiable. We exceed the expectations for a trading intelligence platform by
              combining technical controls with transparent user messaging.
            </p>
          </header>
          <div className="space-y-3 rounded-3xl border border-border/40 bg-background/90 p-8 shadow-xl shadow-red-500/10">
            {complianceHighlights.map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm text-foreground">
                <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-300/70" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Support */}
        <section id="support" className="mx-auto mt-20 max-w-5xl rounded-3xl border border-border/40 bg-foreground/[0.03] p-8 shadow-2xl shadow-primary/10 lg:p-12">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                Support & Escalation
              </Badge>
              <h2 className="text-3xl font-bold text-foreground">We partner with you throughout the trade lifecycle</h2>
              <p className="text-sm text-foreground">
                Our support process blends automation with human expertise. Every channel below routes into a shared
                operations board so nothing gets lost.
              </p>
              <div className="space-y-3">
                <div className="rounded-2xl border border-border/40 bg-background/90 p-5">
                  <h3 className="text-lg font-semibold text-foreground">Primary Channels</h3>
                  <ul className="mt-3 space-y-2 text-sm text-foreground">
                    <li>• Discord support tickets (fastest response during market hours)</li>
                    <li>• In-dashboard feedback dialog for structured bug reports</li>
                    <li>• Message a moderator directly in Discord for urgent issues</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-border/40 bg-background/90 p-5">
                  <h3 className="text-lg font-semibold text-foreground">Response Targets</h3>
                  <ul className="mt-3 space-y-2 text-sm text-foreground">
                    <li>• Critical (system outage or data loss): Immediate escalation, under 15 minutes</li>
                    <li>• High (trade-impacting bug): Dedicated channel with fix or workaround under 2 hours</li>
                    <li>• Standard (UX friction, roadmap): Same-day response with ETA or workaround</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-3xl border border-border/40 bg-background/90 p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-foreground">Self-Serve Resources</h3>
                <p className="mt-3 text-sm text-foreground">
                  Review these resources before opening a support ticket — you may find the answer immediately.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-foreground">
                  <li>• Weekly recap newsletter with macro and platform updates</li>
                  <li>• Video walkthroughs embedded in Signals, Alerts, and Mentor views</li>
                  <li>• This documentation (bookmark for reference)</li>
                  <li>• Discord announcements channel for change logs</li>
                </ul>
              </div>
              <div className="rounded-3xl border border-border/40 bg-background/90 p-6">
                <h3 className="text-lg font-semibold text-foreground">Need live assistance?</h3>
                <p className="mt-2 text-sm text-foreground">
                  Message a moderator on Discord or create a support ticket in our Discord server. Include screenshots, trade IDs, and timeframe to accelerate resolution.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    className="gap-2"
                    onClick={() => window.open("https://discord.gg/sjsJwdZPew", "_blank", "noopener noreferrer")}
                  >
                    <LifeBuoy className="h-4 w-4" />
                    Open Discord Support
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto mt-20 max-w-5xl space-y-6 px-6 lg:px-8">
          <header className="space-y-2">
            <Badge variant="outline" className="border-purple-400/50 bg-purple-500/10 text-purple-200">
              FAQ
            </Badge>
            <h2 className="text-3xl font-bold text-foreground">Answers to the most common operational questions</h2>
            <p className="max-w-3xl text-foreground">
              If your question isn't listed, reach out via Discord or file a feedback ticket from the dashboard.
            </p>
          </header>
          <div className="space-y-4">
            {faqEntries.map((entry) => (
              <details
                key={entry.question}
                className="group rounded-2xl border border-border/40 bg-background/85 p-6 shadow-lg shadow-purple-400/10"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-lg font-semibold text-foreground">
                  <span>{entry.question}</span>
                  <span className="text-sm text-foreground group-open:hidden">Expand</span>
                  <span className="hidden text-sm text-foreground group-open:inline">Collapse</span>
                </summary>
                <p className="mt-3 text-sm text-foreground leading-relaxed">{entry.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto mt-20 max-w-4xl rounded-3xl border border-primary/40 bg-primary/10 p-10 text-center shadow-2xl shadow-primary/20 lg:p-14">
          <h2 className="text-3xl font-bold text-foreground">
            Ready to put the docs into practice?
          </h2>
          <p className="mt-3 text-base text-foreground">
            The dashboard, Discord community, and this documentation work together. Stay in the loop, share wins,
            surface issues, and keep iterating. We built Jack Of All Trades to amplify disciplined traders.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link to="/dashboard">
                <Workflow className="h-4 w-4" />
                Open Dashboard
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="gap-2 border-primary/40 bg-primary/5 text-foreground hover:bg-primary/15"
              onClick={() => window.open("https://discord.gg/sjsJwdZPew", "_blank", "noopener noreferrer")}
            >
              <LifeBuoy className="h-4 w-4" />
              Talk to Support
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Docs;

