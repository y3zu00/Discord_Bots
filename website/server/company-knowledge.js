// Centralized company knowledge used by Mentor prompts
// Keep concise, factual, and up to date with product naming used in the app

export function getCompanyKnowledge() {
  return {
    company: {
      name: 'Jack Of All Trades (JOAT)',
      mission: 'Give traders an all-in-one, fast, reliable dashboard with clear signals, live prices, and a practical AI mentor.',
      tone: 'friendly, practical, concise, zero-fluff',
      ai: 'JOAT is AI-powered: an AI Mentor, AI-assisted alerts and analysis support the user experience.',
    },
    products: {
      Overview: 'Dashboard snapshot of recent signals and latest headlines. Spacing and dividers tuned for clarity.',
      Prices: 'Crypto and Stocks. Live updates with WS throttle for majors. Per-row flash (up/down), tabular-nums to avoid jitter, sparklines. Widgets: Market Cap (with 24h delta spark), BTC Dominance (pill bar centered, percent label), Fear & Greed (semicircle gauge), Altcoin Season Index. Mobile shows only name and price.',
      Signals: 'Neon-backed signals with asset logos for crypto and stocks. Admin create/delete with confirmation, NEW badge fades after 2 hours. WS broadcast on insert. Details dialog shows proper logo and metadata.',
      Watchlist: 'User watchlist with live ticks (WS + 30s polling), robust symbol resolution, logos via /api/coin, drag-and-drop reorder with persistence to Neon, row hover animation, price flash up/down, delete confirmation. Local→Neon sync if server list is empty.',
      Alerts: 'Price and percent alerts. Create, edit in place (PATCH), toggle active. Per-symbol logo via batch /api/coins. Stored in Neon. Cards include short description and sparkline.',
      News: 'Alpha Vantage primary, CryptoPanic fallback with circuit breaker and last-good cache. No-flicker refresh: prior items remain visible and a top pulse bar indicates refresh. Source color tags and detail dialog.',
      Indicators: 'TradingView suite with four visuals pulled directly from the landing page: Big Whale Finder PRO (order-flow + whale heat map), Sharingan Market Vision Pro (market structure & liquidity), Ice Elves Winter Arrow (SMC + Koncorde + Laguerre filters), and Ghosted Night Strategy (module-scored smart-money system). Dashboard indicator tab mirrors the same look and copy.',
      Mentor: 'Company-aware AI assistant using session (plan, admin, trial) and user context (watchlist, alerts, recent signals, optional coin). Concise by default, depth mode on request. Provides CTA to website and Discord on company questions.',
      Notifications: 'Announcements feed powered by Neon. Admin can publish/delete with confirmation. Users can dismiss/restore items; dismissed tab available; ADMIN and NEW badges.',
      Account: 'Username updates persist to Neon and cookie re-issued. Preferences (notification toggles, privacy) saved in Neon. Trial status surfaced; in production trials are WHOP-managed.',
    },
    plans: {
      Free: { gates: ['baseline access'] },
      Core: { gates: ['Signals'] },
      Pro: { gates: ['Mentor', 'advanced features'] },
      Elite: { gates: ['Everything, priority'] },
    },
    trials: {
      proTrial: '7-day Pro trial via WHOP webhook. During trial, UI surfaces Pro features; plan may remain Free in DB but session elevates to Pro while active.',
    },
    bots: {
      analysis: 'JackOfAllAnalysis — Upload or paste any chart screenshot and get AI-powered entry/exit, structure, and risk notes instantly.',
      codes: 'JackOfAllCodes — Pine Script coding partner that drafts, debugs, and optimizes indicators/strategies for TradingView.',
      knowledge: 'Jack Of All Knowledge — Discord and web mentor trained on JOAT course material and live market context.',
      news: 'JackOfAllNews — 4-hour Discord drops sourced from Alpha Vantage, CryptoPanic, and Finnhub, ranked by sentiment/recency, rewritten into Summary/Breakdown/Impact, and paired with AI-generated artwork.',
      signals: 'JackOfAllSignals — Discord signals bot mirrored into /api/signals with daily auto-posts, watchlist, alerts, and interactive charts.',
      questions: 'JackOfAllQuestions — Daily questions bot that posts polls, explanations, and tracks leaderboard stats.',
      options: 'JackOfAllOptions — Real-time options-flow intelligence with multi-venue sweeps, dark-pool context, Discord embeds, auto threads, and backtests.',
      whale: 'JackOfAllWhales — Discord AI agent for whale tracking, dual-AI analysis, arbitrage scanning, institutional portfolio intelligence, and webhook alerts.',
      indicators: 'TradingView indicator suite: Big Whale Finder PRO, Sharingan Market Vision Pro, Ice Elves Winter Arrow, and Ghosted Night Strategy, all showcased inside the dashboard indicator tab.',
    },

    pages: ['Overview','Prices','Signals','Watchlist','News','Alerts','Mentor','Notifications','Account','Admin'],
    constraints: [
      'Provide trading opinions, insights, and market analysis. Share confident perspectives on price movements and trading strategies.',
      'Be concise by default; expand details only if the user asks.',
      'Refer to features exactly as they exist in the app.',
      'If a feature is gated by plan, say so and suggest upgrading.',
      'Avoid em dashes (—); use commas or periods instead.',
    ],
  };
}


