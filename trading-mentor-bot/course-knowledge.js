// Knowledge Base for Trading Mentor Bot
// Pure trading knowledge plus lightweight server/bots context

const tradingKnowledge = {
    // Trading Basics
    basics: {
      riskManagement: "Always risk only 1-2% of your account per trade. Use stop losses and never risk more than you can afford to lose.",
      positionSizing: "Calculate position size based on your risk tolerance and account size. Formula: (Account Size × Risk %) ÷ Stop Loss Distance",
      psychology: "Trading is 80% psychology, 20% strategy. Control your emotions and stick to your trading plan."
    },
    
    // Technical Analysis
    technicalAnalysis: {
      supportResistance: "Support and resistance levels are key areas where price tends to bounce. Use multiple timeframes to confirm levels.",
      indicators: "RSI, MACD, and moving averages are popular indicators. Don't use too many—stick to 2-3 that work for you.",
      chartPatterns: "Common patterns include head and shoulders, triangles, and flags. Always wait for confirmation before trading."
    },
    
    // Trading Strategies
    strategies: {
      scalping: "Scalping involves quick trades for small profits. Requires tight spreads and fast execution.",
      swingTrading: "Swing trading holds positions for days to weeks. Focus on higher timeframes and major trends.",
      dayTrading: "Day trading closes all positions by end of day. Requires discipline and quick decision making."
    },
    
    // Market Psychology
    psychology: {
      fearGreed: "Fear and greed drive markets. Learn to recognize these emotions in yourself and others.",
      fomo: "Fear of missing out leads to poor decisions. Stick to your strategy and don't chase trades.",
      discipline: "Successful trading requires strict discipline. Follow your rules even when emotions are high."
    },
    
    // Market Analysis
    marketAnalysis: {
      trendFollowing: "Trend is your friend. Trade in the direction of the overall market trend for higher probability setups.",
      volumeAnalysis: "Volume confirms price action. High volume on breakouts and reversals adds credibility to the move.",
      marketStructure: "Understand market structure - higher highs, higher lows for uptrends, lower highs, lower lows for downtrends."
    },
    
    // Risk Management
    riskManagement: {
      stopLosses: "Always use stop losses. Your future self will thank you when a trade goes against you.",
      positionSizing: "Never risk more than 1-2% of your account on any single trade. This keeps you in the game long-term.",
      diversification: "Don't put all your eggs in one basket. Diversify across different sectors and asset classes."
    }
  };

// Lightweight server/bots context
const serverContext = {
  serverName: 'Jack Of All Trades',
  vibe: 'friendly, practical trading community with signals, Q&A, and a mentor bot',
  channels: {
    commands: '💬・commands',
    signals: '📈・signals',
    general: '💬・general'
  },
  bots: {
    mentor: 'Jack Of All Knowledge — DM-friendly trading mentor',
    signals: 'Jack Of All Signals — community signals, watchlist, alerts',
    questions: 'Jack Of All Questions — daily trading questions and leaderboards',
    news: 'Jack Of All News — daily news and updates',
    coding: 'Jack Of All Codes - pine script coding'
  }
};
  
  // Function to get relevant trading content based on user question
  function getRelevantContent(userQuestion) {
    const question = userQuestion.toLowerCase();
    let relevantContent = [];
    
    // Search through knowledge base for relevant topics
    if (question.includes('risk') || question.includes('management')) {
      relevantContent.push(tradingKnowledge.basics.riskManagement);
      relevantContent.push(tradingKnowledge.basics.positionSizing);
      relevantContent.push(tradingKnowledge.riskManagement.stopLosses);
      relevantContent.push(tradingKnowledge.riskManagement.positionSizing);
    }
    
    if (question.includes('technical') || question.includes('analysis') || question.includes('indicator')) {
      relevantContent.push(tradingKnowledge.technicalAnalysis.supportResistance);
      relevantContent.push(tradingKnowledge.technicalAnalysis.indicators);
      relevantContent.push(tradingKnowledge.technicalAnalysis.chartPatterns);
    }
    
    if (question.includes('strategy') || question.includes('scalp') || question.includes('swing') || question.includes('day trade')) {
      relevantContent.push(tradingKnowledge.strategies.scalping);
      relevantContent.push(tradingKnowledge.strategies.swingTrading);
      relevantContent.push(tradingKnowledge.strategies.dayTrading);
    }
    
    if (question.includes('psychology') || question.includes('emotion') || question.includes('fear') || question.includes('greed')) {
      relevantContent.push(tradingKnowledge.psychology.fearGreed);
      relevantContent.push(tradingKnowledge.psychology.fomo);
      relevantContent.push(tradingKnowledge.psychology.discipline);
    }
    
    if (question.includes('trend') || question.includes('market') || question.includes('volume')) {
      relevantContent.push(tradingKnowledge.marketAnalysis.trendFollowing);
      relevantContent.push(tradingKnowledge.marketAnalysis.volumeAnalysis);
      relevantContent.push(tradingKnowledge.marketAnalysis.marketStructure);
    }
    
    return relevantContent.join('\n\n');
  }
  
  function getServerContextString() {
    return `SERVER CONTEXT:\n- Server: ${serverContext.serverName}\n- Vibe: ${serverContext.vibe}\n- Channels: commands=${serverContext.channels.commands}, signals=${serverContext.channels.signals}, general=${serverContext.channels.general}\n- Bots: mentor=${serverContext.bots.mentor}, signals=${serverContext.bots.signals}, questions=${serverContext.bots.questions}`;
  }

  module.exports = { tradingKnowledge, getRelevantContent, getServerContextString };