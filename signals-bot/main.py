import asyncio
import datetime as dt
import json
import logging
import math
import os
import re
import random
import time
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple, Set

import pandas as pd
import requests
import pytz
import yfinance as yf
from discord import AllowedMentions, Intents, Embed, Color, File, app_commands, ui, ButtonStyle, Interaction
from discord.errors import Forbidden
from discord.ext import commands, tasks
from tradingview_ta import Interval, TA_Handler

from get_tickers import Get_Tickers
from secret import Secret
from chart_generator import generate_signal_chart
from db import DatabaseManager
# Curated popular symbols for autocomplete (kept static to avoid rate limits)
TOP_CRYPTO_SYMBOLS = [
    'BTC','ETH','SOL','BNB','XRP','ADA','DOGE','MATIC','TRX','TON',
    'DOT','LINK','AVAX','LTC','SHIB','BCH','ATOM','XLM','ETC','XMR',
    'APT','ARB','OP','SUI','NEAR','ALGO','FIL','INJ','RUNE','AAVE',
    'UNI','MKR','COMP','SNX','LDO','IMX','PYTH','SEI','STX','GALA',
    'HBAR','FLOW','EGLD','KAS','KAVA','XTZ','PEPE','WIF','BONK','TIA',
]

TOP_STOCK_SYMBOLS = [
    'AAPL','MSFT','NVDA','AMZN','GOOGL','GOOG','META','TSLA','AVGO','AMD',
    'NFLX','ADBE','INTC','COST','PEP','KO','MCD','V','MA','JPM',
    'BAC','WFC','UNH','JNJ','PG','HD','DIS','NKE','TSM','BABA',
    'CRM','LIN','TXN','QCOM','AMAT','ORCL','IBM','CSCO','SHOP','PFE',
    'T','VZ','SQ','PYPL','SPY','QQQ','SMCI','PLTR','UBER','ABNB',
]


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


BOT_NAME = "Jack Of All Signals"
PACIFIC_TZ = pytz.timezone("US/Pacific")
EASTERN_TZ = pytz.timezone("US/Eastern")

# Local market run times (US/Eastern) for daily signals
SIGNAL_RUN_TIMES_LOCAL = (
    dt.time(9, 30),   # Market open scan
    dt.time(13, 0),   # Midday scan
    dt.time(15, 30),  # Power-hour scan
)

# Admin notification run (end-of-day) — once daily to conserve API credits
ADMIN_NOTIFY_RUN_TIMES_LOCAL = (
    dt.time(21, 30),  # 9:30 PM Eastern
)


def _compute_signal_run_times_utc(local_times: Tuple[dt.time, ...], tz: pytz.BaseTzInfo) -> Tuple[dt.time, ...]:
    """Convert timezone-aware run times to naive UTC times for discord.py tasks."""
    reference = dt.datetime.now(tz)
    schedule: List[dt.time] = []
    for t in local_times:
        localized = reference.replace(
            hour=t.hour,
            minute=t.minute,
            second=t.second,
            microsecond=t.microsecond,
        )
        utc_dt = localized.astimezone(pytz.UTC)
        schedule.append(dt.time(utc_dt.hour, utc_dt.minute, utc_dt.second))
    return tuple(schedule)


SIGNAL_RUN_TIMES = _compute_signal_run_times_utc(SIGNAL_RUN_TIMES_LOCAL, EASTERN_TZ)
ADMIN_NOTIFY_RUN_TIMES = _compute_signal_run_times_utc(ADMIN_NOTIFY_RUN_TIMES_LOCAL, EASTERN_TZ)

try:
    local_schedule_str = ", ".join(t.strftime("%I:%M %p") for t in SIGNAL_RUN_TIMES_LOCAL)
    utc_schedule_str = ", ".join(t.strftime("%H:%M" ) for t in SIGNAL_RUN_TIMES)
    logging.info("Daily signal run times — Eastern: %s | UTC: %s", local_schedule_str, utc_schedule_str)
except Exception:
    pass
try:
    admin_local_str = ", ".join(t.strftime("%I:%M %p") for t in ADMIN_NOTIFY_RUN_TIMES_LOCAL)
    admin_utc_str = ", ".join(t.strftime("%H:%M") for t in ADMIN_NOTIFY_RUN_TIMES)
    logging.info("Admin notify run time — Eastern: %s | UTC: %s", admin_local_str, admin_utc_str)
except Exception:
    pass
# Duplicate prevention window (default 24h) and performance re-check cadence
SIGNAL_DUPLICATE_WINDOW_MINUTES = int(os.getenv("SIGNAL_DUPLICATE_WINDOW_MINUTES", "1440"))
SIGNAL_PERFORMANCE_RECHECK_MINUTES = int(os.getenv("SIGNAL_PERFORMANCE_RECHECK_MINUTES", "15"))
MAX_CRYPTO_CANDIDATES = int(os.getenv("SIGNAL_MAX_CRYPTO_CANDIDATES", "24"))
# Rate limiting configuration
RATE_LIMIT_DELAY = 3.0  # Base delay between requests (increased to avoid rate limits)
MAX_RETRIES = 3
CIRCUIT_BREAKER_THRESHOLD = 5  # Number of consecutive failures before circuit breaker
CIRCUIT_BREAKER_TIMEOUT = 300  # 5 minutes in seconds

# Price cache configuration
PRICE_CACHE_TTL_SECONDS = int(os.getenv("PRICE_CACHE_TTL_SECONDS", "60"))
PRICE_CACHE_MAX_ENTRIES = int(os.getenv("PRICE_CACHE_MAX_ENTRIES", "400"))

# TradingView TA cache configuration
TRADINGVIEW_CACHE_TTL_SECONDS = int(os.getenv("TRADINGVIEW_CACHE_TTL_SECONDS", "3600"))  # 1 hour default
TRADINGVIEW_CACHE_MAX_ENTRIES = int(os.getenv("TRADINGVIEW_CACHE_MAX_ENTRIES", "200"))
CHART_GENERATION_MAX_ATTEMPTS = int(os.getenv("CHART_GENERATION_MAX_ATTEMPTS", "3"))
CHART_GENERATION_RETRY_DELAY_SECONDS = float(os.getenv("CHART_GENERATION_RETRY_DELAY_SECONDS", "1.5"))

# Price cache state (symbol key -> cached payload)
_PRICE_CACHE: Dict[str, Dict[str, Any]] = {}
_PRICE_CACHE_TS: Dict[str, float] = {}
_PRICE_CACHE_INFLIGHT: Dict[str, "asyncio.Task[Optional[Dict[str, Any]]]"] = {}

# TradingView TA cache state (key: (symbol, screener, exchange) -> cached TA results)
_TRADINGVIEW_CACHE: Dict[Tuple[str, str, str], Dict[str, str]] = {}
_TRADINGVIEW_CACHE_TS: Dict[Tuple[str, str, str], float] = {}

# CoinGecko helper caches to reduce repeated lookups
COINGECKO_DETAIL_CACHE_TTL = int(os.getenv("COINGECKO_DETAIL_CACHE_TTL", "600"))
_COINGECKO_SYMBOL_MAP: Dict[str, str] = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'BNB': 'binancecoin',
    'XRP': 'ripple',
    'ADA': 'cardano',
    'DOGE': 'dogecoin',
    'MATIC': 'polygon-pos',
    'LTC': 'litecoin',
    'DOT': 'polkadot',
    'LINK': 'chainlink',
    'AVAX': 'avalanche-2',
}
_COINGECKO_SYMBOL_MAP_TS: float = 0.0
_COINGECKO_DETAIL_CACHE: Dict[str, Dict[str, Any]] = {}
_COINGECKO_DETAIL_CACHE_TS: Dict[str, float] = {}


def _clone_price_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    """Return a shallow copy of cached price payload to avoid accidental mutation."""
    return dict(data) if data else {}


def _store_price_cache_entry(cache_key: str, payload: Dict[str, Any]) -> None:
    """Store a price payload in cache with eviction of oldest entries."""
    if not payload:
        return
    _PRICE_CACHE[cache_key] = _clone_price_payload(payload)
    _PRICE_CACHE_TS[cache_key] = time.time()
    # Evict oldest entry if exceeding max size
    if len(_PRICE_CACHE) > PRICE_CACHE_MAX_ENTRIES:
        oldest_key = min(_PRICE_CACHE_TS, key=_PRICE_CACHE_TS.get, default=None)
        if oldest_key:
            _PRICE_CACHE.pop(oldest_key, None)
            _PRICE_CACHE_TS.pop(oldest_key, None)

# Global rate limiting state
last_request_time = 0
last_tradingview_request_time = 0

# API-specific circuit breakers
tradingview_consecutive_failures = 0
tradingview_circuit_breaker_active = False
tradingview_circuit_breaker_start_time = 0

price_api_consecutive_failures = 0
price_api_circuit_breaker_active = False
price_api_circuit_breaker_start_time = 0

# Minimal runtime metrics
METRICS = {
    "api_success_total": 0,
    "api_failure_total": 0,
    "circuit_breaker_trips_total": 0,
    "button_clicks_total": 0,
    "button_watchlist_clicks_total": 0,
    "button_setalert_clicks_total": 0,
    "button_dm_toggle_clicks_total": 0,
    "dms_sent_total": 0,
}


class RateLimitError(Exception):
    """Exception raised when rate limit is exceeded."""
    pass


class CircuitBreakerError(Exception):
    """Exception raised when circuit breaker is active."""
    pass


def check_circuit_breaker(api_type: str = "tradingview"):
    """
    Check if circuit breaker should be active for a specific API type.
    
    Args:
        api_type: "tradingview" or "price_api"
    """
    global tradingview_circuit_breaker_active, tradingview_circuit_breaker_start_time
    global tradingview_consecutive_failures
    global price_api_circuit_breaker_active, price_api_circuit_breaker_start_time
    global price_api_consecutive_failures
    
    if api_type == "tradingview":
        if tradingview_circuit_breaker_active:
            if time.time() - tradingview_circuit_breaker_start_time > CIRCUIT_BREAKER_TIMEOUT:
                # Reset circuit breaker
                tradingview_circuit_breaker_active = False
                tradingview_consecutive_failures = 0
                logging.info("TradingView circuit breaker reset - resuming normal operations")
            else:
                raise CircuitBreakerError("TradingView circuit breaker is active - too many consecutive failures")
        
        if tradingview_consecutive_failures >= CIRCUIT_BREAKER_THRESHOLD:
            tradingview_circuit_breaker_active = True
            tradingview_circuit_breaker_start_time = time.time()
            logging.warning(f"TradingView circuit breaker activated after {tradingview_consecutive_failures} consecutive failures")
            METRICS["circuit_breaker_trips_total"] = METRICS.get("circuit_breaker_trips_total", 0) + 1
            raise CircuitBreakerError("TradingView circuit breaker activated - too many consecutive failures")
    
    elif api_type == "price_api":
        if price_api_circuit_breaker_active:
            if time.time() - price_api_circuit_breaker_start_time > CIRCUIT_BREAKER_TIMEOUT:
                # Reset circuit breaker
                price_api_circuit_breaker_active = False
                price_api_consecutive_failures = 0
                logging.info("Price API circuit breaker reset - resuming normal operations")
            else:
                raise CircuitBreakerError("Price API circuit breaker is active - too many consecutive failures")
        
        if price_api_consecutive_failures >= CIRCUIT_BREAKER_THRESHOLD:
            price_api_circuit_breaker_active = True
            price_api_circuit_breaker_start_time = time.time()
            logging.warning(f"Price API circuit breaker activated after {price_api_consecutive_failures} consecutive failures")
            METRICS["circuit_breaker_trips_total"] = METRICS.get("circuit_breaker_trips_total", 0) + 1
            raise CircuitBreakerError("Price API circuit breaker activated - too many consecutive failures")


def update_rate_limit():
    """Update rate limiting state."""
    global last_request_time
    current_time = time.time()
    time_since_last = current_time - last_request_time
    
    if time_since_last < RATE_LIMIT_DELAY:
        sleep_time = RATE_LIMIT_DELAY - time_since_last
        time.sleep(sleep_time)
    
    last_request_time = time.time()


async def update_rate_limit_async(api_type: str = "general"):
    """
    Async-friendly rate limiting helper with API-specific delays.
    
    Args:
        api_type: "tradingview" (8-10s delay) or "general" (3s delay)
    """
    global last_request_time, last_tradingview_request_time
    
    if api_type == "tradingview":
        # TradingView needs longer delays to avoid rate limits
        TRADINGVIEW_DELAY = 8.0  # 8 seconds between TradingView requests
        current_time = time.time()
        time_since_last = current_time - last_tradingview_request_time
        if time_since_last < TRADINGVIEW_DELAY:
            sleep_time = TRADINGVIEW_DELAY - time_since_last
            await asyncio.sleep(sleep_time)
        last_tradingview_request_time = time.time()
    else:
        # General API rate limiting
        current_time = time.time()
        time_since_last = current_time - last_request_time
        if time_since_last < RATE_LIMIT_DELAY:
            sleep_time = RATE_LIMIT_DELAY - time_since_last
            await asyncio.sleep(sleep_time)
        last_request_time = time.time()


def handle_api_failure(api_type: str = "tradingview"):
    """
    Handle API failure and update circuit breaker state for specific API type.
    
    Args:
        api_type: "tradingview" or "price_api"
    """
    global tradingview_consecutive_failures, price_api_consecutive_failures
    
    if api_type == "tradingview":
        tradingview_consecutive_failures += 1
        logging.warning(f"TradingView API failure #{tradingview_consecutive_failures}")
    elif api_type == "price_api":
        price_api_consecutive_failures += 1
        logging.warning(f"Price API failure #{price_api_consecutive_failures}")
    
    METRICS["api_failure_total"] = METRICS.get("api_failure_total", 0) + 1


def handle_api_success(api_type: str = "tradingview"):
    """
    Handle successful API call and reset failure count for specific API type.
    
    Args:
        api_type: "tradingview" or "price_api"
    """
    global tradingview_consecutive_failures, price_api_consecutive_failures
    
    if api_type == "tradingview":
        tradingview_consecutive_failures = 0
    elif api_type == "price_api":
        price_api_consecutive_failures = 0
    
    METRICS["api_success_total"] = METRICS.get("api_success_total", 0) + 1


def map_recommendation_to_score(recommendation: str) -> int:
    mapping = {
        "STRONG_BUY": 2,
        "BUY": 1,
        "NEUTRAL": 0,
        "SELL": -1,
        "STRONG_SELL": -2,
    }
    return mapping.get((recommendation or "").upper(), 0)


def compute_pivots(previous_high: float, previous_low: float, previous_close: float) -> Dict[str, float]:
    pivot_point = (previous_high + previous_low + previous_close) / 3.0
    r1 = (2 * pivot_point) - previous_low
    s1 = (2 * pivot_point) - previous_high
    r2 = pivot_point + (previous_high - previous_low)
    s2 = pivot_point - (previous_high - previous_low)
    r3 = previous_high + 2 * (pivot_point - previous_low)
    s3 = previous_low - 2 * (previous_high - pivot_point)
    return {
        "PP": pivot_point,
        "R1": r1,
        "S1": s1,
        "R2": r2,
        "S2": s2,
        "R3": r3,
        "S3": s3,
    }


def safe_number(value: Optional[float], digits: int = 4) -> Optional[float]:
    try:
        if value is None:
            return None
        val = float(value)
        if math.isnan(val) or math.isinf(val):
            return None
        return round(val, digits)
    except Exception:
        return None


def compute_confidence(score: int) -> str:
    if score >= 12:
        return "High"
    if score >= 6:
        return "Medium"
    return "Low"


def percent_change(target: Optional[float], reference: Optional[float]) -> Optional[float]:
    try:
        if target is None or reference is None:
            return None
        ref = float(reference)
        tgt = float(target)
        if ref == 0:
            return None
        val = ((tgt - ref) / ref) * 100.0
        if math.isnan(val) or math.isinf(val):
            return None
        return round(val, 2)
    except Exception:
        return None


async def fetch_price_context_yf_with_retry(symbol: str, max_retries: int = MAX_RETRIES) -> Optional[Dict[str, float]]:
    """Enhanced version with retry logic for yfinance."""
    check_circuit_breaker("price_api")
    
    for attempt in range(max_retries):
        try:
            await update_rate_limit_async("general")
            
            ticker = yf.Ticker(symbol)

            todays = ticker.history(period="1d", interval="1m")
            if todays.empty:
                todays = ticker.history(period="1d")
            current_price = float(todays["Close"].iloc[-1])
            hod = float(todays["High"].max()) if "High" in todays else current_price

            # Previous trading day for pivot levels and reference close
            daily = ticker.history(period="5d", interval="1d")
            previous_close = None
            if len(daily) >= 2:
                prev = daily.iloc[-2]
                previous_close = float(prev["Close"])
                pivots = compute_pivots(float(prev["High"]), float(prev["Low"]), float(prev["Close"]))
            else:
                pivots = {k: float("nan") for k in ["PP", "R1", "S1", "R2", "S2", "R3", "S3"]}

            day_change_pct = percent_change(current_price, previous_close) if previous_close else None

            logo_url = None
            company_name = None
            try:
                info = ticker.info or {}
                logo_url = info.get("logo_url") or info.get("logo") or info.get("image")
                company_name = info.get("longName") or info.get("shortName") or info.get("displayName")
            except Exception:
                logo_url = None
                company_name = None

            handle_api_success("price_api")
            return {
                "yf_symbol": symbol,
                "current_price": current_price,
                "hod": hod,
                "previous_close": previous_close,
                "day_change_pct": day_change_pct,
                **pivots,
                "logo_url": logo_url,
                "company_name": company_name,
            }
            
        except CircuitBreakerError:
            # Re-raise circuit breaker errors
            raise
        except Exception as exc:
            logging.warning(f"yfinance attempt {attempt + 1} failed for {symbol}: {exc}")
            
            if attempt < max_retries - 1:
                # Exponential backoff with jitter
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                await asyncio.sleep(wait_time)
            else:
                handle_api_failure("price_api")
                return None
    
    return None


def fetch_price_context_yf(symbol: str) -> Optional[Dict[str, float]]:
    """Legacy synchronous version for backward compatibility."""
    try:
        ticker = yf.Ticker(symbol)

        todays = ticker.history(period="1d", interval="1m")
        if todays.empty:
            todays = ticker.history(period="1d")
        current_price = float(todays["Close"].iloc[-1])
        hod = float(todays["High"].max()) if "High" in todays else current_price

        # Previous trading day for pivot levels
        daily = ticker.history(period="5d", interval="1d")
        if len(daily) >= 2:
            prev = daily.iloc[-2]
            pivots = compute_pivots(float(prev["High"]), float(prev["Low"]), float(prev["Close"]))
        else:
            pivots = {k: float("nan") for k in ["PP", "R1", "S1", "R2", "S2", "R3", "S3"]}

        logo_url = None
        company_name = None
        try:
            info = ticker.info or {}
            logo_url = info.get("logo_url") or info.get("logo") or info.get("image")
            company_name = info.get("longName") or info.get("shortName") or info.get("displayName")
        except Exception:
            logo_url = None
            company_name = None

        return {
            "yf_symbol": symbol,
            "current_price": current_price,
            "hod": hod,
            **pivots,
            "logo_url": logo_url,
            "company_name": company_name,
        }
    except Exception as exc:
        logging.warning("yfinance failed for %s: %s", symbol, exc)
        return None


async def calculate_ta_from_price_data(symbol: str, price_data: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, str]]:
    """
    Calculate TA recommendations from price data as fallback when TradingView fails.
    Uses simple indicators: RSI, Moving Averages, Price Momentum.
    
    Args:
        symbol: Stock symbol
        price_data: Optional price context dict (if already fetched)
    
    Returns:
        Dict with timeframe recommendations: {"5m": "BUY", "15m": "BUY", "1h": "NEUTRAL", "1d": "BUY"}
    """
    try:
        # Fetch price data if not provided
        if price_data is None:
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="30d", interval="1d")
            if data.empty:
                return None
        else:
            # Use provided price data to fetch historical data
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="30d", interval="1d")
            if data.empty:
                return None
        
        if len(data) < 14:  # Need at least 14 days for RSI
            return None
        
        # Calculate simple indicators
        closes = data['Close'].values
        highs = data['High'].values
        lows = data['Low'].values
        
        # Simple RSI calculation (14 period)
        def calculate_rsi(prices, period=14):
            deltas = pd.Series(prices).diff()
            gains = deltas.where(deltas > 0, 0)
            losses = -deltas.where(deltas < 0, 0)
            avg_gain = gains.rolling(window=period).mean()
            avg_loss = losses.rolling(window=period).mean()
            rs = avg_gain / avg_loss
            rsi = 100 - (100 / (1 + rs))
            return rsi.iloc[-1] if not rsi.empty else 50
        
        # Moving averages
        sma_20 = closes[-20:].mean() if len(closes) >= 20 else closes.mean()
        sma_50 = closes[-50:].mean() if len(closes) >= 50 else closes.mean()
        current_price = closes[-1]
        
        # Price momentum
        price_change_5d = ((closes[-1] - closes[-5]) / closes[-5] * 100) if len(closes) >= 5 else 0
        price_change_20d = ((closes[-1] - closes[-20]) / closes[-20] * 100) if len(closes) >= 20 else 0
        
        # Calculate RSI
        rsi = calculate_rsi(closes)
        
        # Generate recommendations based on indicators
        def get_recommendation(rsi_val, price_vs_sma20, price_vs_sma50, momentum_5d, momentum_20d):
            buy_signals = 0
            sell_signals = 0
            
            # RSI signals
            if rsi_val < 30:
                buy_signals += 2  # Oversold
            elif rsi_val > 70:
                sell_signals += 2  # Overbought
            elif rsi_val < 50:
                buy_signals += 1
            else:
                sell_signals += 1
            
            # Moving average signals
            if current_price > sma_20:
                buy_signals += 1
            else:
                sell_signals += 1
            
            if current_price > sma_50:
                buy_signals += 1
            else:
                sell_signals += 1
            
            # Momentum signals
            if momentum_5d > 2:
                buy_signals += 1
            elif momentum_5d < -2:
                sell_signals += 1
            
            if momentum_20d > 5:
                buy_signals += 1
            elif momentum_20d < -5:
                sell_signals += 1
            
            # Determine recommendation
            if buy_signals >= 4:
                return "STRONG_BUY"
            elif buy_signals >= 2:
                return "BUY"
            elif sell_signals >= 4:
                return "STRONG_SELL"
            elif sell_signals >= 2:
                return "SELL"
            else:
                return "NEUTRAL"
        
        # Generate recommendations for each timeframe (simplified - same logic for all)
        # In a real implementation, you'd use different timeframes of data
        base_reco = get_recommendation(rsi, current_price - sma_20, current_price - sma_50, price_change_5d, price_change_20d)
        
        # Return recommendations for all timeframes
        # Shorter timeframes get slightly more aggressive signals
        results = {
            "5m": base_reco,
            "15m": base_reco,
            "1h": base_reco,
            "1d": base_reco,
        }
        
        # Adjust shorter timeframes to be slightly more conservative
        if base_reco == "STRONG_BUY":
            results["5m"] = "BUY"
            results["15m"] = "BUY"
        elif base_reco == "STRONG_SELL":
            results["5m"] = "SELL"
            results["15m"] = "SELL"
        
        return results
        
    except Exception as exc:
        logging.warning(f"Failed to calculate TA from price data for {symbol}: {exc}")
        return None


async def analyze_symbol_tradingview_with_retry(
    symbol: str,
    *,
    screener: str = "america",
    exchange: str = "NASDAQ",
    max_retries: int = MAX_RETRIES,
    price_data: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, str]]:
    """
    Enhanced version with retry logic, rate limiting, and caching.
    Falls back to calculated TA if TradingView fails.
    
    Args:
        symbol: Stock symbol
        screener: TradingView screener
        exchange: TradingView exchange
        max_retries: Maximum retry attempts
        price_data: Optional price context for fallback TA calculation
    """
    global _TRADINGVIEW_CACHE, _TRADINGVIEW_CACHE_TS
    
    # Check cache first
    cache_key = (symbol, screener, exchange)
    now = time.time()
    cached_result = _TRADINGVIEW_CACHE.get(cache_key)
    cache_age = now - _TRADINGVIEW_CACHE_TS.get(cache_key, 0)
    
    if cached_result and cache_age <= TRADINGVIEW_CACHE_TTL_SECONDS:
        logging.debug(f"Using cached TradingView TA for {symbol}")
        return cached_result.copy()
    
    # Check circuit breaker
    try:
        check_circuit_breaker("tradingview")
    except CircuitBreakerError:
        # Circuit breaker active - use fallback TA
        logging.info(f"TradingView circuit breaker active for {symbol}, using fallback TA")
        fallback_result = await calculate_ta_from_price_data(symbol, price_data)
        if fallback_result:
            return fallback_result
        return None
    
    # Try TradingView API
    for attempt in range(max_retries):
        try:
            await update_rate_limit_async("tradingview")
            
            timeframes = {
                "5m": Interval.INTERVAL_5_MINUTES,
                "15m": Interval.INTERVAL_15_MINUTES,
                "1h": Interval.INTERVAL_1_HOUR,
                "1d": Interval.INTERVAL_1_DAY,
            }

            results: Dict[str, str] = {}
            for label, interval in timeframes.items():
                handler = TA_Handler(
                    symbol=symbol,
                    screener=screener,
                    exchange=exchange,
                    interval=interval,
                )
                summary = handler.get_analysis().summary
                results[label] = summary.get("RECOMMENDATION", "NEUTRAL")
                
                # Delay between timeframes to reduce rate limiting
                await asyncio.sleep(2.0)  # Increased from 0.5s to 2s
            
            # Cache the result
            _TRADINGVIEW_CACHE[cache_key] = results.copy()
            _TRADINGVIEW_CACHE_TS[cache_key] = time.time()
            
            # Evict oldest entries if cache is full
            if len(_TRADINGVIEW_CACHE) > TRADINGVIEW_CACHE_MAX_ENTRIES:
                oldest_key = min(_TRADINGVIEW_CACHE_TS, key=_TRADINGVIEW_CACHE_TS.get, default=None)
                if oldest_key:
                    _TRADINGVIEW_CACHE.pop(oldest_key, None)
                    _TRADINGVIEW_CACHE_TS.pop(oldest_key, None)
            
            handle_api_success("tradingview")
            return results
            
        except CircuitBreakerError:
            # Re-raise circuit breaker errors
            raise
        except Exception as exc:
            logging.warning(f"TradingView TA attempt {attempt + 1} failed for {symbol}: {exc}")
            
            if attempt < max_retries - 1:
                # Exponential backoff with jitter
                wait_time = (2 ** attempt) + random.uniform(1, 2)
                await asyncio.sleep(wait_time)
            else:
                handle_api_failure("tradingview")
                # Try fallback TA calculation
                logging.info(f"TradingView failed for {symbol}, attempting fallback TA calculation")
                fallback_result = await calculate_ta_from_price_data(symbol, price_data)
                if fallback_result:
                    return fallback_result
                return None
    
    return None


def analyze_symbol_tradingview(symbol: str) -> Optional[Dict[str, str]]:
    """Legacy synchronous version for backward compatibility."""
    try:
        timeframes = {
            "5m": Interval.INTERVAL_5_MINUTES,
            "15m": Interval.INTERVAL_15_MINUTES,
            "1h": Interval.INTERVAL_1_HOUR,
            "1d": Interval.INTERVAL_1_DAY,
        }

        results: Dict[str, str] = {}
        for label, interval in timeframes.items():
            handler = TA_Handler(
                symbol=symbol,
                screener="america",
                exchange="NASDAQ",
                interval=interval,
            )
            summary = handler.get_analysis().summary
            results[label] = summary.get("RECOMMENDATION", "NEUTRAL")
        return results
    except Exception as exc:
        logging.warning("TradingView TA failed for %s: %s", symbol, exc)
        return None


def score_symbol(reco_map: Dict[str, str]) -> int:
    # Weighted towards higher timeframes
    weights = {"5m": 1, "15m": 2, "1h": 3, "1d": 4}
    score = 0
    for tf, reco in reco_map.items():
        score += weights.get(tf, 1) * map_recommendation_to_score(reco)
    return score


def format_signal_message(
    symbol: str,
    reco_map: Dict[str, str],
    price_ctx: Dict[str, float],
) -> str:
    current_price = price_ctx.get("current_price")
    hod = price_ctx.get("hod")
    r1 = price_ctx.get("R1")
    r2 = price_ctx.get("R2")
    s1 = price_ctx.get("S1")
    s2 = price_ctx.get("S2")

    # Create TradingView chart URL
    chart_url = f"https://www.tradingview.com/symbols/NASDAQ-{symbol}/"
    
    # Calculate signal strength
    score = score_symbol(reco_map)
    signal_strength = "🟢 STRONG BUY" if score >= 6 else "🟡 BUY" if score >= 2 else "🔴 WEAK"
    
    # Format recommendations
    reco_text = " | ".join([f"{tf.upper()}: {reco_map.get(tf, 'N/A')}" for tf in ["5m", "15m", "1h", "1d"]])
    
    # Create enhanced message
    message = f"""🚨 **DAILY SIGNAL ALERT** 🚨

📊 **{symbol}** - {signal_strength}
💰 **Current Price:** ${current_price:.2f}
📈 **Today's High:** ${hod:.2f}

🎯 **Technical Analysis:**
{reco_text}

📊 **Key Levels:**
• **Support:** ${s1:.2f} | ${s2:.2f}
• **Resistance:** ${r1:.2f} | ${r2:.2f}

📈 **Chart:** {chart_url}

⚠️ **Risk Management:**
• Entry Zone: ${min(s1, s2):.2f} - ${max(s1, s2):.2f}
• Target 1: ${r1:.2f} (+{((r1/current_price-1)*100):.1f}%)
• Target 2: ${r2:.2f} (+{((r2/current_price-1)*100):.1f}%)
• Stop Loss: ${s2:.2f} (-{((current_price/s2-1)*100):.1f}%)

📢 **Not Financial Advice - Do Your Own Research**"""
    
    return message


# --- Smart price fetching for crypto vs equities ---
async def fetch_crypto_price(symbol: str) -> Optional[Dict[str, float]]:
    """Fetch crypto price via CoinGecko with caching to limit external calls."""
    try:
        global _COINGECKO_SYMBOL_MAP_TS
        symbol_upper = symbol.upper()
        coin_id = _COINGECKO_SYMBOL_MAP.get(symbol_upper)

        # Refresh the CoinGecko symbol map periodically to resolve unknown coins
        now = time.time()
        if not coin_id:
            refresh_needed = (now - _COINGECKO_SYMBOL_MAP_TS) > 3600
            if refresh_needed:
                try:
                    resp = requests.get("https://api.coingecko.com/api/v3/coins/list", timeout=6)
                    if resp.ok:
                        for c in resp.json():
                            sym = str(c.get('symbol', '')).upper()
                            cid = c.get('id')
                            if sym and cid:
                                _COINGECKO_SYMBOL_MAP[sym] = cid
                        _COINGECKO_SYMBOL_MAP_TS = now
                except Exception:
                    pass
            coin_id = _COINGECKO_SYMBOL_MAP.get(symbol_upper)
            if not coin_id:
                return None

        # Price data (current price + change) via simple API (cheap)
        url = f"https://api.coingecko.com/api/v3/simple/price?ids={coin_id}&vs_currencies=usd&include_24hr_change=true"
        pr = requests.get(url, timeout=6)
        if not pr.ok:
            return None
        price_payload = pr.json().get(coin_id, {})
        price = price_payload.get('usd')
        change_pct = price_payload.get('usd_24h_change')
        if price is None:
            return None
        previous_close = None
        try:
            if change_pct is not None:
                previous_close = float(price) / (1 + float(change_pct) / 100)
        except Exception:
            previous_close = None

        # Metadata (name, logo) cached to avoid repeated heavy calls
        detail_entry = None
        cache_ts = _COINGECKO_DETAIL_CACHE_TS.get(coin_id, 0)
        if (now - cache_ts) <= COINGECKO_DETAIL_CACHE_TTL:
            detail_entry = _COINGECKO_DETAIL_CACHE.get(coin_id)
        if not detail_entry:
            try:
                detail_resp = requests.get(
                    f"https://api.coingecko.com/api/v3/coins/{coin_id}",
                    params={"localization": "false", "tickers": "false", "market_data": "true", "community_data": "false", "developer_data": "false", "sparkline": "false"},
                    timeout=6,
                )
                if detail_resp.ok:
                    detail_entry = detail_resp.json()
                    _COINGECKO_DETAIL_CACHE[coin_id] = detail_entry
                    _COINGECKO_DETAIL_CACHE_TS[coin_id] = now
            except Exception:
                detail_entry = None

        logo_url = None
        name = None
        if detail_entry:
            name = detail_entry.get('name')
            image = detail_entry.get('image') or {}
            logo_url = image.get('large') or image.get('small') or image.get('thumb')

        return {
            'current_price': float(price),
            'hod': float(price),
            'previous_close': previous_close,
            'day_change_pct': float(change_pct) if change_pct is not None else None,
            'logo_url': logo_url,
            'company_name': name,
        }
    except Exception as exc:
        logging.debug("Failed to fetch crypto price for %s: %s", symbol, exc)
        return None


def clean_symbol(symbol: str) -> str:
    """Remove $ prefix, spaces, and other invalid characters from symbol."""
    if not symbol:
        return ""
    cleaned = str(symbol).strip().upper()
    # Remove $ prefix if present
    if cleaned.startswith('$'):
        cleaned = cleaned[1:].strip()
    # Remove any spaces
    cleaned = cleaned.replace(' ', '').replace('-', '').replace('_', '')
    # Remove .USD suffix if present
    if cleaned.endswith('.USD'):
        cleaned = cleaned[:-4]
    if cleaned.endswith('USD'):
        cleaned = cleaned[:-3]
    return cleaned


def resolve_chart_symbol(raw_symbol: Optional[str], price_ctx: Optional[Dict[str, Any]] = None, asset_type: Optional[str] = None) -> Optional[str]:
    """
    Prepare a yfinance-compatible symbol for chart generation.
    
    Prefers the symbol actually used for price fetching (stored in price_ctx['yf_symbol'])
    and otherwise normalizes the provided raw symbol by removing Discord-friendly prefixes.
    """
    candidate = raw_symbol or ""
    if price_ctx:
        asset_type = asset_type or price_ctx.get("asset_type")
        yf_symbol = price_ctx.get("yf_symbol")
        if yf_symbol:
            candidate = yf_symbol
    candidate = str(candidate or "").strip()
    if not candidate:
        return None
    
    candidate = candidate.lstrip('$').strip()
    candidate = candidate.replace(' ', '')
    candidate = candidate.replace('/', '-')
    candidate = candidate.replace('_', '-')
    candidate = candidate.replace('.', '-')
    candidate = re.sub(r'-+', '-', candidate)
    candidate = candidate.strip('-')
    if not candidate:
        return None
    
    resolved_asset_type = (asset_type or '').lower()
    candidate_upper = candidate.upper()
    
    if resolved_asset_type == 'crypto':
        parts = candidate_upper.split('-')
        base = parts[0] if parts else candidate_upper
        quote = parts[1] if len(parts) > 1 else 'USD'
        if quote not in {'USD', 'USDT', 'USDC'}:
            quote = 'USD'
        candidate_upper = f"{base}-{quote}"
    else:
        candidate_upper = candidate_upper
    
    return candidate_upper


async def _fetch_price_context_uncached(symbol_upper: str, asset_type: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fetch price context without consulting cache."""

    is_crypto = False
    if asset_type:
        is_crypto = str(asset_type).lower() == 'crypto'
    else:
        known = {'BTC','ETH','SOL','BNB','XRP','ADA','DOGE','MATIC','LTC','DOT','LINK','AVAX'}
        is_crypto = (symbol_upper in known) or (not re.match(r'^[A-Z]{1,5}$', symbol_upper))

    if is_crypto:
        cg = await fetch_crypto_price(symbol_upper)
        if cg:
            cg['asset_type'] = 'crypto'
            return cg
        yf_ctx = await fetch_price_context_yf_with_retry(f"{symbol_upper}-USD")
        if yf_ctx:
            yf_ctx['asset_type'] = 'crypto'
            return yf_ctx

    yf_ctx = await fetch_price_context_yf_with_retry(symbol_upper)
    if yf_ctx:
        yf_ctx['asset_type'] = 'equity'
    return yf_ctx


async def fetch_price_context_smart(symbol: str, asset_type: Optional[str] = None) -> Optional[Dict[str, float]]:
    """Retrieve price context with caching to avoid redundant provider calls."""

    symbol_upper = clean_symbol(symbol)
    if not symbol_upper:
        return None

    lookup_keys: List[str] = []
    if asset_type:
        lookup_keys.append(f"{symbol_upper}:{str(asset_type).lower()}")
    lookup_keys.append(f"{symbol_upper}:auto")

    now = time.time()
    stale_entry: Optional[Dict[str, Any]] = None

    for key in lookup_keys:
        cached = _PRICE_CACHE.get(key)
        if cached:
            age = now - _PRICE_CACHE_TS.get(key, 0)
            if age <= PRICE_CACHE_TTL_SECONDS:
                return _clone_price_payload(cached)
            stale_entry = stale_entry or cached

    # Check in-flight requests to deduplicate concurrent fetches
    for key in lookup_keys:
        inflight = _PRICE_CACHE_INFLIGHT.get(key)
        if inflight:
            try:
                result = await inflight
                if result:
                    return _clone_price_payload(result)
            except Exception as exc:
                logging.warning("Price fetch inflight error for %s: %s", key, exc)
            return _clone_price_payload(stale_entry) if stale_entry else None

    async def _do_fetch() -> Optional[Dict[str, Any]]:
        try:
            return await _fetch_price_context_uncached(symbol_upper, asset_type)
        except Exception as exc:
            logging.warning("Price fetch error for %s: %s", symbol_upper, exc)
            return None

    inflight_key = lookup_keys[-1]
    task = asyncio.create_task(_do_fetch())
    _PRICE_CACHE_INFLIGHT[inflight_key] = task

    try:
        result = await task
    finally:
        _PRICE_CACHE_INFLIGHT.pop(inflight_key, None)

    if result:
        store_keys = {inflight_key, f"{symbol_upper}:auto"}
        resolved_type = str(result.get('asset_type') or '').lower()
        if resolved_type:
            store_keys.add(f"{symbol_upper}:{resolved_type}")
        if asset_type:
            store_keys.add(f"{symbol_upper}:{str(asset_type).lower()}")
        for key in store_keys:
            _store_price_cache_entry(key, result)
        return _clone_price_payload(result)

    # If fetch failed, fall back to stale cache if available
    return _clone_price_payload(stale_entry) if stale_entry else None


class JackOfAllSignalsBot:
    def __init__(self) -> None:
        intents = Intents.default()
        intents.message_content = True
        self.bot = commands.Bot(command_prefix="!", intents=intents)
        self.allowed_mentions = AllowedMentions(everyone=True)

        self.tickers_provider = Get_Tickers()
        self.signal_channel_id: Optional[int] = Secret.signal_channel_id
        self.command_channel_id: Optional[int] = Secret.command_channel_id
        self.daily_task_started = False
        self.alert_task_started = False
        self.admin_notify_task_started = False
        self.chart_cleanup_task_started = False
        self.db = DatabaseManager()
        self.core_role_id = 1430718778785927239
        self.pro_role_id = 1402061825461190656
        self.elite_role_id = 1402067019091677244
        self.admin_role_id = 1401732626041274469

        # Per-user cooldown memory for buttons
        self._button_cooldowns: Dict[Tuple[int, str], float] = {}
        self._button_cooldown_seconds = 3.0

        def _is_on_cooldown(user_id: int, symbol: str) -> Optional[float]:
            key = (user_id, symbol.upper())
            until = self._button_cooldowns.get(key)
            if not until:
                return None
            remaining = until - time.time()
            return remaining if remaining > 0 else None

        def _set_cooldown(user_id: int, symbol: str):
            key = (user_id, symbol.upper())
            self._button_cooldowns[key] = time.time() + self._button_cooldown_seconds

        def _user_is_admin(interaction: Interaction) -> bool:
            try:
                member = getattr(interaction, 'user', None)
                permissions = getattr(member, 'guild_permissions', None)
                if permissions and (getattr(permissions, 'administrator', False) or getattr(permissions, 'manage_guild', False)):
                    return True
                admin_role_id = getattr(self, 'admin_role_id', None)
                if admin_role_id and hasattr(member, 'roles'):
                    for role in getattr(member, 'roles', []) or []:
                        if getattr(role, 'id', None) == admin_role_id:
                            return True
                return False
            except Exception:
                return False

        # Helper to extract symbol from embed title fallback
        def _extract_symbol_from_message(interaction: Interaction) -> Optional[str]:
            try:
                msg = interaction.message
                if not msg or not msg.embeds:
                    return None
                title = msg.embeds[0].title or ""
                # Titles like: "🚨 DAILY SIGNAL: AAPL"
                if ":" in title:
                    possible = title.split(":", 1)[-1].strip()
                    return possible.split()[0].upper()
                # Fallback: try first word in title
                return (title.split()[-1] if title else "").upper()
            except Exception:
                return None

        # Persistent view: custom_ids fixed, parse symbol from embed on click
        # Channel signals: Only user buttons (Add to Watchlist, Set Alert, DM Updates)
        class ChannelSignalActionsView(ui.View):
            def __init__(self):
                super().__init__(timeout=None)

            @ui.button(label="Add to Watchlist", style=ButtonStyle.primary, custom_id="sig_watchlist", emoji="⭐", row=0)
            async def add_watchlist(self_inner, interaction: Interaction, button: ui.Button):
                METRICS["button_clicks_total"] += 1
                METRICS["button_watchlist_clicks_total"] += 1
                raw_symbol = _extract_symbol_from_message(interaction) or ""
                if not raw_symbol:
                    await interaction.response.send_message("⚠️ Could not determine symbol for this message.", ephemeral=True)
                    return
                symbol = clean_symbol(raw_symbol)
                if not symbol:
                    await interaction.response.send_message(f"⚠️ Invalid symbol: {raw_symbol}", ephemeral=True)
                    return
                user_id = interaction.user.id
                remaining = _is_on_cooldown(user_id, symbol)
                if remaining:
                    await interaction.response.send_message(f"⏳ Slow down. Try again in {remaining:.1f}s.", ephemeral=True)
                    return
                _set_cooldown(user_id, symbol)
                await interaction.response.defer(ephemeral=True)
                try:
                    # Validate asset exists before adding
                    price_ctx = await fetch_price_context_smart(symbol)
                    if not price_ctx:
                        await interaction.followup.send(f"⚠️ Could not validate {symbol}. Please check the symbol and try again.", ephemeral=True)
                        return
                    self.db.add_to_watchlist(user_id, symbol)
                    await interaction.followup.send(f"✅ **{symbol}** added to your watchlist.", ephemeral=True)
                except Exception as e:
                    logging.error(f"Error adding {symbol} to watchlist: {e}", exc_info=True)
                    await interaction.followup.send(f"⚠️ Failed to add {symbol} to watchlist: {e}", ephemeral=True)

            @ui.button(label="Set Alert", style=ButtonStyle.secondary, custom_id="sig_setalert", emoji="⏰", row=0)
            async def set_alert(self_inner, interaction: Interaction, button: ui.Button):
                METRICS["button_clicks_total"] += 1
                METRICS["button_setalert_clicks_total"] += 1
                raw_symbol = _extract_symbol_from_message(interaction) or ""
                if not raw_symbol:
                    await interaction.response.send_message("⚠️ Could not determine symbol for this message.", ephemeral=True)
                    return
                symbol = clean_symbol(raw_symbol)
                if not symbol:
                    await interaction.response.send_message(f"⚠️ Invalid symbol: {raw_symbol}", ephemeral=True)
                    return
                user_id = interaction.user.id
                remaining = _is_on_cooldown(user_id, symbol)
                if remaining:
                    await interaction.response.send_message(f"⏳ Slow down. Try again in {remaining:.1f}s.", ephemeral=True)
                    return
                _set_cooldown(user_id, symbol)
                try:
                    await interaction.response.send_modal(SetAlertModal(self.db, symbol))
                except Exception as e:
                    await interaction.response.send_message(f"⚠️ Failed to open alert modal: {e}", ephemeral=True)

            @ui.button(label="DM Updates", style=ButtonStyle.success, custom_id="sig_dms", emoji="📬", row=0)
            async def toggle_dms(self_inner, interaction: Interaction, button: ui.Button):
                METRICS["button_clicks_total"] += 1
                METRICS["button_dm_toggle_clicks_total"] += 1
                symbol = _extract_symbol_from_message(interaction) or ""
                if not symbol:
                    await interaction.response.send_message("⚠️ Could not determine symbol for this message.", ephemeral=True)
                    return
                user_id = interaction.user.id
                remaining = _is_on_cooldown(user_id, symbol)
                if remaining:
                    await interaction.response.send_message(f"⏳ Slow down. Try again in {remaining:.1f}s.", ephemeral=True)
                    return
                _set_cooldown(user_id, symbol)
                try:
                    subscribed = self.db.toggle_subscription(user_id, symbol)
                    if subscribed:
                        await interaction.response.send_message(f"✅ Subscribed to {symbol} updates via DM.", ephemeral=True)
                    else:
                        await interaction.response.send_message(f"🚫 Unsubscribed from {symbol} updates.", ephemeral=True)
                except Exception as e:
                    await interaction.response.send_message(f"⚠️ Failed to toggle DM updates: {e}", ephemeral=True)

        # DM signals: Different buttons for managing DM subscriptions
        class DMSignalActionsView(ui.View):
            def __init__(self):
                super().__init__(timeout=None)

            @ui.button(label="Stop DM Updates", style=ButtonStyle.danger, custom_id="dm_stop", emoji="🚫", row=0)
            async def stop_dms(self_inner, interaction: Interaction, button: ui.Button):
                METRICS["button_clicks_total"] += 1
                METRICS["button_dm_toggle_clicks_total"] += 1
                symbol = _extract_symbol_from_message(interaction) or ""
                if not symbol:
                    await interaction.response.send_message("⚠️ Could not determine symbol for this message.", ephemeral=True)
                    return
                user_id = interaction.user.id
                remaining = _is_on_cooldown(user_id, symbol)
                if remaining:
                    await interaction.response.send_message(f"⏳ Slow down. Try again in {remaining:.1f}s.", ephemeral=True)
                    return
                _set_cooldown(user_id, symbol)
                await interaction.response.defer(ephemeral=True)
                try:
                    # Unsubscribe from DM updates
                    subscribed = self.db.toggle_subscription(user_id, symbol)
                    if not subscribed:
                        await interaction.followup.send(f"✅ Stopped DM updates for {symbol}. You won't receive future signals for this symbol.", ephemeral=True)
                    else:
                        await interaction.followup.send(f"⚠️ Already unsubscribed from {symbol} updates.", ephemeral=True)
                except Exception as e:
                    await interaction.followup.send(f"⚠️ Failed to stop DM updates: {e}", ephemeral=True)

            @ui.button(label="Delete DM", style=ButtonStyle.secondary, custom_id="dm_delete", emoji="🗑️", row=0)
            async def delete_dm(self_inner, interaction: Interaction, button: ui.Button):
                METRICS["button_clicks_total"] += 1
                user_id = interaction.user.id
                await interaction.response.defer(ephemeral=True)
                try:
                    # Delete the DM message
                    await interaction.message.delete()
                    await interaction.followup.send("✅ DM message deleted.", ephemeral=True)
                except Exception as delete_err:
                    logging.debug(f"Failed to delete DM message: {delete_err}")
                    await interaction.followup.send("⚠️ Failed to delete DM message.", ephemeral=True)

            @ui.button(label="Add to Watchlist", style=ButtonStyle.primary, custom_id="dm_watchlist", emoji="⭐", row=1)
            async def add_watchlist(self_inner, interaction: Interaction, button: ui.Button):
                METRICS["button_clicks_total"] += 1
                METRICS["button_watchlist_clicks_total"] += 1
                raw_symbol = _extract_symbol_from_message(interaction) or ""
                if not raw_symbol:
                    await interaction.response.send_message("⚠️ Could not determine symbol for this message.", ephemeral=True)
                    return
                symbol = clean_symbol(raw_symbol)
                if not symbol:
                    await interaction.response.send_message(f"⚠️ Invalid symbol: {raw_symbol}", ephemeral=True)
                    return
                user_id = interaction.user.id
                remaining = _is_on_cooldown(user_id, symbol)
                if remaining:
                    await interaction.response.send_message(f"⏳ Slow down. Try again in {remaining:.1f}s.", ephemeral=True)
                    return
                _set_cooldown(user_id, symbol)
                await interaction.response.defer(ephemeral=True)
                try:
                    # Validate asset exists before adding
                    price_ctx = await fetch_price_context_smart(symbol)
                    if not price_ctx:
                        await interaction.followup.send(f"⚠️ Could not validate {symbol}. Please check the symbol and try again.", ephemeral=True)
                        return
                    self.db.add_to_watchlist(user_id, symbol)
                    await interaction.followup.send(f"✅ **{symbol}** added to your watchlist.", ephemeral=True)
                except Exception as e:
                    logging.error(f"Error adding {symbol} to watchlist: {e}", exc_info=True)
                    await interaction.followup.send(f"⚠️ Failed to add {symbol} to watchlist: {e}", ephemeral=True)

            @ui.button(label="Set Alert", style=ButtonStyle.secondary, custom_id="dm_setalert", emoji="⏰", row=1)
            async def set_alert(self_inner, interaction: Interaction, button: ui.Button):
                METRICS["button_clicks_total"] += 1
                METRICS["button_setalert_clicks_total"] += 1
                raw_symbol = _extract_symbol_from_message(interaction) or ""
                if not raw_symbol:
                    await interaction.response.send_message("⚠️ Could not determine symbol for this message.", ephemeral=True)
                    return
                symbol = clean_symbol(raw_symbol)
                if not symbol:
                    await interaction.response.send_message(f"⚠️ Invalid symbol: {raw_symbol}", ephemeral=True)
                    return
                user_id = interaction.user.id
                remaining = _is_on_cooldown(user_id, symbol)
                if remaining:
                    await interaction.response.send_message(f"⏳ Slow down. Try again in {remaining:.1f}s.", ephemeral=True)
                    return
                _set_cooldown(user_id, symbol)
                try:
                    await interaction.response.send_modal(SetAlertModal(self.db, symbol))
                except Exception as e:
                    await interaction.response.send_message(f"⚠️ Failed to open alert modal: {e}", ephemeral=True)

        class SetAlertModal(ui.Modal, title="Set Price Alert"):
            def __init__(self, db: DatabaseManager, symbol: str):
                super().__init__()
                self.db = db
                symbol_cleaned = clean_symbol(symbol)
                if not symbol_cleaned:
                    raise ValueError(f"Invalid symbol: {symbol}")
                self.symbol = symbol_cleaned
                self.price_input = ui.TextInput(label="Target Price", placeholder="e.g. 150.00", required=True)
                self.add_item(self.price_input)

            async def on_submit(self, interaction: Interaction):
                user_id = interaction.user.id
                await interaction.response.defer(ephemeral=True)
                try:
                    price = float(str(self.price_input.value).strip())
                    if price <= 0:
                        await interaction.followup.send("⚠️ Enter a valid positive price.", ephemeral=True)
                        return
                    
                    # Validate asset exists before creating alert
                    price_ctx = await fetch_price_context_smart(self.symbol)
                    if not price_ctx:
                        await interaction.followup.send(f"⚠️ Could not validate {self.symbol}. Please check the symbol and try again.", ephemeral=True)
                        return
                    
                    self.db.add_alert(user_id, self.symbol, price, "PRICE")
                    await interaction.followup.send(f"✅ Alert set for {self.symbol} at ${price:.2f}", ephemeral=True)
                except ValueError:
                    await interaction.followup.send("⚠️ Invalid price format.", ephemeral=True)
                except Exception as e:
                    logging.error(f"Error creating alert for {self.symbol}: {e}", exc_info=True)
                    await interaction.followup.send(f"⚠️ Failed to set alert: {e}", ephemeral=True)

        # Alert Actions for Alert DMs (stop, enable, delete, update)
        class UpdateAlertModal(ui.Modal, title="Update Alert Threshold"):
            def __init__(self, db: DatabaseManager, alert_id: int):
                super().__init__()
                self.db = db
                self.alert_id = alert_id
                self.new_price = ui.TextInput(label="New Target Price", placeholder="e.g. 150.00", required=True)
                self.add_item(self.new_price)

            async def on_submit(self, interaction: Interaction):
                user_id = interaction.user.id
                await interaction.response.defer(ephemeral=True)
                try:
                    price = float(str(self.new_price.value).strip())
                    if price <= 0:
                        await interaction.followup.send("⚠️ Enter a valid positive price.", ephemeral=True)
                        return
                    self.db.update_alert_threshold(self.alert_id, user_id, price)
                    await interaction.followup.send("✅ Alert updated and re-enabled.", ephemeral=True)
                except ValueError:
                    await interaction.followup.send("⚠️ Invalid price format.", ephemeral=True)
                except Exception as e:
                    logging.error(f"Error updating alert {self.alert_id}: {e}", exc_info=True)
                    await interaction.followup.send(f"⚠️ Failed to update alert: {e}", ephemeral=True)

        class AlertActionsView(ui.View):
            def __init__(self):
                super().__init__(timeout=None)

            def _extract_alert_id(self_inner, interaction: Interaction) -> Optional[int]:
                try:
                    msg = interaction.message
                    if not msg or not msg.embeds:
                        return None
                    footer_text = msg.embeds[0].footer.text if msg.embeds[0].footer else ""
                    m = re.search(r"Alert ID\s*#(\d+)", footer_text or "")
                    return int(m.group(1)) if m else None
                except Exception:
                    return None

            @ui.button(label="Stop", style=ButtonStyle.secondary, custom_id="alert_stop", emoji="⏹️", row=0)
            async def stop_alert(self_inner, interaction: Interaction, button: ui.Button):
                alert_id = self_inner._extract_alert_id(interaction)
                if not alert_id:
                    await interaction.response.send_message("⚠️ Could not determine alert id.", ephemeral=True)
                    return
                try:
                    self.db.set_alert_active(alert_id, interaction.user.id, False)
                    await interaction.response.send_message("✅ Alert stopped.", ephemeral=True)
                except Exception as e:
                    await interaction.response.send_message(f"⚠️ Failed to stop alert: {e}", ephemeral=True)

            @ui.button(label="Enable", style=ButtonStyle.success, custom_id="alert_enable", emoji="▶️", row=0)
            async def enable_alert(self_inner, interaction: Interaction, button: ui.Button):
                alert_id = self_inner._extract_alert_id(interaction)
                if not alert_id:
                    await interaction.response.send_message("⚠️ Could not determine alert id.", ephemeral=True)
                    return
                try:
                    self.db.set_alert_active(alert_id, interaction.user.id, True)
                    await interaction.response.send_message("✅ Alert enabled.", ephemeral=True)
                except Exception as e:
                    await interaction.response.send_message(f"⚠️ Failed to enable alert: {e}", ephemeral=True)

            @ui.button(label="Delete", style=ButtonStyle.danger, custom_id="alert_delete", emoji="🗑️", row=0)
            async def delete_alert(self_inner, interaction: Interaction, button: ui.Button):
                alert_id = self_inner._extract_alert_id(interaction)
                if not alert_id:
                    await interaction.response.send_message("⚠️ Could not determine alert id.", ephemeral=True)
                    return
                try:
                    self.db.delete_alert(alert_id, interaction.user.id)
                    try:
                        await interaction.message.delete()
                    except Exception:
                        pass
                    await interaction.response.send_message("🗑️ Alert deleted.", ephemeral=True)
                except Exception as e:
                    await interaction.response.send_message(f"⚠️ Failed to delete alert: {e}", ephemeral=True)

            @ui.button(label="Update", style=ButtonStyle.primary, custom_id="alert_update", emoji="✏️", row=0)
            async def update_alert(self_inner, interaction: Interaction, button: ui.Button):
                alert_id = self_inner._extract_alert_id(interaction)
                if not alert_id:
                    await interaction.response.send_message("⚠️ Could not determine alert id.", ephemeral=True)
                    return
                try:
                    await interaction.response.send_modal(UpdateAlertModal(self.db, alert_id))
                except Exception as e:
                    await interaction.response.send_message(f"⚠️ Failed to open update modal: {e}", ephemeral=True)

        # Assign view classes to self so they're accessible from other methods
        self.ChannelSignalActionsView = ChannelSignalActionsView
        self.DMSignalActionsView = DMSignalActionsView
        self.SetAlertModal = SetAlertModal
        self.AlertActionsView = AlertActionsView
        self.UpdateAlertModal = UpdateAlertModal

        self._register_handlers()
        self._register_slash_commands()

    # ------------------------------------------------------------------
    # Helper utilities
    # ------------------------------------------------------------------

    @staticmethod
    def _normalize_asset_type(value: Optional[str]) -> str:
        return str(value).lower() if value else ""

    @staticmethod
    def _get_prefetched_price(
        price_cache: Dict[Tuple[str, str], Dict[str, Any]],
        symbol: str,
        asset_type: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        symbol_upper = symbol.upper()
        asset_norm = JackOfAllSignalsBot._normalize_asset_type(asset_type)
        return (
            price_cache.get((symbol_upper, asset_norm))
            or price_cache.get((symbol_upper, ""))
        )

    @staticmethod
    def _store_prefetched_price(
        price_cache: Dict[Tuple[str, str], Dict[str, Any]],
        symbol: str,
        asset_type: Optional[str],
        payload: Dict[str, Any],
    ) -> None:
        if not payload:
            return
        symbol_upper = symbol.upper()
        asset_norm = JackOfAllSignalsBot._normalize_asset_type(asset_type)
        price_cache[(symbol_upper, asset_norm)] = payload
        if asset_norm:
            price_cache.setdefault((symbol_upper, ""), payload)

    async def _prefetch_price_contexts(
        self,
        entries: List[Tuple[str, Optional[str]]],
        *,
        concurrency: int = 4,
    ) -> Dict[Tuple[str, str], Dict[str, Any]]:
        results: Dict[Tuple[str, str], Dict[str, Any]] = {}
        seen: Set[Tuple[str, str]] = set()
        queue: List[Tuple[str, Optional[str]]] = []

        for symbol, asset_type in entries:
            if not symbol:
                continue
            key = (symbol.upper(), self._normalize_asset_type(asset_type))
            if key in seen:
                continue
            seen.add(key)
            queue.append((symbol, asset_type))

        if not queue:
            return results

        semaphore = asyncio.Semaphore(max(1, concurrency))

        async def fetch_entry(symbol: str, asset_type: Optional[str]) -> None:
            key = (symbol.upper(), self._normalize_asset_type(asset_type))
            async with semaphore:
                ctx = await fetch_price_context_smart(symbol, asset_type)
            if ctx:
                results[key] = ctx
                if key[1]:
                    results.setdefault((key[0], ""), ctx)

        await asyncio.gather(*(fetch_entry(symbol, asset_type) for symbol, asset_type in queue))
        return results

    def _register_handlers(self) -> None:
        # Channel restrictions - signals in signal channel, commands in command channel
        SIGNAL_CHANNEL_ID = self.signal_channel_id
        COMMAND_CHANNEL_ID = self.command_channel_id
        
        async def check_command_channel_ctx(ctx: commands.Context) -> bool:
            """Check if prefix command is being used in the command channel."""
            if ctx.channel.id != COMMAND_CHANNEL_ID:
                await ctx.send(f"❌ **Commands are only allowed in the bot commands channel!**\nPlease use commands in <#{COMMAND_CHANNEL_ID}>")
                return False
            return True

        # Removed here; re-declared in _register_slash_commands

        # Removed here; re-declared in _register_slash_commands
        
        @self.bot.event
        async def on_ready():
            logging.info("%s is online.", BOT_NAME)
            await self._maybe_send_market_open_message()
            if not self.daily_task_started:
                self.daily_signal_task.start()
                self.daily_task_started = True
            
            if not self.alert_task_started:
                self.alert_check_task.start()
                self.alert_task_started = True
            
            if not self.admin_notify_task_started:
                self.admin_signal_notify_task.start()
                self.admin_notify_task_started = True
            
            if not self.chart_cleanup_task_started:
                self.chart_cleanup_task.start()
                self.chart_cleanup_task_started = True
                # Run cleanup once immediately on startup
                try:
                    await self._cleanup_old_charts()
                except Exception as cleanup_err:
                    logging.warning(f"Initial chart cleanup failed: {cleanup_err}")
            
            # Register persistent views so buttons on old messages work after restart
            try:
                self.bot.add_view(self.ChannelSignalActionsView())
                self.bot.add_view(self.DMSignalActionsView())
                self.bot.add_view(self.AlertActionsView())
                logging.info("Registered persistent ChannelSignalActionsView and DMSignalActionsView")
            except Exception as e:
                logging.warning(f"Failed to register persistent views: {e}")

            # Sync slash commands
            try:
                synced = await self.bot.tree.sync()
                logging.info(f"Synced {len(synced)} slash commands")
            except Exception as e:
                logging.error(f"Failed to sync slash commands: {e}")


    def _register_slash_commands(self) -> None:
        """Register all slash commands."""
        # Channel restrictions - commands only in command channel
        COMMAND_CHANNEL_ID = self.command_channel_id
        
        async def check_command_channel(interaction) -> bool:
            """Check if command is being used in the command channel or DM."""
            # Allow commands in DMs (when guild is None)
            if interaction.guild is None:
                return True
            # Otherwise require command channel
            if interaction.channel_id != COMMAND_CHANNEL_ID:
                await interaction.response.send_message(f"❌ **Commands are only allowed in the bot commands channel!**\nPlease use commands in <#{COMMAND_CHANNEL_ID}>", ephemeral=True)
                return False
            return True

        def _has_required_role(interaction, required: str) -> bool:
            # Resolve to a Guild Member to access roles reliably
            try:
                guild = getattr(interaction, 'guild', None)
                member = None
                if guild is not None:
                    member = guild.get_member(interaction.user.id)
                # Fallback: interaction.user may already be a Member in guild context
                if member is None and hasattr(interaction, 'user') and hasattr(interaction.user, 'roles'):
                    member = interaction.user
                if member is None:
                    return False
                role_ids = {getattr(role, 'id', None) for role in getattr(member, 'roles', [])}
                role_ids.discard(None)
            except Exception:
                role_ids = set()
            admin_role_id = getattr(self, 'admin_role_id', None)
            if admin_role_id and admin_role_id in role_ids:
                return True
            if required == 'core':
                return any(r for r in (
                    getattr(self, 'core_role_id', None),
                    getattr(self, 'pro_role_id', None),
                    getattr(self, 'elite_role_id', None),
                ) if r and r in role_ids)
            if required == 'pro':
                return any(r for r in (
                    getattr(self, 'pro_role_id', None),
                    getattr(self, 'elite_role_id', None),
                ) if r and r in role_ids)
            if required == 'elite':
                elite_role_id = getattr(self, 'elite_role_id', None)
                return elite_role_id in role_ids if elite_role_id else False
            return False

        async def check_required_role(interaction, required: str, label: str) -> bool:
            if not _has_required_role(interaction, required):
                tier_label = 'Core' if required == 'core' else 'Pro' if required == 'pro' else 'Elite'
                await interaction.response.send_message(f"❌ {label} requires {tier_label}+ subscription", ephemeral=True)
                return False
            return True

        @self.bot.tree.command(name="subs", description="Show your DM subscriptions (symbols)")
        async def subs_slash(interaction):
            if not await check_command_channel(interaction):
                return
            user_id = interaction.user.id
            try:
                subs = self.db.get_user_subscriptions(user_id)
                embed = Embed(title="📬 Your Symbol Subscriptions", color=Color.gold())
                if not subs:
                    embed.description = "You have no active subscriptions. Use the DM Updates button under a signal to subscribe."
                else:
                    embed.description = "\n".join([f"• {s}" for s in subs])
                await interaction.response.send_message(embed=embed, ephemeral=True)
            except Exception as e:
                await interaction.response.send_message(f"⚠️ Failed to fetch subscriptions: {e}", ephemeral=True)

        # Removed test-buttons command after verification

        async def asset_autocomplete(interaction: Interaction, current: str) -> List[app_commands.Choice[str]]:
            """Autocomplete for asset symbols (crypto and stocks)."""
            try:
                current = clean_symbol(current)
                if len(current) < 1:
                    # Show a balanced, broader default set
                    seed = (TOP_CRYPTO_SYMBOLS[:8] + TOP_STOCK_SYMBOLS[:8])
                    return [app_commands.Choice(name=sym, value=sym) for sym in seed]
                
                results = []
                if len(current) >= 2:
                    results.append(app_commands.Choice(name=current, value=current))
                
                # Prefix match from curated lists (no network calls)
                pool = TOP_CRYPTO_SYMBOLS + TOP_STOCK_SYMBOLS
                for sym in pool:
                    if sym.startswith(current) and sym != current:
                        results.append(app_commands.Choice(name=sym, value=sym))
                
                return results[:25]  # Discord limit is 25
            except Exception as e:
                # If autocomplete fails, return empty list to avoid 404 errors
                logging.debug(f"Autocomplete error: {e}")
                return []
        
        @self.bot.tree.command(name="analyze", description="Get detailed technical analysis for a crypto or stock symbol")
        @app_commands.describe(symbol="Symbol to analyze (e.g., BTC, ETH, AAPL, TSLA)")
        @app_commands.autocomplete(symbol=asset_autocomplete)
        async def analyze_slash(interaction, symbol: str):
            """Detailed technical analysis for a symbol."""
            if not await check_command_channel(interaction):
                return
            if not await check_required_role(interaction, 'core', 'Technical analysis'):
                return
            
            if not symbol:
                embed = Embed(title="❌ Missing Symbol", color=Color.red())
                embed.description = "Please provide a symbol.\n**Usage:** `/analyze <symbol>`\n**Example:** `/analyze BTC` or `/analyze AAPL`"
                await interaction.response.send_message(embed=embed, ephemeral=True)
                return
            
            symbol_cleaned = clean_symbol(symbol)
            if not symbol_cleaned:
                embed = Embed(title="❌ Invalid Symbol", color=Color.red())
                embed.description = f"Invalid symbol: {symbol}"
                await interaction.response.send_message(embed=embed, ephemeral=True)
                return
            
            # Defer response since analysis takes time
            await interaction.response.defer()
            
            try:
                # Determine if crypto or stock
                known_crypto = {'BTC','ETH','SOL','BNB','XRP','ADA','DOGE','MATIC','LTC','DOT','LINK','AVAX'}
                is_crypto = symbol_cleaned in known_crypto or (not re.match(r'^[A-Z]{1,5}$', symbol_cleaned))
                
                # Get price data first (smart - handles both crypto and stocks)
                price_ctx = await fetch_price_context_smart(symbol_cleaned)
                if not price_ctx:
                    embed = Embed(title="❌ Price Data Failed", color=Color.red())
                    embed.description = f"Could not fetch price data for {symbol_cleaned}. Please check the symbol and try again."
                    await interaction.followup.send(embed=embed, ephemeral=True)
                    return
                
                current_price = price_ctx.get("current_price", 0)
                reco_map = None
                score = None
                
                # Only get TradingView analysis for stocks (not crypto)
                if not is_crypto:
                    reco_map = await analyze_symbol_tradingview_with_retry(symbol_cleaned, price_data=price_ctx)
                    if reco_map:
                        score = score_symbol(reco_map)
                    else:
                        score = 0
                else:
                    score = 0
                
                # Create embed with custom color
                custom_color = Color.from_rgb(210, 149, 68)  # #d29544
                asset_type_label = "Crypto" if is_crypto else "Stock"
                company_name = price_ctx.get("company_name") or symbol_cleaned
                embed = Embed(title=f"📊 {asset_type_label} Analysis: {company_name}", color=custom_color)
                
                # Set thumbnail logo if available
                logo_url = price_ctx.get("logo_url")
                if logo_url:
                    embed.set_thumbnail(url=str(logo_url))
                
                # Price information section
                decimals = 2 if current_price >= 10 else 4
                price_info = f"**Current**: ${current_price:,.{decimals}f}\n"
                
                # Previous close
                if price_ctx.get("previous_close"):
                    prev_close = price_ctx["previous_close"]
                    price_info += f"**Previous Close**: ${prev_close:,.{decimals}f}\n"
                
                # 24h/Day change
                if price_ctx.get("day_change_pct") is not None:
                    change = price_ctx["day_change_pct"]
                    emoji = "📈" if change >= 0 else "📉"
                    price_info += f"**Change**: {emoji} {change:+.2f}%\n"
                
                # Today's High
                if price_ctx.get("hod"):
                    price_info += f"**Today's High**: ${price_ctx['hod']:,.{decimals}f}"
                
                embed.add_field(
                    name="💰 Price Overview",
                    value=price_info,
                    inline=False
                )
                
                # Pivot Points & Key Levels
                if price_ctx.get("PP") and not math.isnan(price_ctx["PP"]):
                    pivot_info = f"**Pivot Point**: ${price_ctx['PP']:.2f}\n"
                    if price_ctx.get("R3") and not math.isnan(price_ctx["R3"]):
                        pivot_info += f"**R3**: ${price_ctx['R3']:.2f}\n"
                    if price_ctx.get("R2") and not math.isnan(price_ctx["R2"]):
                        pivot_info += f"**R2**: ${price_ctx['R2']:.2f}\n"
                    if price_ctx.get("R1") and not math.isnan(price_ctx["R1"]):
                        pivot_info += f"**R1**: ${price_ctx['R1']:.2f}\n"
                    pivot_info += "━━━━━━━━━━\n"
                    if price_ctx.get("S1") and not math.isnan(price_ctx["S1"]):
                        pivot_info += f"**S1**: ${price_ctx['S1']:.2f}\n"
                    if price_ctx.get("S2") and not math.isnan(price_ctx["S2"]):
                        pivot_info += f"**S2**: ${price_ctx['S2']:.2f}\n"
                    if price_ctx.get("S3") and not math.isnan(price_ctx["S3"]):
                        pivot_info += f"**S3**: ${price_ctx['S3']:.2f}"
                    
                    embed.add_field(
                        name="📊 Pivot Points",
                        value=pivot_info,
                    inline=True
                )
                
                # Technical Analysis (for stocks)
                if reco_map:
                    reco_text = ""
                    timeframe_order = ["5m", "15m", "1h", "1d"]
                    for tf in timeframe_order:
                        if tf in reco_map:
                            reco = reco_map[tf]
                            emoji = "🟢" if "BUY" in reco.upper() else "🔴" if "SELL" in reco.upper() else "🟡"
                            reco_text += f"{emoji} **{tf}**: {reco}\n"
                    
                    # Add any other timeframes not in the order
                    for tf, reco in reco_map.items():
                        if tf not in timeframe_order:
                            emoji = "🟢" if "BUY" in reco.upper() else "🔴" if "SELL" in reco.upper() else "🟡"
                            reco_text += f"{emoji} **{tf}**: {reco}\n"
                    
                    embed.add_field(
                        name="📈 Technical Recommendations",
                        value=reco_text.strip(),
                        inline=True
                    )
                
                # Signal Score
                if score is not None:
                    score_emoji = "🟢" if score > 0 else "🔴" if score < 0 else "🟡"
                    score_text = f"{score_emoji} **Score**: {score}\n"
                    if score > 5:
                        score_text += "📊 **Strength**: Strong Buy"
                    elif score > 0:
                        score_text += "📊 **Strength**: Moderate Buy"
                    elif score < -5:
                        score_text += "📊 **Strength**: Strong Sell"
                    elif score < 0:
                        score_text += "📊 **Strength**: Moderate Sell"
                    else:
                        score_text += "📊 **Strength**: Neutral"
                    
                    embed.add_field(
                        name="🎯 Signal Strength",
                        value=score_text,
                        inline=False
                    )
                
                # Market Context
                context_info = f"**Symbol**: {symbol_cleaned}\n"
                context_info += f"**Type**: {asset_type_label}\n"
                
                # Calculate distance from high
                if price_ctx.get("hod") and current_price:
                    distance_from_high = ((current_price - price_ctx['hod']) / price_ctx['hod']) * 100
                    if abs(distance_from_high) > 0.01:
                        context_info += f"**From High**: {distance_from_high:+.2f}%\n"
                
                # Price position relative to pivot
                if price_ctx.get("PP") and not math.isnan(price_ctx["PP"]):
                    pp = price_ctx["PP"]
                    if current_price > pp:
                        context_info += f"**Position**: Above Pivot (Bullish)\n"
                    elif current_price < pp:
                        context_info += f"**Position**: Below Pivot (Bearish)\n"
                    else:
                        context_info += f"**Position**: At Pivot\n"
                
                    embed.add_field(
                    name="📋 Market Context",
                    value=context_info,
                    inline=False
                    )
                
                # TradingView link
                chart_url = f"https://www.tradingview.com/chart/?symbol={'BINANCE:' + symbol_cleaned + 'USD' if is_crypto else symbol_cleaned}"
                embed.add_field(
                    name="🔗 Resources",
                    value=f"[View on TradingView]({chart_url})",
                    inline=False
                )
                
                # Footer
                embed.set_footer(text=f"Analysis generated at {dt.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC")
                
                # Add to database if we have analysis
                if reco_map:
                    try:
                        details_manual = {
                            "source": "manual_analysis",
                            "timeframes": reco_map,
                            "current_price": current_price,
                            "logo_url": price_ctx.get("logo_url") if isinstance(price_ctx, dict) else None,
                            "company_name": price_ctx.get("company_name") if isinstance(price_ctx, dict) else None,
                        }
                        self.db.add_signal(
                            symbol_cleaned,
                            "MANUAL_ANALYSIS",
                            current_price,
                            json.dumps(reco_map),
                            display_symbol=symbol_cleaned,
                            signal_strength=None,
                            asset_type=str(price_ctx.get("asset_type", "equity")) if isinstance(price_ctx, dict) else "equity",
                            details=details_manual,
                        )
                    except Exception as db_err:
                        logging.debug(f"Failed to persist manual analysis signal for {symbol_cleaned}: {db_err}")
                
                await interaction.followup.send(embed=embed)
                
            except Exception as e:
                logging.error(f"Error analyzing {symbol_cleaned}: {e}", exc_info=True)
                embed = Embed(title="❌ Error", color=Color.red())
                embed.description = f"An error occurred while analyzing {symbol_cleaned}: {str(e)}"
                await interaction.followup.send(embed=embed, ephemeral=True)

        @self.bot.tree.command(name="price", description="Get current price for a crypto or stock symbol")
        @app_commands.describe(symbol="Symbol to get price for (e.g., BTC, ETH, AAPL, TSLA)")
        @app_commands.autocomplete(symbol=asset_autocomplete)
        async def price_slash(interaction, symbol: str):
            """Get current price for a symbol."""
            if not await check_command_channel(interaction):
                return
            if not await check_required_role(interaction, 'core', 'Price lookup'):
                return
            
            if not symbol:
                embed = Embed(title="❌ Missing Symbol", color=Color.red())
                embed.description = "Please provide a symbol.\n**Usage:** `/price <symbol>`\n**Example:** `/price BTC` or `/price AAPL`"
                await interaction.response.send_message(embed=embed, ephemeral=True)
                return
            
            symbol_cleaned = clean_symbol(symbol)
            if not symbol_cleaned:
                embed = Embed(title="❌ Invalid Symbol", color=Color.red())
                embed.description = f"Invalid symbol: {symbol}"
                await interaction.response.send_message(embed=embed, ephemeral=True)
                return
            
            await interaction.response.defer()
            
            try:
                price_ctx = await fetch_price_context_smart(symbol_cleaned)
                
                if not price_ctx:
                    embed = Embed(title="❌ Price Data Failed", color=Color.red())
                    embed.description = f"Could not fetch price data for {symbol_cleaned}. Please check the symbol and try again."
                    await interaction.followup.send(embed=embed, ephemeral=True)
                    return
                
                current_price = price_ctx.get("current_price", 0)
                hod = price_ctx.get("hod", 0)
                decimals = 2 if current_price >= 10 else 4
                
                custom_color = Color.from_rgb(210, 149, 68)  # #d29544
                embed = Embed(title=f"💰 {symbol_cleaned} Price", color=custom_color)
                embed.add_field(name="Current Price", value=f"${current_price:,.{decimals}f}", inline=True)
                embed.add_field(name="Today's High", value=f"${hod:,.{decimals}f}", inline=True)
                
                # Add 24h change if available
                if price_ctx.get("day_change_pct") is not None:
                    change = price_ctx["day_change_pct"]
                    emoji = "📈" if change >= 0 else "📉"
                    embed.add_field(name="24h Change", value=f"{emoji} {change:+.2f}%", inline=True)
                
                await interaction.followup.send(embed=embed)
                
            except Exception as e:
                logging.error(f"Error getting price for {symbol_cleaned}: {e}", exc_info=True)
                embed = Embed(title="❌ Error", color=Color.red())
                embed.description = f"Failed to get price for {symbol_cleaned}: {str(e)}"
                await interaction.followup.send(embed=embed, ephemeral=True)

        @self.bot.tree.command(name="portfolio", description="View your portfolio and profile")
        async def portfolio_view(interaction):
            """View your portfolio and profile."""
            if not await check_command_channel(interaction):
                return
            if not await check_required_role(interaction, 'core', 'Portfolio'):
                return
            
            await interaction.response.defer()
            
            try:
                user_id = interaction.user.id
                username = interaction.user.display_name
                custom_color = Color.from_rgb(210, 149, 68)  # #d29544
                
                # Get portfolio positions
                positions = self.db.get_user_portfolio(user_id)
                
                # Get user profile
                profile = self.db.get_user_profile(user_id)
                
                # Create main embed
                embed = Embed(title="📈 Your Portfolio & Profile", color=custom_color)
                
                # Add portfolio section
                if not positions:
                    embed.add_field(
                        name="💼 Portfolio",
                        value="Your portfolio is empty. Use `/portfolio-add` to add positions.",
                        inline=False
                    )
                else:
                    total_value = 0
                    portfolio_text = ""
                    
                    for symbol, shares, avg_price, entry_date in positions:
                        # Get current price
                        price_ctx = await fetch_price_context_yf_with_retry(symbol)
                        current_price = price_ctx.get("current_price", avg_price) if price_ctx else avg_price
                        
                        position_value = shares * current_price
                        total_value += position_value
                        pnl = (current_price - avg_price) * shares
                        pnl_pct = ((current_price / avg_price - 1) * 100) if avg_price > 0 else 0
                        
                        pnl_emoji = "🟢" if pnl > 0 else "🔴" if pnl < 0 else "🟡"
                        
                        portfolio_text += f"**{symbol}** ({shares} shares)\n"
                        portfolio_text += f"Entry: ${avg_price:.2f} | Current: ${current_price:.2f}\n"
                        portfolio_text += f"P&L: {pnl_emoji} ${pnl:.2f} ({pnl_pct:.1f}%)\n"
                        portfolio_text += f"Value: ${position_value:.2f}\n\n"
                    
                    portfolio_text += f"**Total Portfolio Value: ${total_value:.2f}**"
                    
                    embed.add_field(
                        name="💼 Portfolio",
                        value=portfolio_text,
                        inline=False
                    )
                
                # Add profile section
                if not profile:
                    embed.add_field(
                        name="👤 Profile",
                        value="No profile found. Use `/portfolio-setup` to create one!",
                        inline=False
                    )
                else:
                    # Experience level with emoji
                    exp_emoji = {"beginner": "🟢", "intermediate": "🟡", "advanced": "🔴"}
                    exp_text = profile.get('trading_experience', 'beginner').title()
                    exp_emoji_display = exp_emoji.get(profile.get('trading_experience', 'beginner'), '🟢')
                    
                    # Risk tolerance with emoji
                    risk_emoji = {"conservative": "🟢", "moderate": "🟡", "aggressive": "🔴"}
                    risk_text = profile.get('risk_tolerance', 'moderate').title()
                    risk_emoji_display = risk_emoji.get(profile.get('risk_tolerance', 'moderate'), '🟡')
                    
                    profile_text = f"**Experience:** {exp_emoji_display} {exp_text}\n"
                    profile_text += f"**Timeframe:** 📈 {profile.get('preferred_timeframe', '1h').upper()}\n"
                    profile_text += f"**Risk:** {risk_emoji_display} {risk_text}\n"
                    
                    if profile.get('learning_goals'):
                        profile_text += f"**Goals:** {profile.get('learning_goals')}\n"
                    
                    if profile.get('favorite_symbols'):
                        profile_text += f"**Favorites:** {profile.get('favorite_symbols')}\n"
                    
                    profile_text += f"**Member Since:** {profile.get('join_date', 'Unknown')[:10]}\n"
                    profile_text += f"**Signals Viewed:** {profile.get('total_signals_viewed', 0)}"
                    
                    embed.add_field(
                        name="👤 Profile",
                        value=profile_text,
                        inline=False
                    )
                
                await interaction.followup.send(embed=embed)
                    
            except Exception as e:
                embed = Embed(title="❌ Error", color=Color.red())
                embed.description = f"Failed to view portfolio: {str(e)}"
                await interaction.followup.send(embed=embed, ephemeral=True)

        @self.bot.tree.command(name="portfolio-add", description="Add a position to your portfolio")
        @app_commands.describe(
            symbol="Symbol to add (crypto or stock)",
            shares="Number of shares to add",
            price="Price per share"
        )
        @app_commands.autocomplete(symbol=asset_autocomplete)
        async def portfolio_add(interaction, symbol: str, shares: float, price: float):
            """Add a position to your portfolio."""
            if not await check_command_channel(interaction):
                return
            if not await check_required_role(interaction, 'core', 'Portfolio'):
                return
            
            symbol_cleaned = clean_symbol(symbol)
            if not symbol_cleaned:
                embed = Embed(title="❌ Invalid Symbol", color=Color.red())
                embed.description = f"Invalid symbol: {symbol}"
                await interaction.response.send_message(embed=embed, ephemeral=True)
                return
            
            if shares <= 0 or price <= 0:
                embed = Embed(title="❌ Invalid Values", color=Color.red())
                embed.description = "Shares and price must be positive numbers."
                await interaction.response.send_message(embed=embed, ephemeral=True)
                return
            
            await interaction.response.defer()
            
            try:
                user_id = interaction.user.id
                custom_color = Color.from_rgb(210, 149, 68)  # #d29544
                
                # Validate asset exists before adding
                price_ctx = await fetch_price_context_smart(symbol_cleaned)
                if not price_ctx:
                    embed = Embed(title="❌ Validation Failed", color=Color.red())
                    embed.description = f"Could not validate {symbol_cleaned}. Please check the symbol and try again."
                    await interaction.followup.send(embed=embed, ephemeral=True)
                    return
                
                self.db.add_portfolio_position(user_id, symbol_cleaned, shares, price)
                embed = Embed(title="✅ Position Added", color=custom_color)
                embed.description = f"Added {shares} shares of {symbol_cleaned} at ${price:.2f}"
                await interaction.followup.send(embed=embed)
                
            except Exception as e:
                logging.error(f"Error adding position for {symbol_cleaned}: {e}", exc_info=True)
                embed = Embed(title="❌ Error", color=Color.red())
                embed.description = f"Failed to add position: {str(e)}"
                await interaction.followup.send(embed=embed, ephemeral=True)

        @self.bot.tree.command(name="portfolio-remove", description="Remove a position from your portfolio")
        @app_commands.describe(symbol="Stock symbol to remove")
        async def portfolio_remove(interaction, symbol: str):
            """Remove a position from your portfolio."""
            if not await check_command_channel(interaction):
                return
            if not await check_required_role(interaction, 'core', 'Portfolio'):
                return
            
            await interaction.response.defer()
            
            try:
                user_id = interaction.user.id
                custom_color = Color.from_rgb(210, 149, 68)  # #d29544
                
                # Get current price for P&L calculation
                price_ctx = await fetch_price_context_yf_with_retry(symbol)
                exit_price = price_ctx.get("current_price", 0) if price_ctx else 0
                
                if exit_price > 0:
                    pnl = self.db.close_portfolio_position(user_id, symbol, exit_price)
                    if pnl is not None:
                        pnl_emoji = "🟢" if pnl > 0 else "🔴" if pnl < 0 else "🟡"
                        embed = Embed(title="✅ Position Closed", color=custom_color)
                        embed.description = f"Closed position in {symbol.upper()} at ${exit_price:.2f}\n**P&L:** {pnl_emoji} ${pnl:.2f}"
                        await interaction.followup.send(embed=embed)
                    else:
                        embed = Embed(title="❌ Error", color=Color.red())
                        embed.description = f"No open position found for {symbol.upper()}"
                        await interaction.followup.send(embed=embed, ephemeral=True)
                else:
                    embed = Embed(title="❌ Error", color=Color.red())
                    embed.description = f"Could not get current price for {symbol.upper()}"
                    await interaction.followup.send(embed=embed, ephemeral=True)
                
            except Exception as e:
                embed = Embed(title="❌ Error", color=Color.red())
                embed.description = f"Failed to remove position: {str(e)}"
                await interaction.followup.send(embed=embed, ephemeral=True)

        @self.bot.tree.command(name="portfolio-setup", description="Setup your trading profile")
        async def portfolio_setup(interaction):
            """Setup your trading profile."""
            if not await check_command_channel(interaction):
                return
            
            await interaction.response.defer()
            
            try:
                user_id = interaction.user.id
                username = interaction.user.display_name
                custom_color = Color.from_rgb(210, 149, 68)  # #d29544
                
                # Create or update user profile with default values
                self.db.create_user_profile(
                    user_id, 
                    username,
                    trading_experience="beginner",
                    preferred_timeframe="1h",
                    risk_tolerance="moderate",
                    learning_goals="Learn trading basics"
                )
                
                embed = Embed(title="🎯 Profile Setup Complete!", color=custom_color)
                embed.description = """**Your trading profile has been created with default settings:**

📊 **Trading Experience:** Beginner
⏰ **Preferred Timeframe:** 1 Hour
🎯 **Risk Tolerance:** Moderate
🎓 **Learning Goals:** Learn trading basics

**Next Steps:**
• Use `/portfolio` to view your portfolio and profile
• Use `/portfolio-update` to customize your settings
• Start adding positions with `/portfolio-add`

**Your profile helps the AI provide personalized trading advice!**"""
                await interaction.followup.send(embed=embed)
                
            except Exception as e:
                embed = Embed(title="❌ Error", color=Color.red())
                embed.description = f"Failed to setup profile: {str(e)}"
                await interaction.followup.send(embed=embed, ephemeral=True)

        @self.bot.tree.command(name="portfolio-update", description="Update your trading profile")
        @app_commands.describe(
            experience="Your trading experience level",
            timeframe="Your preferred trading timeframe",
            risk="Your risk tolerance level",
            goals="Your learning goals"
        )
        @app_commands.choices(experience=[
            app_commands.Choice(name="Beginner", value="beginner"),
            app_commands.Choice(name="Intermediate", value="intermediate"),
            app_commands.Choice(name="Advanced", value="advanced")
        ])
        @app_commands.choices(timeframe=[
            app_commands.Choice(name="5 Minutes", value="5m"),
            app_commands.Choice(name="15 Minutes", value="15m"),
            app_commands.Choice(name="1 Hour", value="1h"),
            app_commands.Choice(name="1 Day", value="1d")
        ])
        @app_commands.choices(risk=[
            app_commands.Choice(name="Conservative", value="conservative"),
            app_commands.Choice(name="Moderate", value="moderate"),
            app_commands.Choice(name="Aggressive", value="aggressive")
        ])
        async def portfolio_update(interaction, experience: str = None, timeframe: str = None, risk: str = None, goals: str = None):
            """Update your trading profile."""
            if not await check_command_channel(interaction):
                return
            if not await check_required_role(interaction, 'core', 'Portfolio update'):
                return
            
            await interaction.response.defer()
            
            try:
                user_id = interaction.user.id
                custom_color = Color.from_rgb(210, 149, 68)  # #d29544
                
                # Check if user has a profile
                profile = self.db.get_user_profile(user_id)
                if not profile:
                    embed = Embed(title="❌ No Profile Found", color=Color.red())
                    embed.description = "You don't have a trading profile yet. Use `/portfolio-setup` to create one!"
                    await interaction.followup.send(embed=embed, ephemeral=True)
                    return
                
                # Update profile with provided values
                update_data = {}
                if experience:
                    update_data['trading_experience'] = experience
                if timeframe:
                    update_data['preferred_timeframe'] = timeframe
                if risk:
                    update_data['risk_tolerance'] = risk
                if goals:
                    update_data['learning_goals'] = goals
                
                if update_data:
                    self.db.update_user_preferences(user_id, **update_data)
                    
                    embed = Embed(title="✅ Profile Updated", color=custom_color)
                    embed.description = "Your trading profile has been updated successfully!"
                    
                    # Show what was updated
                    updated_fields = []
                    if experience:
                        updated_fields.append(f"**Experience:** {experience.title()}")
                    if timeframe:
                        updated_fields.append(f"**Timeframe:** {timeframe.upper()}")
                    if risk:
                        updated_fields.append(f"**Risk:** {risk.title()}")
                    if goals:
                        updated_fields.append(f"**Goals:** {goals}")
                    
                    if updated_fields:
                        embed.add_field(
                            name="Updated Fields",
                            value="\n".join(updated_fields),
                            inline=False
                        )
                    
                    await interaction.followup.send(embed=embed)
                else:
                    embed = Embed(title="❌ No Updates", color=Color.red())
                    embed.description = "Please provide at least one field to update.\n**Usage:** `/portfolio-update experience:intermediate risk:aggressive`"
                    await interaction.followup.send(embed=embed, ephemeral=True)
                
            except Exception as e:
                embed = Embed(title="❌ Error", color=Color.red())
                embed.description = f"Failed to update profile: {str(e)}"
                await interaction.followup.send(embed=embed, ephemeral=True)

        @self.bot.tree.command(name="portfolio-stats", description="View your trading statistics")
        async def portfolio_stats(interaction):
            """View your trading statistics."""
            if not await check_command_channel(interaction):
                return
            if not await check_required_role(interaction, 'core', 'Portfolio stats'):
                return
            
            await interaction.response.defer()
            
            try:
                user_id = interaction.user.id
                custom_color = Color.from_rgb(210, 149, 68)  # #d29544
                
                stats = self.db.get_user_stats(user_id)
                
                if not stats:
                    embed = Embed(title="❌ No Profile Found", color=Color.red())
                    embed.description = "You don't have a trading profile yet. Use `/portfolio-setup` to create one!"
                    await interaction.followup.send(embed=embed, ephemeral=True)
                    return
                
                embed = Embed(title="📊 Your Trading Statistics", color=custom_color)
                
                # Portfolio stats
                portfolio = stats.get('portfolio', {})
                embed.add_field(
                    name="💼 Portfolio",
                    value=f"**Positions:** {portfolio.get('total_positions', 0)}\n**Closed:** {portfolio.get('closed_positions', 0)}\n**Total P&L:** ${portfolio.get('total_pnl', 0):.2f}",
                    inline=True
                )
                
                # Question stats
                questions = stats.get('questions', {})
                embed.add_field(
                    name="🧠 Knowledge",
                    value=f"**Questions:** {questions.get('total_questions', 0)}\n**Correct:** {questions.get('correct_answers', 0)}\n**Accuracy:** {questions.get('accuracy', 0)}%",
                    inline=True
                )
                
                # Learning stats
                learning = stats.get('learning', {})
                embed.add_field(
                    name="📚 Learning",
                    value=f"**Modules:** {learning.get('total_modules', 0)}\n**Progress:** {learning.get('avg_completion', 0)}%",
                    inline=True
                )
                
                await interaction.followup.send(embed=embed)
                
            except Exception as e:
                embed = Embed(title="❌ Error", color=Color.red())
                embed.description = f"Failed to fetch statistics: {str(e)}"
                await interaction.followup.send(embed=embed, ephemeral=True)

        @self.bot.tree.command(name="watchlist", description="Manage your stock watchlist")
        @app_commands.describe(
            action="Watchlist action to perform",
            symbol="Stock symbol (only needed for add/remove actions)"
        )
        @app_commands.choices(action=[
            app_commands.Choice(name="Show Watchlist", value="show"),
            app_commands.Choice(name="Add Stock", value="add"),
            app_commands.Choice(name="Remove Stock", value="remove")
        ])
        async def watchlist_slash(interaction, action: str, symbol: str = None):
            """Manage your watchlist."""
            if not await check_command_channel(interaction):
                return
            if not await check_required_role(interaction, 'core', 'Watchlist'):
                return
            
            user_id = interaction.user.id
            custom_color = Color.from_rgb(210, 149, 68)  # #d29544
            
            try:
                if action == "show":
                    watchlist = self.db.get_user_watchlist(user_id)
                    if not watchlist:
                        embed = Embed(title="📝 Empty Watchlist", color=custom_color)
                        embed.description = "Your watchlist is empty. Use `/watchlist add` to add stocks."
                        await interaction.response.send_message(embed=embed)
                        return
                    
                    embed = Embed(title="👀 Your Watchlist", color=custom_color)
                    embed.description = "\n".join([f"• {symbol}" for symbol in watchlist])
                    await interaction.response.send_message(embed=embed)
                
                elif action == "add" and symbol:
                    symbol_cleaned = clean_symbol(symbol)
                    if not symbol_cleaned:
                        embed = Embed(title="❌ Invalid Symbol", color=Color.red())
                        embed.description = f"Invalid symbol: {symbol}"
                        await interaction.response.send_message(embed=embed, ephemeral=True)
                        return
                    
                    await interaction.response.defer()
                    try:
                        # Validate asset exists before adding
                        price_ctx = await fetch_price_context_smart(symbol_cleaned)
                        if not price_ctx:
                            embed = Embed(title="❌ Validation Failed", color=Color.red())
                            embed.description = f"Could not validate {symbol_cleaned}. Please check the symbol and try again."
                            await interaction.followup.send(embed=embed, ephemeral=True)
                            return
                        
                        self.db.add_to_watchlist(user_id, symbol_cleaned)
                        embed = Embed(title="✅ Watchlist Updated", color=custom_color)
                        embed.description = f"Added {symbol_cleaned} to your watchlist!"
                        await interaction.followup.send(embed=embed)
                    except Exception as e:
                        logging.error(f"Error adding {symbol_cleaned} to watchlist: {e}", exc_info=True)
                        embed = Embed(title="❌ Error", color=Color.red())
                        embed.description = f"Failed to add {symbol_cleaned} to watchlist: {str(e)}"
                        await interaction.followup.send(embed=embed, ephemeral=True)
                
                elif action == "remove" and symbol:
                    self.db.remove_from_watchlist(user_id, symbol)
                    embed = Embed(title="✅ Watchlist Updated", color=custom_color)
                    embed.description = f"Removed {symbol.upper()} from your watchlist!"
                    await interaction.response.send_message(embed=embed)
                
                else:
                    embed = Embed(title="❌ Usage Error", color=Color.red())
                    embed.description = "**Usage:** `/watchlist [show/add/remove] [symbol]`\n**Examples:**\n`/watchlist show`\n`/watchlist add symbol:AAPL`\n`/watchlist remove symbol:TSLA`"
                    await interaction.response.send_message(embed=embed, ephemeral=True)
            except Exception as e:
                embed = Embed(title="❌ Error", color=Color.red())
                embed.description = f"Failed to manage watchlist: {str(e)}"
                await interaction.response.send_message(embed=embed, ephemeral=True)

        @self.bot.tree.command(name="alert", description="Set a price alert for a crypto or stock")
        @app_commands.describe(
            symbol="Symbol to set alert for (crypto or stock)",
            price="Target price for the alert"
        )
        @app_commands.autocomplete(symbol=asset_autocomplete)
        async def alert_slash(interaction, symbol: str, price: float):
            """Set a price alert for a symbol."""
            if not await check_command_channel(interaction):
                return
            if not await check_required_role(interaction, 'core', 'Alerts'):
                return
            
            if not symbol or price is None:
                embed = Embed(title="❌ Missing Parameters", color=Color.red())
                embed.description = "Please provide both symbol and target price.\n**Usage:** `/alert <symbol> <price>`\n**Example:** `/alert BTC 70000` or `/alert AAPL 150.00`"
                await interaction.response.send_message(embed=embed, ephemeral=True)
                return
            
            if price <= 0:
                embed = Embed(title="❌ Invalid Price", color=Color.red())
                embed.description = "Price must be a positive number."
                await interaction.response.send_message(embed=embed, ephemeral=True)
                return
            
            symbol_cleaned = clean_symbol(symbol)
            if not symbol_cleaned:
                embed = Embed(title="❌ Invalid Symbol", color=Color.red())
                embed.description = f"Invalid symbol: {symbol}"
                await interaction.response.send_message(embed=embed, ephemeral=True)
                return
            
            await interaction.response.defer()
            
            try:
                # Validate asset exists before creating alert
                price_ctx = await fetch_price_context_smart(symbol_cleaned)
                if not price_ctx:
                    embed = Embed(title="❌ Validation Failed", color=Color.red())
                    embed.description = f"Could not validate {symbol_cleaned}. Please check the symbol and try again."
                    await interaction.followup.send(embed=embed, ephemeral=True)
                    return
                
                user_id = interaction.user.id
                self.db.add_alert(user_id, symbol_cleaned, price, "PRICE")
                custom_color = Color.from_rgb(210, 149, 68)  # #d29544
                embed = Embed(title="🔔 Alert Set", color=custom_color)
                embed.description = f"Alert set for {symbol_cleaned} at ${price:.2f}"
                await interaction.followup.send(embed=embed)
            except Exception as e:
                logging.error(f"Error setting alert for {symbol_cleaned}: {e}", exc_info=True)
                embed = Embed(title="❌ Error", color=Color.red())
                embed.description = f"Failed to set alert: {str(e)}"
                await interaction.followup.send(embed=embed, ephemeral=True)

        @self.bot.tree.command(name="alerts", description="Show your active price alerts")
        async def alerts_slash(interaction):
            """Show your active alerts."""
            if not await check_command_channel(interaction):
                return
            if not await check_required_role(interaction, 'core', 'Alerts'):
                return
            
            try:
                user_id = interaction.user.id
                alerts = self.db.get_user_alerts(user_id)
                
                if not alerts:
                    custom_color = Color.from_rgb(210, 149, 68)  # #d29544
                    embed = Embed(title="🔔 No Active Alerts", color=custom_color)
                    embed.description = "You have no active alerts. Use `/alert` to set one."
                    await interaction.response.send_message(embed=embed)
                    return
                
                custom_color = Color.from_rgb(210, 149, 68)  # #d29544
                embed = Embed(title="🔔 Your Active Alerts", color=custom_color)
                for i, (symbol, price, alert_type, created, direction) in enumerate(alerts, 1):
                    direction_label = '≥' if direction == '>=' else '≤'
                    embed.add_field(
                        name=f"Alert #{i}",
                        value=(
                            f"**{symbol}** {direction_label} {('$' + f'{price:.2f}') if alert_type == 'PRICE' else f'{price:.2f}%'}\n"
                            f"Type: {alert_type}\n"
                            f"Set: {created[:10]}"
                        ),
                        inline=True
                    )
                await interaction.response.send_message(embed=embed)
            except Exception as e:
                embed = Embed(title="❌ Error", color=Color.red())
                embed.description = f"Failed to fetch alerts: {str(e)}"
                await interaction.response.send_message(embed=embed, ephemeral=True)

        @self.bot.tree.command(name="market", description="Show current market status")
        async def market_slash(interaction):
            """Show current market status."""
            if not await check_command_channel(interaction):
                return
            if not await check_required_role(interaction, 'core', 'Market overview'):
                return
            
            try:
                now = dt.datetime.now(PACIFIC_TZ)
                market_open = now.replace(hour=6, minute=30, second=0, microsecond=0)
                market_close = now.replace(hour=13, minute=0, second=0, microsecond=0)
                
                custom_color = Color.from_rgb(210, 149, 68)  # #d29544
                embed = Embed(title="📈 Market Status", color=custom_color)
                
                if market_open <= now <= market_close:
                    embed.description = "🟢 **Market is OPEN**"
                    embed.add_field(name="Status", value="🟢 OPEN", inline=True)
                    embed.add_field(name="Time", value=now.strftime("%H:%M:%S %Z"), inline=True)
                else:
                    embed.description = "🔴 **Market is CLOSED**"
                    embed.add_field(name="Status", value="🔴 CLOSED", inline=True)
                    embed.add_field(name="Time", value=now.strftime("%H:%M:%S %Z"), inline=True)
                
                embed.add_field(name="Next Open", value="06:30 AM PST", inline=True)
                embed.add_field(name="Next Close", value="01:00 PM PST", inline=True)
                
                await interaction.response.send_message(embed=embed)
                
            except Exception as e:
                embed = Embed(title="❌ Error", color=Color.red())
                embed.description = f"Failed to get market status: {str(e)}"
                await interaction.response.send_message(embed=embed, ephemeral=True)

        @self.bot.tree.command(name="stats", description="Show bot performance statistics")
        async def stats_slash(interaction):
            """Show bot performance statistics."""
            if not await check_command_channel(interaction):
                return
            
            try:
                stats = self.db.get_signals_stats(30)
                
                custom_color = Color.from_rgb(210, 149, 68)  # #d29544
                embed = Embed(title="📊 Bot Statistics (Last 30 Days)", color=custom_color)
                embed.add_field(name="📈 Total Signals", value=str(stats['total_signals']), inline=True)
                embed.add_field(name="🎯 Unique Symbols", value=str(stats['unique_symbols']), inline=True)
                embed.add_field(name="📊 Avg Performance", value=f"{stats['avg_performance']:.2f}%" if stats['avg_performance'] else "N/A", inline=True)
                # Runtime metrics
                embed.add_field(name="✅ API Success", value=str(METRICS.get("api_success_total", 0)), inline=True)
                embed.add_field(name="⚠️ API Failures", value=str(METRICS.get("api_failure_total", 0)), inline=True)
                embed.add_field(name="🧯 Circuit Trips", value=str(METRICS.get("circuit_breaker_trips_total", 0)), inline=True)
                embed.add_field(name="🖱️ Button Clicks", value=str(METRICS.get("button_clicks_total", 0)), inline=True)
                embed.add_field(name="📥 DMs Sent", value=str(METRICS.get("dms_sent_total", 0)), inline=True)
                
                await interaction.response.send_message(embed=embed)
            except Exception as e:
                embed = Embed(title="❌ Error", color=Color.red())
                embed.description = f"Failed to fetch statistics: {str(e)}"
                await interaction.response.send_message(embed=embed, ephemeral=True)

        @self.bot.tree.command(name="show_stocks", description="Show available penny stocks")
        async def show_stocks_slash(interaction):
            """Show available penny stocks."""
            if not await check_command_channel(interaction):
                return
            
            try:
                tickers = self.tickers_provider.penny_stocks()
                df = pd.DataFrame({"Tickers": tickers})
                custom_color = Color.from_rgb(210, 149, 68)  # #d29544
                embed = Embed(title="📈 Available Penny Stocks", color=custom_color)
                embed.description = f"```{df.to_string(index=False)}```"
                await interaction.response.send_message(embed=embed)
            except Exception as e:
                embed = Embed(title="❌ Error", color=Color.red())
                embed.description = f"Failed to fetch penny stocks: {str(e)}"
                await interaction.response.send_message(embed=embed, ephemeral=True)

        @self.bot.tree.command(name="time", description="Show current Pacific time")
        async def time_slash(interaction):
            """Show current Pacific time."""
            if not await check_command_channel(interaction):
                return
            
            now_pacific = dt.datetime.now(PACIFIC_TZ).strftime("%H:%M:%S %Z")
            custom_color = Color.from_rgb(210, 149, 68)  # #d29544
            embed = Embed(title="🕐 Current Time", color=custom_color)
            embed.description = f"**Pacific Time:** {now_pacific}"
            await interaction.response.send_message(embed=embed)

    async def _maybe_send_market_open_message(self) -> None:
        now = dt.datetime.now(PACIFIC_TZ)
        market_open = now.replace(hour=6, minute=30, second=0, microsecond=0)
        market_close = now.replace(hour=13, minute=0, second=0, microsecond=0)
        if market_open <= now <= market_close and self.signal_channel_id:
            channel = self.bot.get_channel(self.signal_channel_id)
            if channel:
                await channel.send("The market is open", allowed_mentions=self.allowed_mentions)

    @tasks.loop(time=SIGNAL_RUN_TIMES)
    async def daily_signal_task(self) -> None:
        await self._generate_and_send_daily_signal()
    
    @tasks.loop(minutes=5)
    async def alert_check_task(self) -> None:
        """Check price alerts and portfolio updates every 5 minutes and send DMs."""
        try:
            # Check price alerts
            await self._check_price_alerts()
            
            # Check portfolio updates
            await self._check_portfolio_updates()

            # Evaluate open signals for performance
            await self._evaluate_signal_performance()
                    
        except Exception as e:
            logging.error(f"Error in alert check task: {e}")
    
    async def _check_price_alerts(self):
        """Check price alerts and send notifications for triggered alerts."""
        try:
            # Get all active alerts
            alerts = self.db.get_all_active_alerts()
            if not alerts:
                return
            
            # Group alerts by symbol to minimize API calls
            symbol_alerts: Dict[str, List[Tuple[int, int, float, str, str, Optional[str], Optional[str], Optional[str]]]] = {}
            for alert_id, user_id, symbol, threshold, alert_type, direction, asset_type, display_symbol, display_name in alerts:
                if symbol not in symbol_alerts:
                    symbol_alerts[symbol] = []
                symbol_alerts[symbol].append((alert_id, user_id, threshold, alert_type, direction, asset_type, display_symbol, display_name))
            
            prefetch_entries: List[Tuple[str, Optional[str]]] = []
            for symbol, symbol_alert_list in symbol_alerts.items():
                asset_hint = next((entry[5] for entry in symbol_alert_list if entry[5]), None)
                prefetch_entries.append((symbol, asset_hint))

            price_cache = await self._prefetch_price_contexts(prefetch_entries, concurrency=4)
            
            # Check each symbol
            for symbol, symbol_alert_list in symbol_alerts.items():
                try:
                    asset_hint = next((entry[5] for entry in symbol_alert_list if entry[5]), None)
                    price_ctx = self._get_prefetched_price(price_cache, symbol, asset_hint)
                    if not price_ctx:
                        price_ctx = await fetch_price_context_smart(symbol, asset_hint)
                        if price_ctx:
                            self._store_prefetched_price(price_cache, symbol, asset_hint, price_ctx)
                    if not price_ctx:
                        continue
                    
                    current_price = price_ctx.get("current_price", 0)
                    if current_price <= 0:
                        continue
                    
                    previous_close = price_ctx.get("previous_close")
                    day_change_pct = price_ctx.get("day_change_pct")
                    
                    # Check each alert for this symbol
                    for alert_id, user_id, threshold, alert_type, direction, asset_type, display_symbol, display_name in symbol_alert_list:
                        try:
                            # Check if alert should trigger
                            should_trigger = False
                            alert_kind = (alert_type or '').lower()
                            direction_op = direction or '>='
                            change_value: Optional[float] = None

                            if alert_kind == "price":
                                if direction_op == '>=':
                                    should_trigger = current_price >= threshold
                                else:
                                    should_trigger = current_price <= threshold
                                change_value = ((current_price - threshold) / max(threshold, 1e-9)) * 100 if threshold else 0
                            elif alert_kind == "%":
                                if day_change_pct is None:
                                    continue
                                change_value = day_change_pct
                                if direction_op == '>=':
                                    should_trigger = day_change_pct >= threshold
                                else:
                                    should_trigger = day_change_pct <= threshold
                            else:
                                continue
                            
                            if should_trigger:
                                # Mark alert as triggered FIRST to prevent duplicate notifications.
                                # Only continue if the alert was still active (returns True when updated).
                                was_active = self.db.mark_alert_triggered(alert_id)
                                if not was_active:
                                    logging.info(
                                        "Alert %s for %s skipped because it is no longer active",
                                        alert_id,
                                        symbol,
                                    )
                                    continue

                                # Send DM notification
                                await self._send_alert_dm(
                                    user_id,
                                    symbol,
                                    threshold,
                                    current_price,
                                    alert_kind,
                                    direction_op,
                                    change_value if alert_kind == '%' else None,
                                    alert_id,
                                    asset_type,
                                    display_symbol,
                                    display_name,
                                    price_ctx.get('logo_url') if isinstance(price_ctx, dict) else None,
                                )
                                
                                logging.info(
                                    "Alert triggered: %s %s %.4f (current %.4f) for user %s",
                                    symbol,
                                    direction_op,
                                    threshold,
                                    current_price,
                                    user_id,
                                )
                        
                        except Exception as e:
                            logging.error(f"Error processing alert {alert_id} for {symbol}: {e}")
                            continue
                
                except Exception as e:
                    logging.error(f"Error checking alerts for {symbol}: {e}")
                    continue
                    
        except Exception as e:
            logging.error(f"Error checking price alerts: {e}")
    
    async def _check_portfolio_updates(self):
        """Check portfolio positions for significant P&L changes and send notifications."""
        try:
            # Get all open portfolio positions
            positions = self.db.get_portfolio_positions_for_notifications()
            if not positions:
                return
            
            # Group positions by symbol to minimize API calls
            symbol_positions = {}
            for position_id, user_id, symbol, shares, avg_price, last_notified_pnl, threshold_pref in positions:
                if symbol not in symbol_positions:
                    symbol_positions[symbol] = []
                symbol_positions[symbol].append((position_id, user_id, shares, avg_price, last_notified_pnl, threshold_pref))
            
            prefetch_entries = [(symbol, None) for symbol in symbol_positions.keys()]
            price_cache = await self._prefetch_price_contexts(prefetch_entries, concurrency=4)

            # Check each symbol
            for symbol, symbol_positions_list in symbol_positions.items():
                try:
                    price_ctx = self._get_prefetched_price(price_cache, symbol, None)
                    if not price_ctx:
                        price_ctx = await fetch_price_context_smart(symbol)
                        if price_ctx:
                            self._store_prefetched_price(price_cache, symbol, None, price_ctx)
                    if not price_ctx:
                        continue
                    
                    current_price = price_ctx.get("current_price", 0)
                    if current_price <= 0:
                        continue
                    
                    # Check each position for this symbol
                    for position_id, user_id, shares, avg_price, last_notified_pnl, threshold_pref in symbol_positions_list:
                        try:
                            # Calculate current P&L
                            current_pnl = (current_price - avg_price) * shares
                            current_pnl_pct = ((current_price / avg_price - 1) * 100) if avg_price > 0 else 0
                            
                            # Check if we should send a notification
                            should_notify = False
                            if threshold_pref is None:
                                # User has disabled portfolio notifications
                                logging.debug(f"Portfolio notifications disabled for user {user_id}, symbol {symbol}")
                                continue
                            
                            # threshold_pref is already validated by _extract_portfolio_threshold (1-15 or None)
                            try:
                                notification_threshold_pct = float(threshold_pref)
                                if notification_threshold_pct <= 0:
                                    # Invalid threshold, skip
                                    logging.warning(f"Invalid portfolio threshold (<=0) for user {user_id}: {threshold_pref}")
                                    continue
                            except (ValueError, TypeError):
                                # Invalid threshold value, skip
                                logging.warning(f"Invalid portfolio threshold type for user {user_id}: {threshold_pref} (type: {type(threshold_pref)})")
                                continue
                            
                            if last_notified_pnl is None:
                                # First time checking this position - check if absolute P&L meets threshold
                                if abs(current_pnl_pct) >= notification_threshold_pct:
                                    should_notify = True
                                    logging.debug(f"Portfolio first notification: {symbol} P&L {current_pnl_pct:.2f}% >= threshold {notification_threshold_pct:.2f}%")
                            else:
                                # Check if P&L has changed significantly since last notification
                                notional = avg_price * shares if avg_price and shares else 0
                                last_percent = ((last_notified_pnl / notional) * 100) if notional else 0
                                pnl_change_pct = abs(current_pnl_pct - last_percent)
                                if pnl_change_pct >= notification_threshold_pct:
                                    should_notify = True
                                    logging.debug(f"Portfolio change notification: {symbol} P&L changed {pnl_change_pct:.2f}% >= threshold {notification_threshold_pct:.2f}%")
                            
                            if should_notify:
                                # Send portfolio update notification
                                logging.info(f"Portfolio notification triggered: {symbol} P&L {current_pnl_pct:+.2f}% (threshold: {notification_threshold_pct:.2f}%) for user {user_id}")
                                await self._send_portfolio_update_dm(
                                    user_id,
                                    symbol,
                                    shares,
                                    avg_price,
                                    current_price,
                                    current_pnl,
                                    current_pnl_pct,
                                    price_ctx,
                                )
                                
                                # Update last notified P&L
                                self.db.update_portfolio_notification_pnl(position_id, current_pnl)
                                
                                logging.info(f"Portfolio update sent: {symbol} P&L ${current_pnl:.2f} ({current_pnl_pct:+.2f}%) for user {user_id}")
                            else:
                                logging.debug(f"Portfolio check skipped: {symbol} P&L {current_pnl_pct:+.2f}% < threshold {notification_threshold_pct:.2f}% for user {user_id}")
                        
                        except Exception as e:
                            logging.error(f"Error processing portfolio position {position_id} for {symbol}: {e}")
                            continue
                
                except Exception as e:
                    logging.error(f"Error checking portfolio for {symbol}: {e}")
                    continue
                    
        except Exception as e:
            logging.error(f"Error checking portfolio updates: {e}")
    
    async def _evaluate_signal_performance(self) -> None:
        """Periodically evaluate open signals to track target/stop performance."""
        try:
            candidates = self.db.get_signals_for_performance(
                SIGNAL_PERFORMANCE_RECHECK_MINUTES,
                limit=8,
            )
            if not candidates:
                return

            for record in candidates:
                try:
                    await self._evaluate_single_signal(record)
                except Exception as err:
                    logging.error("Failed to evaluate performance for signal %s: %s", record.get("id"), err, exc_info=True)
        except Exception as outer_err:
            logging.error("Error during signal performance evaluation: %s", outer_err, exc_info=True)

    async def _evaluate_single_signal(self, record: Dict[str, Any]) -> None:
        signal_id = record.get("id")
        if not signal_id:
            return

        def to_float(value: Any) -> Optional[float]:
            if value is None:
                return None
            if isinstance(value, (int, float)):
                return float(value)
            if isinstance(value, Decimal):
                return float(value)
            if isinstance(value, str) and value.strip():
                try:
                    return float(value)
                except ValueError:
                    return None
            return None

        raw_details = record.get("details") or {}
        details = dict(raw_details) if isinstance(raw_details, dict) else {}
        performance_meta = details.get("performance") or {}

        symbol = str(record.get("symbol") or "").upper()
        asset_type = str(record.get("asset_type") or details.get("asset_type") or "equity").lower()
        price_symbol = details.get("price_symbol") or details.get("priceSymbol") or symbol
        if not price_symbol:
            return

        direction_value = str(performance_meta.get("direction") or details.get("direction") or record.get("signal_type") or "BUY").lower()
        direction = "sell" if direction_value.startswith("sell") else "buy"

        entry_price = to_float(performance_meta.get("entryPrice")) or to_float(record.get("price")) or to_float(details.get("current_price"))
        if entry_price is None or entry_price <= 0:
            return

        targets_raw = details.get("targets") or []
        targets: List[Dict[str, Any]] = []
        for idx, target in enumerate(targets_raw):
            if isinstance(target, dict):
                price_val = to_float(target.get("price"))
                if price_val is not None and price_val > 0:
                    targets.append({
                        "price": price_val,
                        "label": target.get("label") or f"Target {idx + 1}",
                    })

        if direction == "buy":
            targets.sort(key=lambda item: item["price"])
        else:
            targets.sort(key=lambda item: item["price"], reverse=True)

        stop_raw = details.get("stop") or {}
        stop_price = to_float(stop_raw.get("price"))

        timestamp_value = record.get("timestamp")
        if isinstance(timestamp_value, str):
            try:
                signal_time = dt.datetime.fromisoformat(timestamp_value.replace("Z", "+00:00"))
            except ValueError:
                signal_time = dt.datetime.utcnow()
        elif isinstance(timestamp_value, dt.datetime):
            signal_time = timestamp_value
        else:
            signal_time = dt.datetime.utcnow()

        if signal_time.tzinfo is None:
            signal_time = signal_time.replace(tzinfo=dt.timezone.utc)
        else:
            signal_time = signal_time.astimezone(dt.timezone.utc)

        history = await self._download_price_history(price_symbol, signal_time, asset_type)

        now_utc = dt.datetime.utcnow().replace(tzinfo=dt.timezone.utc)
        updated_performance: Dict[str, Any] = {
            "status": "open",
            "direction": direction,
            "entryPrice": entry_price,
            "evaluatedAt": now_utc.isoformat(),
        }

        max_gain_pct = to_float(performance_meta.get("maxGainPct")) or 0.0
        max_drawdown_pct = to_float(performance_meta.get("maxDrawdownPct")) or 0.0
        highest_price = to_float(performance_meta.get("highPrice")) or entry_price
        lowest_price = to_float(performance_meta.get("lowPrice")) or entry_price
        bars_checked = 0
        target_hit: Optional[Tuple[Dict[str, Any], dt.datetime]] = None
        stop_hit: Optional[Tuple[float, dt.datetime]] = None

        current_price = entry_price

        if history is not None and not history.empty:
            history = history.dropna(subset=["High", "Low", "Close"], how="any")
            bars_checked = len(history)

            for ts, row in history.iterrows():
                high_price = to_float(row.get("High")) or entry_price
                low_price = to_float(row.get("Low")) or entry_price
                close_price = to_float(row.get("Close")) or entry_price

                if high_price > (highest_price or high_price):
                    highest_price = high_price
                if low_price < (lowest_price or low_price):
                    lowest_price = low_price

                bar_time = ts.to_pydatetime()
                if bar_time.tzinfo is None:
                    bar_time = bar_time.replace(tzinfo=dt.timezone.utc)
                else:
                    bar_time = bar_time.astimezone(dt.timezone.utc)

                if direction == "buy":
                    gain_pct = ((high_price / entry_price) - 1.0) * 100.0
                    drawdown_pct = ((low_price / entry_price) - 1.0) * 100.0
                    if gain_pct > max_gain_pct:
                        max_gain_pct = gain_pct
                    if drawdown_pct < max_drawdown_pct:
                        max_drawdown_pct = drawdown_pct

                    if not target_hit:
                        for target in targets:
                            if high_price >= target["price"]:
                                target_hit = (target, bar_time)
                                break
                    if stop_price is not None and not stop_hit and low_price <= stop_price:
                        stop_hit = (stop_price, bar_time)
                else:
                    gain_pct = ((entry_price - low_price) / entry_price) * 100.0
                    drawdown_pct = ((high_price - entry_price) / entry_price) * 100.0
                    if gain_pct > max_gain_pct:
                        max_gain_pct = gain_pct
                    adverse = -drawdown_pct
                    if adverse < max_drawdown_pct:
                        max_drawdown_pct = adverse

                    if not target_hit:
                        for target in targets:
                            if low_price <= target["price"]:
                                target_hit = (target, bar_time)
                                break
                    if stop_price is not None and not stop_hit and high_price >= stop_price:
                        stop_hit = (stop_price, bar_time)

                current_price = close_price

        if bars_checked == 0:
            price_ctx = await fetch_price_context_yf_with_retry(price_symbol)
            if price_ctx:
                ctx_price = to_float(price_ctx.get("current_price"))
                if ctx_price is not None and ctx_price > 0:
                    current_price = ctx_price
                    if ctx_price > (highest_price or ctx_price):
                        highest_price = ctx_price
                    if ctx_price < (lowest_price or ctx_price):
                        lowest_price = ctx_price

        targets_reached = 0
        if targets:
            if direction == "buy":
                highest_reached = highest_price or entry_price
                targets_reached = sum(1 for target in targets if highest_reached >= target["price"])
            else:
                lowest_reached = lowest_price or entry_price
                targets_reached = sum(1 for target in targets if lowest_reached <= target["price"])

        resolved_status = "open"
        resolved_time: Optional[dt.datetime] = None
        resolved_target: Optional[Dict[str, Any]] = None

        if target_hit and stop_hit:
            if target_hit[1] <= stop_hit[1]:
                resolved_status = "target_hit"
                resolved_time = target_hit[1]
                resolved_target = target_hit[0]
            else:
                resolved_status = "stop_hit"
                resolved_time = stop_hit[1]
        elif target_hit:
            resolved_status = "target_hit"
            resolved_time = target_hit[1]
            resolved_target = target_hit[0]
        elif stop_hit:
            resolved_status = "stop_hit"
            resolved_time = stop_hit[1]

        current_move_pct: Optional[float]
        if direction == "buy":
            current_move_pct = ((current_price / entry_price) - 1.0) * 100.0
        else:
            current_move_pct = ((entry_price - current_price) / entry_price) * 100.0

        next_target_price = None
        next_target_label = None
        if resolved_status == "open" and targets:
            if direction == "buy":
                highest_reached = highest_price or entry_price
                for target in targets:
                    if highest_reached < target["price"]:
                        next_target_price = target["price"]
                        next_target_label = target.get("label")
                        break
            else:
                lowest_reached = lowest_price or entry_price
                for target in targets:
                    if lowest_reached > target["price"]:
                        next_target_price = target["price"]
                        next_target_label = target.get("label")
                        break

        if resolved_time:
            updated_performance["resolvedAt"] = resolved_time.isoformat()
            updated_performance["timeToResolutionMinutes"] = round((resolved_time - signal_time).total_seconds() / 60.0, 2)
        updated_performance["status"] = resolved_status
        updated_performance["lastPrice"] = current_price
        updated_performance["currentMovePct"] = round(current_move_pct, 2) if current_move_pct is not None else None
        updated_performance["maxGainPct"] = round(max_gain_pct, 2)
        updated_performance["maxDrawdownPct"] = round(max_drawdown_pct, 2)
        updated_performance["barsChecked"] = bars_checked
        updated_performance["targetsTotal"] = len(targets)
        updated_performance["targetsHit"] = targets_reached
        updated_performance["highPrice"] = highest_price
        updated_performance["lowPrice"] = lowest_price
        updated_performance["stopPrice"] = stop_price

        if resolved_status == "target_hit" and resolved_target:
            updated_performance["targetLabel"] = resolved_target.get("label")
            updated_performance["targetPrice"] = resolved_target.get("price")
        elif resolved_status == "stop_hit" and stop_hit:
            updated_performance["stopHitAt"] = stop_hit[1].isoformat()

        if resolved_status == "open" and next_target_price:
            updated_performance["nextTargetPrice"] = next_target_price
            updated_performance["nextTargetLabel"] = next_target_label
            if direction == "buy" and current_price:
                updated_performance["nextTargetPct"] = round(((next_target_price - current_price) / current_price) * 100.0, 2)
            elif direction == "sell" and current_price:
                updated_performance["nextTargetPct"] = round(((current_price - next_target_price) / current_price) * 100.0, 2)
        else:
            updated_performance["nextTargetPrice"] = None
            updated_performance["nextTargetLabel"] = None
            updated_performance["nextTargetPct"] = None

        updated_details = dict(details)
        updated_details["performance"] = {k: v for k, v in updated_performance.items() if v is not None}

        new_status = None
        if resolved_status == "target_hit":
            new_status = "completed"
        elif resolved_status == "stop_hit":
            new_status = "closed"

        self.db.update_signal_performance(signal_id, resolved_status, updated_details, new_status=new_status)

        if resolved_status == "target_hit":
            try:
                await self._notify_admin_signal_hit(signal_id, record, updated_performance)
            except Exception as notify_err:
                logging.debug(f"Admin notification failed for signal {signal_id}: {notify_err}")

        admin_notify_meta = dict(details.get("admin_notify") or {})
        if resolved_status == "target_hit":
            admin_notify_meta.setdefault("pending", True)
            if resolved_time:
                admin_notify_meta["lastResolvedAt"] = resolved_time.isoformat()
            admin_notify_meta["signalId"] = signal_id
        else:
            if admin_notify_meta:
                admin_notify_meta["pending"] = False
        if admin_notify_meta:
            updated_details["admin_notify"] = admin_notify_meta

    async def _download_price_history(self, price_symbol: str, start: dt.datetime, asset_type: str) -> Optional[pd.DataFrame]:
        """Fetch historical candles for performance evaluation in a thread."""

        def _fetch() -> Optional[pd.DataFrame]:
            try:
                ticker = yf.Ticker(price_symbol)
                now_utc = dt.datetime.utcnow().replace(tzinfo=dt.timezone.utc)
                
                # Ensure start is timezone-aware UTC
                if start.tzinfo is None:
                    start_utc = start.replace(tzinfo=dt.timezone.utc)
                else:
                    start_utc = start.astimezone(dt.timezone.utc)
                
                # Validate: start should not be in the future
                if start_utc > now_utc:
                    logging.debug("Signal start time is in the future, using current time instead")
                    start_utc = now_utc - dt.timedelta(days=1)
                
                delta = now_utc - start_utc
                
                # Determine interval and period based on time range
                if delta <= dt.timedelta(days=2):
                    interval = "5m"
                    period = "1d"
                elif delta <= dt.timedelta(days=7):
                    interval = "15m"
                    period = "5d"
                else:
                    interval = "1h"
                    period = "1mo"
                
                # Use period-based fetching (more reliable than start/end dates)
                history = ticker.history(period=period, interval=interval, auto_adjust=False)
                
                # Filter to only include data after the signal timestamp if needed
                if not history.empty and start_utc:
                    # Convert start to naive UTC for comparison (pandas index is naive)
                    start_naive = start_utc.replace(tzinfo=None)
                    history = history[history.index >= start_naive]
                
                return history
            except Exception as err:
                logging.debug("Price history fetch failed for %s: %s", price_symbol, err)
                return None

        return await asyncio.to_thread(_fetch)
    
    async def _send_alert_dm(
        self,
        user_id: int,
        symbol: str,
        target_value: float,
        current_price: float,
        alert_type: str,
        direction: str,
        change_metric: Optional[float] = None,
        alert_id: Optional[int] = None,
        asset_type: Optional[str] = None,
        display_symbol: Optional[str] = None,
        display_name: Optional[str] = None,
        logo_url: Optional[str] = None,
    ):
        """Send a DM notification for a triggered alert."""
        try:
            # Try to get user from cache first
            user = self.bot.get_user(user_id)
            if not user:
                # If not in cache, try to fetch from Discord API
                try:
                    user = await self.bot.fetch_user(user_id)
                except Exception:
                    logging.warning(f"Could not find user {user_id} for alert DM")
                    return
            
            if not user:
                logging.warning(f"Could not find user {user_id} for alert DM")
                return
            
            custom_color = Color.from_rgb(210, 149, 68)  # #d29544
            direction_phrase = "above" if direction == '>=' else "below"
            alert_type_normalized = (alert_type or "").upper()

            if alert_type_normalized == "PRICE":
                # Calculate percentage change relative to target
                target_price = float(target_value) if target_value is not None else 0.0
                baseline = target_price if target_price else current_price
                price_change = ((current_price - baseline) / max(baseline, 1e-9)) * 100.0
                change_emoji = "📈" if price_change >= 0 else "📉"
                embed = Embed(title="🔔 Price Alert Triggered!", color=custom_color)
                embed.description = f"**{symbol}** has met your price alert ({direction} {target_price:.2f})."
                embed.add_field(
                    name="📊 Price Details",
                    value=(
                        f"**Current Price:** ${current_price:.2f}\n"
                        f"**Target Price:** ${target_price:.2f}\n"
                        f"**Direction:** {direction}\n"
                        f"**Change vs Target:** {change_emoji} {price_change:+.2f}%"
                    ),
                    inline=False,
                )
            else:
                percent_target = float(target_value) if target_value is not None else 0.0
                actual_pct = float(change_metric) if change_metric is not None else 0.0
                change_emoji = "📈" if actual_pct >= 0 else "📉"
                embed = Embed(title="🔔 Percent Alert Triggered!", color=custom_color)
                embed.description = (
                    f"**{symbol}** change is {actual_pct:+.2f}% (threshold {direction_phrase} {percent_target:.2f}%)."
                )
                embed.add_field(
                    name="📊 Performance",
                    value=(
                        f"**Current Price:** ${current_price:.2f}\n"
                        f"**Target Change:** {direction} {percent_target:.2f}%\n"
                        f"**Actual Change:** {change_emoji} {actual_pct:+.2f}%"
                    ),
                    inline=False,
                )

            embed.add_field(name="⏰ Time", value=f"<t:{int(time.time())}:F>", inline=True)
            embed.add_field(name="🎯 Action", value="Consider reviewing your position or setting new alerts!", inline=True)

            if logo_url:
                try:
                    embed.set_thumbnail(url=str(logo_url))
                except Exception:
                    pass

            if alert_id is not None:
                embed.set_footer(text=f"Jack Of All Signals • Alert ID #{alert_id}")
            else:
                embed.set_footer(text="Jack Of All Signals • Smart Notifications")
            
            try:
                await user.send(embed=embed, view=self.AlertActionsView())
            except Exception:
                try:
                    await user.send(embed=embed)
                except Exception as dm_err:
                    logging.warning(f"Failed to deliver alert DM to user {user_id}: {dm_err}")
                    return

            # Notify website so in-app notifications appear immediately
            try:
                base = os.getenv('WEBSITE_API_BASE', 'http://localhost:8787')
                payload = {
                    'userId': user_id,
                    'symbol': symbol,
                    'direction': direction,
                    'threshold': float(target_value) if target_value is not None else None,
                    'currentPrice': float(current_price) if current_price is not None else None,
                    'type': alert_type,
                    'alertId': alert_id,
                    'assetType': asset_type,
                    'displaySymbol': display_symbol,
                    'displayName': display_name,
                    'active': False,
                    'triggeredAt': dt.datetime.utcnow().isoformat() + 'Z',
                    'changeValue': change_metric if change_metric is not None else None,
                }
                headers = {'Content-Type': 'application/json'}
                internal_key = os.getenv('INTERNAL_BOT_KEY') or os.getenv('WEBSITE_INTERNAL_KEY')
                if internal_key:
                    headers['x-internal-key'] = internal_key
                    requests.post(f"{base}/api/alerts/trigger-notify", json=payload, headers=headers, timeout=3)
            except Exception as notify_err:
                logging.debug(f"Notify website error: {notify_err}")

            METRICS["dms_sent_total"] = METRICS.get("dms_sent_total", 0) + 1
            
        except Exception as e:
            logging.error(f"Failed to send alert DM to user {user_id}: {e}")
    
    async def _send_portfolio_update_dm(
        self,
        user_id: int,
        symbol: str,
        shares: float,
        avg_price: float,
        current_price: float,
        pnl: float,
        pnl_pct: float,
        price_ctx: Optional[Dict[str, Any]] = None,
    ):
        """Send a DM notification for significant portfolio changes."""
        try:
            # Try to get user from cache first
            user = self.bot.get_user(user_id)
            if not user:
                # If not in cache, try to fetch from Discord API
                try:
                    user = await self.bot.fetch_user(user_id)
                except:
                    logging.warning(f"Could not find user {user_id} for portfolio update DM")
                    return
            
            if not user:
                logging.warning(f"Could not find user {user_id} for portfolio update DM")
                return
            
            custom_color = Color.from_rgb(210, 149, 68)  # #d29544
            
            # Determine if it's a gain or loss
            is_gain = pnl >= 0
            pnl_emoji = "📈" if is_gain else "📉"
            color = Color.green() if is_gain else Color.red()
            
            embed = Embed(title="💼 Portfolio Update", color=color)
            embed.description = f"**{symbol}** position has significant movement!"
            
            embed.add_field(
                name="📊 Position Details",
                value=f"**Shares:** {shares:.0f}\n**Entry Price:** ${avg_price:.2f}\n**Current Price:** ${current_price:.2f}",
                inline=True
            )
            
            embed.add_field(
                name="💰 P&L Summary",
                value=f"**Unrealized P&L:** {pnl_emoji} ${pnl:.2f}\n**Percentage:** {pnl_pct:+.2f}%",
                inline=True
            )
            
            embed.add_field(
                name="⏰ Time",
                value=f"<t:{int(time.time())}:F>",
                inline=True
            )
            
            # Add action suggestion based on performance
            if is_gain:
                action_text = "Consider taking profits or setting a stop-loss!"
            else:
                action_text = "Consider reviewing your position or setting a stop-loss!"
            
            embed.add_field(
                name="🎯 Action Suggestion",
                value=action_text,
                inline=False
            )
            
            embed.set_footer(text="Jack Of All Signals • Smart Notifications")
            
            await user.send(embed=embed)
            METRICS["dms_sent_total"] = METRICS.get("dms_sent_total", 0) + 1
            
        except Exception as e:
            logging.error(f"Failed to send portfolio update DM to user {user_id}: {e}")

    async def _generate_and_send_daily_signal(self, force_channel_id: Optional[int] = None) -> None:
        channel_id = force_channel_id if force_channel_id else self.signal_channel_id
        if not channel_id:
            logging.error("SIGNAL_CHANNEL_ID is not configured.")
            return
        channel = self.bot.get_channel(channel_id)
        if channel is None:
            logging.error("Channel id %s not found or bot lacks access.", channel_id)
            return

        MIN_SCORE_THRESHOLD = 3

        def normalize_candidate(raw: Dict[str, str]) -> Dict[str, str]:
            symbol = str(raw.get('symbol') or raw.get('price_symbol') or '').upper()
            display = str(raw.get('display') or symbol)
            price_symbol = str(raw.get('price_symbol') or symbol)
            ta_symbol = str(raw.get('ta_symbol') or symbol.replace('-', '')).upper()
            exchange = str(raw.get('exchange') or 'NASDAQ').upper()
            screener = (raw.get('screener') or 'america').lower()
            asset_type = (raw.get('asset_type') or 'equity').lower()
            return {
                'symbol': symbol,
                'display': display,
                'price_symbol': price_symbol,
                'ta_symbol': ta_symbol,
                'exchange': exchange,
                'screener': screener,
                'asset_type': asset_type,
            }

        def fmt_price(val: Optional[float]) -> str:
            if val is None:
                return "—"
            decimals = 2 if abs(val) >= 10 else 4
            return f"${val:,.{decimals}f}"

        def fmt_pct(val: Optional[float]) -> str:
            if val is None:
                return "—"
            sign = "+" if val >= 0 else ""
            return f"{sign}{val:.2f}%"

        valid_results: List[Tuple[Dict[str, str], int, Dict[str, str]]] = []

        stock_symbols = self.tickers_provider.penny_stocks(max_count=25)
        stock_candidates = [self.tickers_provider.resolve_symbol(sym) for sym in stock_symbols]
        crypto_candidates = self.tickers_provider.crypto_pairs(max_count=MAX_CRYPTO_CANDIDATES)

        unique_candidates: Dict[Tuple[str, str], Dict[str, str]] = {}
        for raw_candidate in stock_candidates + crypto_candidates:
            normalized = normalize_candidate(raw_candidate)
            if not normalized['symbol'] or not normalized['ta_symbol']:
                continue
            key = (normalized['symbol'], normalized['asset_type'])
            if key not in unique_candidates:
                unique_candidates[key] = normalized

        candidates = list(unique_candidates.values())
        if not candidates:
            await channel.send("No tickers available for analysis today.")
            return

        sem = asyncio.Semaphore(4)

        async def analyze_candidate(candidate: Dict[str, str]) -> Optional[Tuple[Dict[str, str], int, Dict[str, str]]]:
            try:
                async with sem:
                    # Fetch price data first for fallback TA if TradingView fails
                    price_ctx = None
                    try:
                        price_ctx = await fetch_price_context_smart(candidate['price_symbol'], asset_type=candidate.get('asset_type'))
                    except Exception:
                        pass  # Price fetch failure won't block TA analysis
                    
                    reco_map = await analyze_symbol_tradingview_with_retry(
                        candidate['ta_symbol'],
                        screener=candidate['screener'],
                        exchange=candidate['exchange'],
                        price_data=price_ctx,
                    )
                    if not reco_map:
                        return None
                    score = score_symbol(reco_map)
                    await asyncio.sleep(0.05)
                    return (candidate, score, reco_map)
            except CircuitBreakerError as exc:
                logging.error(f"Circuit breaker active during analysis: {exc}")
                return None
            except Exception as exc:
                logging.warning(f"Unexpected error analyzing {candidate['symbol']}: {exc}")
                return None

        analysis_results = await asyncio.gather(
            *[analyze_candidate(candidate) for candidate in candidates],
            return_exceptions=False,
        )
        valid_results = [res for res in analysis_results if res]

        if not valid_results:
            try:
                await channel.send("Couldn't generate a high conviction signal today.", allowed_mentions=AllowedMentions.none())
            except Forbidden:
                logging.warning(f"Missing permissions to post to channel {channel.id}")
            except Exception as e:
                logging.error(f"Failed to send no-signal message: {e}")
            return

        stock_results = [res for res in valid_results if res[0]['asset_type'] != 'crypto']
        crypto_results = [res for res in valid_results if res[0]['asset_type'] == 'crypto']

        selections: List[Tuple[Dict[str, str], int, Dict[str, str]]] = []
        if stock_results:
            best_stock = max(stock_results, key=lambda x: x[1])
            if best_stock[1] >= MIN_SCORE_THRESHOLD or not selections:
                selections.append(best_stock)
        if crypto_results:
            best_crypto = max(crypto_results, key=lambda x: x[1])
            if (best_crypto[1] >= MIN_SCORE_THRESHOLD or not selections) and all(best_crypto[0]['symbol'] != sel[0]['symbol'] for sel in selections):
                selections.append(best_crypto)
        if not selections:
            selections.append(max(valid_results, key=lambda x: x[1]))

        async def dispatch(candidate: Dict[str, str], score: int, reco_map: Dict[str, str]) -> None:
            # Deduplicate signals
            try:
                if self.db.has_recent_signal_any(candidate['symbol'], minutes=SIGNAL_DUPLICATE_WINDOW_MINUTES):
                    logging.info("Skipping duplicate signal for %s", candidate['symbol'])
                    return
            except Exception as dedup_err:
                logging.warning(
                    "Duplicate check failed for %s (%s). Skipping signal to avoid double-posting.",
                    candidate['symbol'],
                    dedup_err,
                )
                return

            # Price context - always try to fetch real data, even in test mode
            try:
                price_ctx = await fetch_price_context_smart(candidate['price_symbol'], asset_type=candidate.get('asset_type'))
                if not price_ctx:
                    logging.warning("No price context for %s; skipping signal.", candidate['display'])
                    return
            except CircuitBreakerError as exc:
                logging.error(f"Circuit breaker active during price fetch: {exc}")
                logging.warning("Data provider cooldown active; skipping public message and retrying later.")
                return

            logo_url = price_ctx.get("logo_url") if price_ctx else None
            company_name = price_ctx.get("company_name") if price_ctx else None
            price_value = safe_number(price_ctx.get("current_price"), digits=4)
            hod = safe_number(price_ctx.get("hod"), digits=4)
            r1 = safe_number(price_ctx.get("R1"), digits=4)
            r2 = safe_number(price_ctx.get("R2"), digits=4)
            s1 = safe_number(price_ctx.get("S1"), digits=4)
            s2 = safe_number(price_ctx.get("S2"), digits=4)
            pp = safe_number(price_ctx.get("PP"), digits=4)

            supports = [val for val in (s1, s2) if val is not None]
            entry_low = min(supports) if supports else None
            entry_high = max(supports) if supports else None
            entry_detail = None
            if entry_low is not None and entry_high is not None:
                entry_detail = {'low': entry_low, 'high': entry_high}

            ref_price = price_value if price_value not in (None, 0) else None
            target_entries: List[Dict[str, Optional[float]]] = []
            t1_pct = percent_change(r1, ref_price)
            if r1 is not None:
                target_entries.append({'label': 'Target 1', 'price': r1, 'pct': t1_pct})
            t2_pct = percent_change(r2, ref_price)
            if r2 is not None:
                target_entries.append({'label': 'Target 2', 'price': r2, 'pct': t2_pct})
            stop_pct = percent_change(s2, ref_price)
            stop_detail = {'price': s2, 'pct': stop_pct} if s2 is not None else None

            if score >= 8:
                signal_strength = "🟢 STRONG BUY"
            elif score >= 4:
                signal_strength = "🟡 BUY"
            elif score >= 1:
                signal_strength = "🟠 WATCH"
            else:
                signal_strength = "🔴 WEAK"

            confidence = compute_confidence(score)
            asset_label = "Crypto" if candidate['asset_type'] == 'crypto' else "Equity"
            chart_symbol = candidate['ta_symbol'] if candidate['asset_type'] == 'crypto' else candidate['symbol']
            chart_url = f"https://www.tradingview.com/symbols/{candidate['exchange']}-{chart_symbol}/"
            color = Color.from_rgb(88, 132, 255) if candidate['asset_type'] == 'crypto' else Color.from_rgb(210, 149, 68)
            signal_direction = 'BUY' if score >= 0 else 'SELL'
            direction_label = 'buy' if signal_direction == 'BUY' else 'sell'

            embed = Embed(
                title=f"🚨 DAILY SIGNAL • {candidate['display']}",
                color=color,
            )
            descriptor = company_name or candidate['display']
            embed.description = f"{descriptor} • {asset_label} • Score {score} • Confidence {confidence}"

            if logo_url:
                try:
                    embed.set_thumbnail(url=str(logo_url))
                except Exception as thumb_err:
                    logging.debug(f"Failed to set thumbnail for {candidate['symbol']}: {thumb_err}")

            embed.add_field(name="📊 Signal Strength", value=signal_strength, inline=True)
            embed.add_field(name="💰 Current Price", value=fmt_price(price_value), inline=True)
            embed.add_field(name="📈 Day's High", value=fmt_price(hod), inline=True)

            embed.add_field(
                name="🎯 Entry Zone",
                value=f"{fmt_price(entry_low)} → {fmt_price(entry_high)}" if entry_detail else "—",
                inline=True,
            )

            if target_entries:
                targets_text = "\n".join(
                    f"{target['label']}: {fmt_price(target['price'])} ({fmt_pct(target['pct'])})"
                    for target in target_entries
                )
                embed.add_field(name="🎯 Targets", value=targets_text, inline=True)
            else:
                embed.add_field(name="🎯 Targets", value="—", inline=True)

            if stop_detail:
                embed.add_field(
                    name="⛔ Stop Loss",
                    value=f"{fmt_price(stop_detail['price'])} ({fmt_pct(stop_detail['pct'])})",
                    inline=True,
                )
            else:
                embed.add_field(name="⛔ Stop Loss", value="—", inline=True)

            timeframes_text = "\n".join(
                f"**{tf.upper()}** · {reco_map.get(tf, 'N/A')}" for tf in ["5m", "15m", "1h", "1d"]
            )
            embed.add_field(name="🧭 Technical Snapshot", value=timeframes_text, inline=False)

            levels_lines: List[str] = []
            support_vals = [fmt_price(val) for val in (s1, s2) if val is not None]
            resistance_vals = [fmt_price(val) for val in (r1, r2) if val is not None]
            if support_vals:
                levels_lines.append(f"Supports: {', '.join(support_vals)}")
            if resistance_vals:
                levels_lines.append(f"Resistance: {', '.join(resistance_vals)}")
            if pp is not None:
                levels_lines.append(f"Pivot: {fmt_price(pp)}")
            if levels_lines:
                embed.add_field(name="📐 Key Levels", value="\n".join(levels_lines), inline=False)

            embed.add_field(name="📈 Live Chart", value=f"[View on TradingView]({chart_url})", inline=False)

            serializable_targets = [
                {k: v for k, v in target.items() if v is not None}
                for target in target_entries
                if target.get('price') is not None
            ]
            serializable_entry = None
            if entry_detail:
                serializable_entry = {k: v for k, v in entry_detail.items() if v is not None}
                if not serializable_entry:
                    serializable_entry = None
            serializable_stop = None
            if stop_detail:
                serializable_stop = {k: v for k, v in stop_detail.items() if v is not None}

            now_iso = dt.datetime.utcnow().isoformat()
            performance_snapshot = {
                'status': 'open',
                'direction': direction_label,
                'entryPrice': price_value,
                'createdAt': now_iso,
                'evaluatedAt': now_iso,
                'lastPrice': price_value,
                'maxGainPct': 0.0,
                'maxDrawdownPct': 0.0,
                'nextTargetPrice': serializable_targets[0]['price'] if serializable_targets else None,
                'nextTargetLabel': serializable_targets[0]['label'] if serializable_targets else None,
                'stopPrice': serializable_stop.get('price') if serializable_stop else None,
            }
            details_payload = {
                'displaySymbol': candidate['display'],
                'asset_type': candidate['asset_type'],
                'score': score,
                'signal_strength': signal_strength,
                'current_price': price_value,
                'hod': hod,
                'logo_url': logo_url,
                'company_name': company_name,
                'entry': serializable_entry,
                'targets': serializable_targets,
                'stop': serializable_stop,
                'pivot': pp,
                'timeframes': reco_map,
                'chart_url': chart_url,
                'confidence': confidence,
                'price_symbol': candidate['price_symbol'],
                'exchange': candidate['exchange'],
                'screener': candidate['screener'],
                'posted_at': dt.datetime.utcnow().isoformat(),
                'direction': direction_label,
                'performance': {k: v for k, v in performance_snapshot.items() if v is not None},
            }
            details = {k: v for k, v in details_payload.items() if v not in (None, [], {})}

            footer_text = "Not financial advice. Manage your risk."
            embed.set_footer(text=footer_text)
            embed_to_send = embed.copy()

            chart_input_symbol = candidate['price_symbol'] or candidate['symbol']
            chart_symbol = resolve_chart_symbol(
                chart_input_symbol,
                price_ctx,
                candidate.get('asset_type')
            )
            
            # Create role mentions for signal notification
            role_mentions = []
            if hasattr(self, 'elite_role_id') and self.elite_role_id:
                role_mentions.append(f"<@&{self.elite_role_id}>")
            if hasattr(self, 'pro_role_id') and self.pro_role_id:
                role_mentions.append(f"<@&{self.pro_role_id}>")
            if hasattr(self, 'core_role_id') and self.core_role_id:
                role_mentions.append(f"<@&{self.core_role_id}>")
            
            # Create allowed mentions with roles
            allowed_mentions = AllowedMentions(roles=True) if role_mentions else AllowedMentions.none()
            
            # Create message content with role mentions
            message_content = " ".join(role_mentions) if role_mentions else None
            
            message = None
            candle_chart_path = None
            try:
                if chart_symbol:
                    # Run chart generation in thread pool to prevent blocking async event loop
                    loop = asyncio.get_event_loop()
                    chart_attempt = 0
                    last_chart_error: Optional[Exception] = None
                    while chart_attempt < CHART_GENERATION_MAX_ATTEMPTS and not candle_chart_path:
                        chart_attempt += 1
                        try:
                            candle_chart_path = await loop.run_in_executor(
                                None, generate_signal_chart, chart_symbol, price_ctx
                            )
                            if candle_chart_path:
                                break
                            logging.warning(
                                "Chart generation returned no output for %s (attempt %s/%s).",
                                candidate['symbol'],
                                chart_attempt,
                                CHART_GENERATION_MAX_ATTEMPTS,
                            )
                        except Exception as chart_err:
                            last_chart_error = chart_err
                            logging.warning(
                                "Chart generation attempt %s/%s failed for %s: %s",
                                chart_attempt,
                                CHART_GENERATION_MAX_ATTEMPTS,
                                candidate['symbol'],
                                chart_err,
                            )
                            if chart_attempt >= CHART_GENERATION_MAX_ATTEMPTS:
                                raise
                        if (
                            not candle_chart_path
                            and chart_attempt < CHART_GENERATION_MAX_ATTEMPTS
                        ):
                            await asyncio.sleep(CHART_GENERATION_RETRY_DELAY_SECONDS)
                    if not candle_chart_path and last_chart_error:
                        raise last_chart_error
                else:
                    logging.warning(
                        "Skipping chart generation for %s: unable to resolve chart symbol from '%s'",
                        candidate['symbol'],
                        chart_input_symbol,
                    )
                
                # Prepare files list - ensure files exist and are readable
                files = []
                file_handles = []
                try:
                    # Verify and open candlestick chart - ensure file is complete and readable
                    if candle_chart_path and os.path.exists(candle_chart_path):
                        file_size = os.path.getsize(candle_chart_path)
                        if file_size > 1000:  # Ensure file is at least 1KB (valid PNG)
                            time.sleep(0.2)  # Wait for file to be fully written
                            # Double-check file is still valid
                            if os.path.exists(candle_chart_path) and os.path.getsize(candle_chart_path) == file_size:
                                try:
                                    fh = open(candle_chart_path, 'rb')
                                    # Test read to ensure file is readable
                                    test_byte = fh.read(1)
                                    if test_byte:
                                        fh.seek(0)
                                        file_handles.append(fh)
                                        files.append(File(fh, filename=f"{candidate['symbol']}_candle.png"))
                                    else:
                                        fh.close()
                                        logging.warning(f"Candlestick chart file {candle_chart_path} is empty")
                                except Exception as file_err:
                                    logging.warning(f"Failed to open candlestick chart file: {file_err}")
                    
                    if files:
                        message = await channel.send(
                            content=message_content,
                            embed=embed_to_send,
                            files=files,
                            allowed_mentions=allowed_mentions,
                            view=self.ChannelSignalActionsView(),
                        )
                finally:
                    # Close file handles after sending
                    for fh in file_handles:
                        try:
                            fh.close()
                        except:
                            pass
                
                if not files:
                    message = await channel.send(
                        content=message_content,
                        embed=embed_to_send,
                        allowed_mentions=allowed_mentions,
                        view=self.ChannelSignalActionsView(),
                    )
            except Forbidden as exc:
                logging.error(f"Missing permission to post signal in {channel.id}: {exc}")
                if candle_chart_path:
                    try:
                        os.remove(candle_chart_path)
                    except Exception:
                        pass
                return
            except Exception as exc:
                logging.warning(f"Failed to generate chart for {candidate['symbol']}: {exc}")
                if candle_chart_path:
                    try:
                        os.remove(candle_chart_path)
                    except Exception:
                        pass
                try:
                    message = await channel.send(
                        content=message_content,
                        embed=embed_to_send,
                        allowed_mentions=allowed_mentions,
                        view=self.ChannelSignalActionsView(),
                    )
                except Forbidden as exc2:
                    logging.error(f"Missing permission to post signal in {channel.id}: {exc2}")
                    return
                except Exception as send_err:
                    logging.error(f"Failed to send signal message for {candidate['symbol']}: {send_err}")
                    return
            finally:
                if candle_chart_path:
                    try:
                        os.remove(candle_chart_path)
                    except Exception:
                        pass

            if not message:
                logging.error(f"Failed to send signal message for {candidate['symbol']}")
                return

            signal_id = None
            embed_for_dm = embed_to_send.copy()

            try:
                signal_id = self.db.add_signal(
                    candidate['symbol'],
                    signal_direction,
                    float(price_value or 0.0),
                    json.dumps(reco_map),
                    display_symbol=candidate['display'],
                    signal_strength=signal_strength,
                    asset_type=candidate['asset_type'],
                    details=details,
                )
            except Exception as add_err:
                logging.error(f"Failed to persist signal for {candidate['symbol']}: {add_err}")
                signal_id = None

            if signal_id:
                try:
                    self.db.set_signal_message(signal_id, message.id, getattr(channel, 'id', None))
                except Exception as link_err:
                    logging.debug(f"Failed to record message id for signal {signal_id}: {link_err}")

                embed_for_dm.set_footer(text=f"{footer_text} • ID #{signal_id}")
                try:
                    await message.edit(embed=embed_for_dm)
                except Exception as edit_err:
                    logging.debug(f"Failed to edit signal message {signal_id}: {edit_err}")
                dm_source_embed = embed_for_dm
            else:
                logging.debug(f"Signal for {candidate['symbol']} dispatched to Discord without persistence.")
                dm_source_embed = embed_to_send

            # Notify subscribers only for real signals
            if signal_id:
                try:
                    subscriber_ids = self.db.get_symbol_subscribers(candidate['symbol'])
                    if subscriber_ids:
                        for uid in subscriber_ids:
                            try:
                                user = self.bot.get_user(uid) or await self.bot.fetch_user(uid)
                                if not user:
                                    continue
                                dm_embed = Embed(
                                    title=f"📬 New Signal: {candidate['display']}",
                                    description=f"Shared in <#{self.signal_channel_id}>",
                                    color=dm_source_embed.color,
                                )
                                for field in dm_source_embed.fields:
                                    dm_embed.add_field(name=field.name, value=field.value, inline=field.inline)
                                if dm_source_embed.footer:
                                    dm_embed.set_footer(text=dm_source_embed.footer.text)
                                await user.send(embed=dm_embed, view=self.DMSignalActionsView())
                            except Exception as dm_err:
                                logging.warning(f"Failed to DM subscriber {uid} for {candidate['symbol']}: {dm_err}")
                except Exception as sub_err:
                    logging.warning(f"Failed to DM subscribers for {candidate['symbol']}: {sub_err}")

        for candidate, score, reco_map in selections:
            await dispatch(candidate, score, reco_map)

    async def _notify_admin_signal_hit(self, signal_id: int, record: Dict[str, Any], performance: Dict[str, Any]) -> bool:
        """Send Discord webhook notification when a signal hits its target.
        
        Returns:
            bool: True if notification was sent successfully, False otherwise.
        """
        try:
            webhook_url = os.getenv('DISCORD_FEEDBACK_WEBHOOK')
            if not webhook_url:
                logging.warning("DISCORD_FEEDBACK_WEBHOOK not configured, skipping admin notification for signal %s", signal_id)
                return False

            symbol = str(record.get('symbol') or '').upper()
            display_symbol = str(record.get('display_symbol') or symbol)
            details_raw = record.get('details')
            details: Dict[str, Any]
            if isinstance(details_raw, str):
                try:
                    details = json.loads(details_raw)
                except Exception:
                    details = {}
            elif isinstance(details_raw, dict):
                details = dict(details_raw)
            else:
                details = {}

            entry_price = None
            try:
                entry_price = float(performance.get('entryPrice') or record.get('price') or details.get('current_price') or 0)
            except Exception:
                entry_price = 0

            target_price = None
            try:
                target_price = float(performance.get('targetPrice') or 0)
            except Exception:
                target_price = 0

            gain_pct = None
            try:
                gain_pct = float(performance.get('currentMovePct') or performance.get('maxGainPct') or 0)
            except Exception:
                gain_pct = 0

            time_to_hit = None
            try:
                time_to_hit = float(performance.get('timeToResolutionMinutes') or 0)
            except Exception:
                time_to_hit = 0

            max_gain_pct = None
            try:
                max_gain_pct = float(performance.get('maxGainPct') or gain_pct or 0)
            except Exception:
                max_gain_pct = gain_pct or 0

            target_label = str(performance.get('targetLabel') or 'Target 1')
            resolved_at = performance.get('resolvedAt') or dt.datetime.utcnow().isoformat()

            # Generate charts (use first available chart for admin notification)
            chart_path = None
            try:
                price_symbol = details.get('price_symbol') or details.get('priceSymbol') or symbol
                price_ctx = await fetch_price_context_smart(price_symbol)
                if price_ctx:
                    # Run chart generation in thread pool to prevent blocking
                    loop = asyncio.get_event_loop()
                    chart_symbol = resolve_chart_symbol(
                        price_symbol,
                        price_ctx,
                        details.get('asset_type') or record.get('asset_type')
                    )
                    if chart_symbol:
                        chart_path = await loop.run_in_executor(
                            None, generate_signal_chart, chart_symbol, price_ctx
                        )
            except Exception as chart_err:
                logging.warning(f"Failed to generate chart for admin notification: {chart_err}")
                chart_path = None

            embed = {
                "title": f"🎯 Signal Hit Target: {display_symbol}",
                "description": f"Signal **{display_symbol}** successfully reached {target_label}!",
                "color": 0x22C55E,
                "fields": [
                    {
                        "name": "📊 Performance",
                        "value": "\n".join([
                            f"**Entry:** ${entry_price:.2f}",
                            f"**Target Hit:** {target_label} (${target_price:.2f})",
                            f"**Gain:** +{gain_pct:.2f}%",
                            f"**Max Gain:** +{max_gain_pct:.2f}%",
                        ]),
                        "inline": True,
                    },
                    {
                        "name": "⏱️ Timing",
                        "value": "\n".join([
                            f"**Time to Target:** {time_to_hit:.1f} minutes",
                            f"**Resolved:** {resolved_at}",
                            f"**Signal ID:** #{signal_id}",
                        ]),
                        "inline": True,
                    },
                    {
                        "name": "📈 Signal Details",
                        "value": "\n".join([
                            f"**Type:** {str(record.get('signal_type') or 'BUY').upper()}",
                            f"**Strength:** {record.get('signal_strength') or 'N/A'}",
                            f"**Asset:** {str(record.get('asset_type') or 'equity').title()}",
                        ]),
                        "inline": False,
                    },
                ],
                "timestamp": resolved_at,
                "footer": {
                    "text": "Jack Of All Signals • Target Hit Notification",
                },
            }

            payload = {"embeds": [embed]}

            if chart_path and os.path.exists(chart_path):
                try:
                    with open(chart_path, 'rb') as fp:
                        files = {'file': (f"{symbol}_target_hit.png", fp, 'image/png')}
                        data = {
                            'payload_json': json.dumps(payload),
                        }
                        response = requests.post(webhook_url, data=data, files=files, timeout=10)
                        response.raise_for_status()
                        logging.info("Admin notification sent for signal %s (with chart) - Status: %s", signal_id, response.status_code)
                        return True
                except Exception as post_err:
                    logging.warning(f"Failed to send chart with admin notification for signal {signal_id}: {post_err}", exc_info=True)
                    try:
                        resp = requests.post(webhook_url, json=payload, timeout=10)
                        resp.raise_for_status()
                        logging.info("Admin notification sent for signal %s (no chart) - Status: %s", signal_id, resp.status_code)
                        return True
                    except Exception as fallback_err:
                        logging.error(f"Failed to send admin notification (no chart) for signal {signal_id}: {fallback_err}", exc_info=True)
                        return False
            else:
                try:
                    resp = requests.post(webhook_url, json=payload, timeout=10)
                    resp.raise_for_status()
                    logging.info("Admin notification sent for signal %s - Status: %s", signal_id, resp.status_code)
                    return True
                except Exception as fallback_err:
                    logging.error(f"Failed to send admin notification for signal {signal_id}: {fallback_err}", exc_info=True)
                    return False

            if chart_path and os.path.exists(chart_path):
                try:
                    os.remove(chart_path)
                except Exception:
                    pass

        except Exception as err:
            logging.error(f"Failed to notify admins about signal {signal_id}: {err}", exc_info=True)
            return False

    @tasks.loop(time=ADMIN_NOTIFY_RUN_TIMES)
    async def admin_signal_notify_task(self) -> None:
        try:
            pending = self.db.get_signals_pending_admin_notify(limit=25)
            if not pending:
                return
            for record in pending:
                try:
                    details = record.get('details') or {}
                    if isinstance(details, str):
                        try:
                            details = json.loads(details)
                            record['details'] = details
                        except Exception:
                            details = {}
                            record['details'] = details
                    performance = details.get('performance') or {}
                    admin_meta = details.get('admin_notify') or {}
                    resolved_at = admin_meta.get('lastResolvedAt') or performance.get('resolvedAt') or record.get('timestamp')
                    perf_payload = dict(performance)
                    if resolved_at and 'resolvedAt' not in perf_payload:
                        if isinstance(resolved_at, dt.datetime):
                            perf_payload['resolvedAt'] = resolved_at.isoformat()
                        else:
                            perf_payload['resolvedAt'] = str(resolved_at)
                    perf_payload.setdefault('status', 'target_hit')
                    success = await self._notify_admin_signal_hit(record['id'], record, perf_payload)
                    if success:
                        self.db.mark_admin_notified(record['id'])
                    else:
                        logging.warning(f"Admin notification failed for signal {record.get('id')}, not marking as notified")
                except Exception as rec_err:
                    logging.warning(f"Failed to send admin notification for signal {record.get('id')}: {rec_err}", exc_info=True)
        except Exception as err:
            logging.error("Admin signal notify task failed: %s", err, exc_info=True)

    async def _cleanup_old_charts(self) -> None:
        """Helper method to clean up old chart files from the charts/ directory."""
        try:
            charts_dir = 'charts'
            if not os.path.exists(charts_dir):
                logging.debug(f"Charts directory {charts_dir} does not exist, skipping cleanup")
                return
            
            # Delete files older than 7 days
            cutoff_time = time.time() - (7 * 24 * 60 * 60)  # 7 days in seconds
            deleted_count = 0
            total_size_freed = 0
            
            try:
                for filename in os.listdir(charts_dir):
                    file_path = os.path.join(charts_dir, filename)
                    try:
                        # Only process files (not directories)
                        if not os.path.isfile(file_path):
                            continue
                        
                        # Check file modification time
                        file_mtime = os.path.getmtime(file_path)
                        if file_mtime < cutoff_time:
                            file_size = os.path.getsize(file_path)
                            os.remove(file_path)
                            deleted_count += 1
                            total_size_freed += file_size
                            logging.debug(f"Deleted old chart file: {filename} ({file_size} bytes)")
                    except OSError as file_err:
                        logging.warning(f"Failed to delete chart file {filename}: {file_err}")
                        continue
                
                if deleted_count > 0:
                    logging.info(f"Chart cleanup completed: deleted {deleted_count} file(s), freed {total_size_freed / (1024 * 1024):.2f} MB")
                else:
                    logging.debug("Chart cleanup: no old files found to delete")
            except OSError as dir_err:
                logging.warning(f"Error accessing charts directory during cleanup: {dir_err}")
        except Exception as err:
            logging.error(f"Chart cleanup failed: {err}", exc_info=True)

    @tasks.loop(hours=24)
    async def chart_cleanup_task(self) -> None:
        """Periodically clean up old chart files from the charts/ directory."""
        await self._cleanup_old_charts()


def main() -> None:
    token = Secret.token or os.getenv("DISCORD_TOKEN")
    if not token:
        raise RuntimeError("Discord token is not set. Define DISCORD_TOKEN in your environment or .env file.")

    bot = JackOfAllSignalsBot()
    bot.bot.run(token)



if __name__ == "__main__":
    main()
