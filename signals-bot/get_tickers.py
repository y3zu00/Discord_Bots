import logging
from typing import Dict, List

from bs4 import BeautifulSoup
from urllib.request import Request, urlopen


CRYPTO_CANDIDATES: List[Dict[str, str]] = [
    {
        "symbol": "BTC-USD",
        "display": "BTC / USD",
        "price_symbol": "BTC-USD",
        "ta_symbol": "BTCUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "BTC",
        "quote": "USD",
    },
    {
        "symbol": "ETH-USD",
        "display": "ETH / USD",
        "price_symbol": "ETH-USD",
        "ta_symbol": "ETHUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "ETH",
        "quote": "USD",
    },
    {
        "symbol": "SOL-USD",
        "display": "SOL / USD",
        "price_symbol": "SOL-USD",
        "ta_symbol": "SOLUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "SOL",
        "quote": "USD",
    },
    {
        "symbol": "BNB-USD",
        "display": "BNB / USD",
        "price_symbol": "BNB-USD",
        "ta_symbol": "BNBUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "BNB",
        "quote": "USD",
    },
    {
        "symbol": "AVAX-USD",
        "display": "AVAX / USD",
        "price_symbol": "AVAX-USD",
        "ta_symbol": "AVAXUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "AVAX",
        "quote": "USD",
    },
    {
        "symbol": "LINK-USD",
        "display": "LINK / USD",
        "price_symbol": "LINK-USD",
        "ta_symbol": "LINKUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "LINK",
        "quote": "USD",
    },
    {
        "symbol": "DOT-USD",
        "display": "DOT / USD",
        "price_symbol": "DOT-USD",
        "ta_symbol": "DOTUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "DOT",
        "quote": "USD",
    },
    {
        "symbol": "XRP-USD",
        "display": "XRP / USD",
        "price_symbol": "XRP-USD",
        "ta_symbol": "XRPUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "XRP",
        "quote": "USD",
    },
    {
        "symbol": "ADA-USD",
        "display": "ADA / USD",
        "price_symbol": "ADA-USD",
        "ta_symbol": "ADAUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "ADA",
        "quote": "USD",
    },
    {
        "symbol": "DOGE-USD",
        "display": "DOGE / USD",
        "price_symbol": "DOGE-USD",
        "ta_symbol": "DOGEUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "DOGE",
        "quote": "USD",
    },
    {
        "symbol": "MATIC-USD",
        "display": "MATIC / USD",
        "price_symbol": "MATIC-USD",
        "ta_symbol": "MATICUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "MATIC",
        "quote": "USD",
    },
    {
        "symbol": "ATOM-USD",
        "display": "ATOM / USD",
        "price_symbol": "ATOM-USD",
        "ta_symbol": "ATOMUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "ATOM",
        "quote": "USD",
    },
    {
        "symbol": "LTC-USD",
        "display": "LTC / USD",
        "price_symbol": "LTC-USD",
        "ta_symbol": "LTCUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "LTC",
        "quote": "USD",
    },
    {
        "symbol": "SHIB-USD",
        "display": "SHIB / USD",
        "price_symbol": "SHIB-USD",
        "ta_symbol": "SHIBUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "SHIB",
        "quote": "USD",
    },
    {
        "symbol": "TRX-USD",
        "display": "TRX / USD",
        "price_symbol": "TRX-USD",
        "ta_symbol": "TRXUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "TRX",
        "quote": "USD",
    },
    {
        "symbol": "TON-USD",
        "display": "TON / USD",
        "price_symbol": "TON-USD",
        "ta_symbol": "TONUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "TON",
        "quote": "USD",
    },
    {
        "symbol": "APT-USD",
        "display": "APT / USD",
        "price_symbol": "APT-USD",
        "ta_symbol": "APTUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "APT",
        "quote": "USD",
    },
    {
        "symbol": "ARB-USD",
        "display": "ARB / USD",
        "price_symbol": "ARB-USD",
        "ta_symbol": "ARBUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "ARB",
        "quote": "USD",
    },
    {
        "symbol": "OP-USD",
        "display": "OP / USD",
        "price_symbol": "OP-USD",
        "ta_symbol": "OPUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "OP",
        "quote": "USD",
    },
    {
        "symbol": "SUI-USD",
        "display": "SUI / USD",
        "price_symbol": "SUI-USD",
        "ta_symbol": "SUIUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "SUI",
        "quote": "USD",
    },
    {
        "symbol": "NEAR-USD",
        "display": "NEAR / USD",
        "price_symbol": "NEAR-USD",
        "ta_symbol": "NEARUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "NEAR",
        "quote": "USD",
    },
    {
        "symbol": "ALGO-USD",
        "display": "ALGO / USD",
        "price_symbol": "ALGO-USD",
        "ta_symbol": "ALGOUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "ALGO",
        "quote": "USD",
    },
    {
        "symbol": "FIL-USD",
        "display": "FIL / USD",
        "price_symbol": "FIL-USD",
        "ta_symbol": "FILUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "FIL",
        "quote": "USD",
    },
    {
        "symbol": "INJ-USD",
        "display": "INJ / USD",
        "price_symbol": "INJ-USD",
        "ta_symbol": "INJUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "INJ",
        "quote": "USD",
    },
    {
        "symbol": "RUNE-USD",
        "display": "RUNE / USD",
        "price_symbol": "RUNE-USD",
        "ta_symbol": "RUNEUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "RUNE",
        "quote": "USD",
    },
    {
        "symbol": "AAVE-USD",
        "display": "AAVE / USD",
        "price_symbol": "AAVE-USD",
        "ta_symbol": "AAVEUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "AAVE",
        "quote": "USD",
    },
    {
        "symbol": "UNI-USD",
        "display": "UNI / USD",
        "price_symbol": "UNI-USD",
        "ta_symbol": "UNIUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "UNI",
        "quote": "USD",
    },
    {
        "symbol": "MKR-USD",
        "display": "MKR / USD",
        "price_symbol": "MKR-USD",
        "ta_symbol": "MKRUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "MKR",
        "quote": "USD",
    },
    {
        "symbol": "COMP-USD",
        "display": "COMP / USD",
        "price_symbol": "COMP-USD",
        "ta_symbol": "COMPUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "COMP",
        "quote": "USD",
    },
    {
        "symbol": "STX-USD",
        "display": "STX / USD",
        "price_symbol": "STX-USD",
        "ta_symbol": "STXUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "STX",
        "quote": "USD",
    },
    {
        "symbol": "SEI-USD",
        "display": "SEI / USD",
        "price_symbol": "SEI-USD",
        "ta_symbol": "SEIUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "SEI",
        "quote": "USD",
    },
    {
        "symbol": "PYTH-USD",
        "display": "PYTH / USD",
        "price_symbol": "PYTH-USD",
        "ta_symbol": "PYTHUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "PYTH",
        "quote": "USD",
    },
    {
        "symbol": "IMX-USD",
        "display": "IMX / USD",
        "price_symbol": "IMX-USD",
        "ta_symbol": "IMXUSDT",
        "exchange": "BINANCE",
        "screener": "crypto",
        "asset_type": "crypto",
        "base": "IMX",
        "quote": "USD",
    },
]


def _guess_exchange(symbol: str) -> str:
    symbol = symbol.upper()
    nasdaq_popular = {
        "AAPL", "MSFT", "NVDA", "AMD", "TSLA", "AMZN", "META", "NFLX", "INTC", "GOOG", "GOOGL",
    }
    nyse_popular = {
        "SPY", "QQQ", "BA", "KO", "DIS", "NKE", "JPM", "V", "MA", "MCD",
    }
    if symbol in nasdaq_popular:
        return "NASDAQ"
    if symbol in nyse_popular:
        return "NYSE"
    # Default to NASDAQ for US equities
    return "NASDAQ"


class Get_Tickers:
    def __init__(self) -> None:
        self.source_url = "https://penny-stocks.co/gainers/"

    def penny_stocks(self, max_count: int = 20) -> List[str]:
        """Scrape a list of recent penny stock gainers.

        Falls back to a small static list if scraping fails.
        """
        try:
            request = Request(self.source_url, headers={"User-Agent": "Mozilla/5.0"})
            with urlopen(request, timeout=15) as response:
                html = response.read()
            soup = BeautifulSoup(html, "html.parser")

            table = soup.find("table")
            if table is None:
                raise RuntimeError("Could not find gainers table")

            tickers: List[str] = []
            for row in table.find_all("tr"):
                cells = row.find_all("td")
                if not cells:
                    continue
                symbol = cells[0].get_text(strip=True)
                if symbol and symbol.isupper() and symbol.isalpha():
                    tickers.append(symbol)
                if len(tickers) >= max_count:
                    break

            if not tickers:
                raise RuntimeError("No tickers parsed from table")

            return tickers

        except Exception as exc:
            logging.warning("Falling back to default tickers due to error: %s", exc)
            return [
                # Reasonable defaults for testing
                "AAPL",
                "TSLA",
                "NVDA",
                "AMD",
                "MSFT",
                "AMZN",
            ][:max_count]

    def crypto_pairs(self, max_count: int = 24) -> List[Dict[str, str]]:
        """Return a curated list of liquid crypto pairs."""
        return CRYPTO_CANDIDATES[:max_count]

    def resolve_symbol(self, symbol: str) -> Dict[str, str]:
        """Resolve a symbol into metadata for analysis and pricing."""

        if not symbol:
            raise ValueError("symbol is required")

        upper = symbol.upper().strip()
        normalized = upper.replace("/", "-")

        # First, check curated crypto list
        for candidate in CRYPTO_CANDIDATES:
            aliases = {
                candidate["symbol"].upper(),
                candidate["price_symbol"].upper(),
                candidate.get("ta_symbol", "").upper(),
                candidate.get("base", "").upper(),
            }
            if normalized in aliases or upper in aliases:
                return {**candidate}

        # Default to US equities assumption
        return {
            "symbol": normalized,
            "display": upper,
            "price_symbol": normalized,
            "ta_symbol": normalized,
            "exchange": _guess_exchange(normalized),
            "screener": "america",
            "asset_type": "equity",
        }


