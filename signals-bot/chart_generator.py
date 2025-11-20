import matplotlib
matplotlib.use('Agg')  # Use non-GUI backend to prevent thread warnings
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.offsetbox import OffsetImage, AnnotationBbox
from PIL import Image
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import numpy as np
import os

# Try to import mplfinance for candlestick charts
try:
    import mplfinance as mpf
    MPLFINANCE_AVAILABLE = True
except ImportError:
    MPLFINANCE_AVAILABLE = False

def generate_stock_chart(symbol: str, days: int = 30) -> str:
    """
    Generate a stock chart image and return the file path.
    
    Args:
        symbol: Stock symbol
        days: Number of days to show in the chart
        
    Returns:
        File path to the generated chart image
    """
    try:
        # Get stock data
        ticker = yf.Ticker(symbol)
        data = ticker.history(period=f"{days}d")
        
        if data.empty:
            return None
        
        # Create the chart
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8), gridspec_kw={'height_ratios': [3, 1]})
        
        # Price chart
        ax1.plot(data.index, data['Close'], label='Close Price', color='#d29544', linewidth=2)
        ax1.plot(data.index, data['High'], label='High', color='#2ecc71', alpha=0.7, linewidth=1)
        ax1.plot(data.index, data['Low'], label='Low', color='#e74c3c', alpha=0.7, linewidth=1)
        
        # Fill between high and low
        ax1.fill_between(data.index, data['High'], data['Low'], alpha=0.1, color='#d29544')
        
        # Volume chart
        ax2.bar(data.index, data['Volume'], color='#d29544', alpha=0.7)
        
        # Customize the chart
        ax1.set_title(f'{symbol} - {days} Day Price Chart', fontsize=16, fontweight='bold', color='#d29544')
        ax1.set_ylabel('Price ($)', fontsize=12)
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        ax2.set_title('Volume', fontsize=12, fontweight='bold', color='#d29544')
        ax2.set_ylabel('Volume', fontsize=12)
        ax2.set_xlabel('Date', fontsize=12)
        ax2.grid(True, alpha=0.3)
        
        # Format x-axis dates
        for ax in [ax1, ax2]:
            ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d'))
            ax.xaxis.set_major_locator(mdates.DayLocator(interval=max(1, days//7)))
            plt.setp(ax.xaxis.get_majorticklabels(), rotation=45)
        
        # Add current price annotation
        current_price = data['Close'].iloc[-1]
        ax1.axhline(y=current_price, color='#d29544', linestyle='--', alpha=0.7, label=f'Current: ${current_price:.2f}')
        
        # Tight layout and save
        plt.tight_layout()
        
        # Create charts directory if it doesn't exist
        os.makedirs('charts', exist_ok=True)
        
        # Save the chart
        chart_path = f'charts/{symbol}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png'
        plt.savefig(chart_path, dpi=300, bbox_inches='tight', facecolor='white')
        plt.close()
        
        return chart_path
        
    except Exception as e:
        print(f"Error generating chart for {symbol}: {e}")
        return None

def generate_signal_chart(symbol: str, price_data: dict) -> str:
    """
    Generate a single, high-detail candlestick chart for the trading signal.
    
    Args:
        symbol: Stock or crypto symbol
        price_data: Dictionary containing price and pivot data
        
    Returns:
        Path to the generated candlestick chart (or None if generation fails)
    """
    # Create charts directory if it doesn't exist
    os.makedirs('charts', exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    candle_chart_path = f'charts/{symbol}_candle_{timestamp}.png'
    
    candle_path = None
    
    try:
        if not MPLFINANCE_AVAILABLE:
            print("mplfinance is required for candlestick chart generation but is not available.")
            return None
        
        ticker = yf.Ticker(symbol)
        
        # Request an extended window of data for richer context
        candle_data = ticker.history(period="180d", interval="1d")
        
        # Fallback: if yfinance returns limited data (e.g., new IPO), try a shorter window
        if candle_data.empty or len(candle_data) < 30:
            candle_data = ticker.history(period="90d", interval="1d")
        
        if candle_data.empty or len(candle_data) < 5:
            print(f"No usable candlestick data returned for {symbol}")
            return None
        
        # Generate detailed candlestick chart
        candle_path = _generate_candlestick_chart_dark(symbol, candle_data, price_data, candle_chart_path)
    except Exception as e:
        print(f"Error generating candlestick chart for {symbol}: {e}")
    
    return candle_path

def _generate_line_chart_dark(symbol: str, data: pd.DataFrame, price_data: dict, chart_path: str) -> str:
    """Generate enhanced line chart with dark theme, branding, and better detail."""
    try:
        # Dark theme colors
        bg_color = '#1a1a1a'
        text_color = '#ffffff'
        grid_color = '#333333'
        
        # Create figure with optimized size for faster rendering
        fig, ax = plt.subplots(figsize=(12, 7), facecolor=bg_color, dpi=100)
        ax.set_facecolor(bg_color)
        
        # Plot price data - clean and organized (no fill to avoid messiness)
        ax.plot(data.index, data['Close'], label='Close Price', color='#d29544', linewidth=2.5, zorder=5)
        # Remove high/low lines to reduce clutter - only show close price and support/resistance
        
        # Extract support/resistance levels
        current_price = price_data.get('current_price', 0)
        r1 = price_data.get('R1', 0)
        r2 = price_data.get('R2', 0)
        s1 = price_data.get('S1', 0)
        s2 = price_data.get('S2', 0)
        
        # Add support and resistance levels - lines first (lower zorder), then labels on top (higher zorder)
        if r1 > 0:
            ax.axhline(y=r1, color='#ff4444', linestyle='--', alpha=0.7, linewidth=2.0, label=f'R1: ${r1:.2f}', zorder=2)
            # Position label ABOVE the line on RIGHT side to avoid legend blocking
            ax.text(data.index[-1], r1, f'R1 ${r1:.2f}', color='#ff4444', fontsize=10, 
                   verticalalignment='bottom', fontweight='bold', horizontalalignment='right',
                   bbox=dict(boxstyle='round,pad=0.3', facecolor='#1a1a1a', alpha=0.95, edgecolor='#ff4444', linewidth=1.5),
                   zorder=10)  # High zorder to appear above line
        if r2 > 0:
            ax.axhline(y=r2, color='#ff6666', linestyle=':', alpha=0.6, linewidth=2.0, label=f'R2 ${r2:.2f}', zorder=2)
            # Position label ABOVE the line on RIGHT side to avoid legend blocking
            ax.text(data.index[-1], r2, f'R2 ${r2:.2f}', color='#ff6666', fontsize=10, 
                   verticalalignment='bottom', fontweight='bold', horizontalalignment='right',
                   bbox=dict(boxstyle='round,pad=0.3', facecolor='#1a1a1a', alpha=0.95, edgecolor='#ff6666', linewidth=1.5),
                   zorder=10)
        if s1 > 0:
            ax.axhline(y=s1, color='#44ff44', linestyle='--', alpha=0.7, linewidth=2.0, label=f'S1: ${s1:.2f}', zorder=2)
            # Position label BELOW the line so it's visible
            ax.text(data.index[0], s1, f'S1 ${s1:.2f}', color='#44ff44', fontsize=10, 
                   verticalalignment='top', fontweight='bold', horizontalalignment='left',
                   bbox=dict(boxstyle='round,pad=0.3', facecolor='#1a1a1a', alpha=0.95, edgecolor='#44ff44', linewidth=1.5),
                   zorder=10)
        if s2 > 0:
            ax.axhline(y=s2, color='#66ff66', linestyle=':', alpha=0.6, linewidth=2.0, label=f'S2: ${s2:.2f}', zorder=2)
            # Position label BELOW the line so it's visible
            ax.text(data.index[0], s2, f'S2 ${s2:.2f}', color='#66ff66', fontsize=10, 
                   verticalalignment='top', fontweight='bold', horizontalalignment='left',
                   bbox=dict(boxstyle='round,pad=0.3', facecolor='#1a1a1a', alpha=0.95, edgecolor='#66ff66', linewidth=1.5),
                   zorder=10)
        
        # Add current price line with annotation - label ABOVE line so it's visible
        if current_price > 0:
            ax.axhline(y=current_price, color='#d29544', linestyle='-', alpha=0.8, linewidth=2.5, label=f'Current: ${current_price:.2f}', zorder=3)
            # Position current price label ABOVE the line on right side
            ax.text(data.index[-1], current_price, f'Current ${current_price:.2f}', color='#d29544', fontsize=11, 
                   verticalalignment='bottom', fontweight='bold', horizontalalignment='right',
                   bbox=dict(boxstyle='round,pad=0.4', facecolor='#1a1a1a', alpha=0.95, edgecolor='#d29544', linewidth=2.0),
                   zorder=10)  # High zorder to appear above line
        
        # Remove price annotations at key points to reduce clutter - keep chart clean
        
        # Clean title - logo and branding will be added separately
        ax.set_title(f'{symbol} - Signal Analysis', fontsize=16, fontweight='bold', color=text_color, pad=15)
        ax.set_ylabel('Price ($)', fontsize=12, color=text_color, fontweight='bold')
        ax.set_xlabel('Date', fontsize=12, color=text_color, fontweight='bold')
        
        # Clean, organized legend - positioned lower to avoid blocking labels
        # Draw legend AFTER all lines so it appears on top, but position it lower
        legend = ax.legend(loc='upper left', bbox_to_anchor=(0.02, 0.98), 
                          facecolor=bg_color, edgecolor=grid_color, 
                          labelcolor=text_color, framealpha=0.95, fontsize=8, 
                          fancybox=False, shadow=False, frameon=True, borderpad=0.5,
                          handlelength=1.5, handletextpad=0.5, columnspacing=0.8,
                          ncol=1)  # Single column to reduce width
        legend.get_frame().set_facecolor(bg_color)
        legend.get_frame().set_edgecolor(grid_color)
        legend.get_frame().set_linewidth(1.5)
        legend.set_zorder(20)  # Very high zorder so legend appears above everything
        
        # Enhanced grid
        ax.grid(True, alpha=0.25, color=grid_color, linestyle='-', linewidth=0.8, zorder=0)
        ax.set_axisbelow(True)
        
        # Dark theme axes
        ax.spines['bottom'].set_color(grid_color)
        ax.spines['top'].set_color(grid_color)
        ax.spines['right'].set_color(grid_color)
        ax.spines['left'].set_color(grid_color)
        ax.tick_params(colors=text_color, which='both', labelsize=10)
        
        # Format x-axis dates
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d'))
        ax.xaxis.set_major_locator(mdates.DayLocator(interval=1))
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, color=text_color, fontsize=10)
        
        # Add logo and branding - logo on left side of "Jack Of All Trades" text to save space
        try:
            logo_path = os.path.join(os.path.dirname(__file__), 'assets', 'joat-logo-nobg.png')
            if os.path.exists(logo_path):
                logo_img = Image.open(logo_path)
                # Make logo small and compact for inline placement
                target_height_px = 80
                aspect_ratio = logo_img.width / logo_img.height
                target_width_px = int(target_height_px * aspect_ratio)
                
                # Resize logo to compact size
                logo_img = logo_img.resize((target_width_px, target_height_px), Image.Resampling.LANCZOS)
                
                # Place logo on left side of "Jack Of All Trades" text (inline)
                # Position: top right, logo first, then text - center align both
                imagebox = OffsetImage(logo_img, zoom=0.12)
                # Logo at x=0.88, y=0.96 - center aligned vertically
                ab = AnnotationBbox(imagebox, (0.88, 0.96), 
                                   xycoords='figure fraction',
                                   box_alignment=(0, 0.5),  # Center align vertically (0.5 = middle)
                                   bboxprops=dict(edgecolor='none', facecolor='none'),
                                   zorder=100)
                fig.add_artist(ab)
                
                # Add "Jack Of All Trades" text right next to logo (inline) - center aligned
                fig.text(0.90, 0.96, 'Jack Of All Trades', 
                       fontsize=10, color='#d29544', fontweight='bold',
                       horizontalalignment='left', verticalalignment='center',  # Center align
                       zorder=100)
        except Exception as logo_err:
            print(f"Could not add logo to line chart: {logo_err}")
        
        # Tight layout and save with highly optimized settings
        plt.tight_layout()
        plt.savefig(chart_path, dpi=150, bbox_inches='tight', facecolor=bg_color, 
                   edgecolor='none', pad_inches=0.1, format='png', metadata=None)
        plt.close('all')  # Close all figures to free memory
        
        # Force flush to ensure file is fully written to disk
        import sys
        sys.stdout.flush()
        
        # Small delay to ensure file system has written the file
        import time
        time.sleep(0.1)
        
        # Force garbage collection to free memory immediately
        try:
            import gc
            gc.collect()
        except:
            pass
        
        # Verify file exists, is readable, and has valid size before returning
        if os.path.exists(chart_path):
            file_size = os.path.getsize(chart_path)
            if file_size > 1000:  # Ensure file is at least 1KB (valid PNG)
                return chart_path
            else:
                print(f"Warning: Chart file {chart_path} is too small ({file_size} bytes)")
        else:
            print(f"Warning: Chart file {chart_path} was not created")
        return None
    except Exception as e:
        print(f"Error generating dark line chart for {symbol}: {e}")
        return None

def _generate_candlestick_chart_dark(symbol: str, data: pd.DataFrame, price_data: dict, chart_path: str) -> str:
    """Generate enhanced candlestick chart with dark theme, better clarity, and branding."""
    try:
        # Ensure we have enough data for clear candles
        if len(data) < 5:
            return None
        
        # Focus on the most recent data - use 60 days for clear candlestick visibility
        max_points = 60
        data = data.tail(max_points).copy()
        
        plot_data = data.copy()
        date_nums = mdates.date2num(plot_data.index.to_pydatetime()) if len(plot_data.index) > 0 else []
        
        # Prepare data for mplfinance (needs OHLC format)
        required_cols = ['Open', 'High', 'Low', 'Close']
        for col in required_cols:
            if col not in plot_data.columns:
                if col == 'Open':
                    plot_data['Open'] = plot_data['Close'].shift(1).fillna(plot_data['Close'])
                else:
                    plot_data[col] = plot_data['Close']
        
        # Ensure data is properly formatted
        if not isinstance(plot_data.index, pd.DatetimeIndex):
            try:
                plot_data.index = pd.to_datetime(plot_data.index)
            except:
                pass
        
        # Compute moving averages for trend clarity
        plot_data['EMA20'] = plot_data['Close'].ewm(span=20, adjust=False).mean()
        plot_data['EMA50'] = plot_data['Close'].ewm(span=50, adjust=False).mean()
        plot_data['EMA200'] = plot_data['Close'].ewm(span=200, adjust=False).mean()
        
        # Compute RSI for momentum panel (if enough data)
        rsi_series = None
        if len(plot_data) >= 15:
            delta = plot_data['Close'].diff()
            gain = delta.clip(lower=0)
            loss = -delta.clip(upper=0)
            avg_gain = gain.ewm(alpha=1/14, adjust=False).mean()
            avg_loss = loss.ewm(alpha=1/14, adjust=False).mean()
            # Prevent division by zero
            rs = avg_gain / avg_loss.replace(to_replace=0, value=1e-10)
            rsi_series = 100 - (100 / (1 + rs))
            plot_data['RSI'] = rsi_series
        
        # Extract support/resistance levels
        current_price = price_data.get('current_price', 0)
        r1 = price_data.get('R1', 0)
        r2 = price_data.get('R2', 0)
        s1 = price_data.get('S1', 0)
        s2 = price_data.get('S2', 0)
        # Prepare additional plots for enhanced detail
        addplot = []
        
        # Moving averages for trend clarity
        ema_configs = [
            ('EMA20', '#f1c40f', 1.8, 'EMA 20'),
            ('EMA50', '#3498db', 1.7, 'EMA 50'),
            ('EMA200', '#9b59b6', 1.7, 'EMA 200'),
        ]
        for column, color, width, label in ema_configs:
            if column in plot_data.columns and plot_data[column].notna().sum() > 0:
                addplot.append(
                    mpf.make_addplot(
                        plot_data[column],
                        color=color,
                        width=width,
                        linestyle='-',
                        alpha=0.95,
                        label=label
                    )
                )
        
        # Support/resistance and current price levels (horizontal guides)
        if len(plot_data) > 0:
            idx = plot_data.index
            if r1 > 0:
                addplot.append(
                    mpf.make_addplot(
                        pd.Series(r1, index=idx),
                        color='#ff6b6b',
                        width=2.3,
                        linestyle='--',
                        alpha=0.9,
                        label=f'R1 ${r1:.2f}'
                    )
                )
            if r2 > 0:
                addplot.append(
                    mpf.make_addplot(
                        pd.Series(r2, index=idx),
                        color='#ff8787',
                        width=2.0,
                        linestyle=':',
                        alpha=0.85,
                        label=f'R2 ${r2:.2f}'
                    )
                )
            if s1 > 0:
                addplot.append(
                    mpf.make_addplot(
                        pd.Series(s1, index=idx),
                        color='#2ecc71',
                        width=2.3,
                        linestyle='--',
                        alpha=0.9,
                        label=f'S1 ${s1:.2f}'
                    )
                )
            if s2 > 0:
                addplot.append(
                    mpf.make_addplot(
                        pd.Series(s2, index=idx),
                        color='#58d68d',
                        width=2.0,
                        linestyle=':',
                        alpha=0.85,
                        label=f'S2 ${s2:.2f}'
                    )
                )
            if current_price > 0:
                addplot.append(
                    mpf.make_addplot(
                        pd.Series(current_price, index=idx),
                        color='#d29544',
                        width=3.0,
                        linestyle='-',
                        alpha=0.9,
                        label=f'Current ${current_price:.2f}'
                    )
                )
        
        # Determine additional panels (volume, RSI)
        # Disable volume for now to avoid mplfinance parameter issues
        volume_enabled = False
        rsi_panel = None
        if rsi_series is not None and rsi_series.notna().sum() > 0:
            rsi_panel = 2 if volume_enabled else 1
            addplot.append(
                mpf.make_addplot(
                    rsi_series,
                    panel=rsi_panel,
                    color='#f1c40f',
                    width=1.6,
                    ylabel='RSI (14)'
                )
            )
        
        panel_ratios = [14]
        if volume_enabled:
            panel_ratios.append(3)
        if rsi_panel is not None:
            panel_ratios.append(3)
        
        # Enhanced market colors for better visibility - clearer candles
        # Use minimal configuration to avoid errors with wick parameter
        try:
            # Try with wick parameter first
            mc = mpf.make_marketcolors(
                up='#2ecc71',  # Bright green for up candles
                down='#e74c3c',  # Bright red for down candles
                edge='inherit',
                volume='in'
            )
        except Exception:
            # Fallback to most basic style if there's an error
            mc = mpf.make_marketcolors(
                up='#2ecc71',
                down='#e74c3c',
                volume='in'
            )
        
        # Enhanced dark theme style with better settings
        # Remove gridwidth as it's not a valid parameter for make_mpf_style
        style = mpf.make_mpf_style(
            marketcolors=mc,
            base_mpl_style='dark_background',
            gridstyle='-',
            gridcolor='#333333',
            y_on_right=False,
            facecolor='#1a1a1a',
            figcolor='#1a1a1a',
            edgecolor='#333333',
            rc={
                'axes.labelcolor': 'white',
                'axes.edgecolor': '#333333',
                'xtick.color': 'white',
                'ytick.color': 'white',
                'text.color': 'white',
                'font.size': 11,
                'axes.labelsize': 13,
                'axes.titlesize': 18,
                'xtick.labelsize': 10,
                'ytick.labelsize': 10,
            }
        )
        
        # Generate candlestick chart with enhanced settings for clarity
        # Wrap in try-except to handle any mplfinance errors gracefully
        try:
            fig, axes = mpf.plot(
                plot_data,
                type='candle',
                style=style,
                addplot=addplot if addplot else None,
                title='',
                ylabel='Price ($)',
                volume=False,  # Disable volume to avoid parameter issues
                figsize=(12, 8),  # Reasonable size for Discord
                panel_ratios=tuple(panel_ratios) if len(panel_ratios) > 1 else None,
                datetime_format='%b %d',
                xrotation=45,
                returnfig=True,
                show_nontrading=False,
                warn_too_much_data=10000  # Set high to silence warning (only warns if > 10000 points)
            )
            fig.suptitle(
                f'{symbol} • Signal (Candlestick)',
                fontsize=18,
                fontweight='bold',
                color='#f5f5f5',
                y=0.93
            )
        except Exception as plot_err:
            # If mplfinance fails, log error and try with minimal style
            print(f"mplfinance plot error for {symbol}: {plot_err}")
            import traceback
            traceback.print_exc()
            try:
                # Try with absolute minimal configuration - no addplots, no custom width
                simple_mc = mpf.make_marketcolors(up='#2ecc71', down='#e74c3c')
                simple_style = mpf.make_mpf_style(base_mpl_style='dark_background', marketcolors=simple_mc)
                fig, axes = mpf.plot(
                    plot_data,
                    type='candle',
                    style=simple_style,
                    title='',
                    ylabel='Price ($)',
                    volume=False,
                    figsize=(12, 7),
                    returnfig=True,
                    show_nontrading=False,
                    warn_too_much_data=10000
                )
                fig.suptitle(
                    f'{symbol} • Signal (Candlestick)',
                    fontsize=18,
                    fontweight='bold',
                    color='#f5f5f5',
                    y=0.93
                )
            except Exception as fallback_err:
                print(f"Fallback candlestick plot also failed for {symbol}: {fallback_err}")
                import traceback
                traceback.print_exc()
                return None
        
        # Add logo and branding to candlestick chart using figure coordinates
        try:
            logo_path = os.path.join(os.path.dirname(__file__), 'assets', 'joat-logo-nobg.png')
            if os.path.exists(logo_path):
                logo_img = Image.open(logo_path)
                
                # Resize logo to a visible but unobtrusive size
                target_height_px = 38
                aspect_ratio = logo_img.width / logo_img.height
                target_width_px = int(target_height_px * aspect_ratio)
                logo_img = logo_img.resize((target_width_px, target_height_px), Image.Resampling.LANCZOS)
                
                # Add logo at top-right using figure coordinates (more reliable than axes)
                imagebox = OffsetImage(logo_img, zoom=0.5)
                ab = AnnotationBbox(
                    imagebox, 
                    (0.47, 0.965),  # Centered group: logo to the left of center, above title
                    xycoords='figure fraction',
                    box_alignment=(1, 0.5),  # Right-middle of logo aligns to anchor
                    bboxprops=dict(edgecolor='none', facecolor='none'),
                    frameon=False,
                    pad=0,
                    zorder=1000
                )
                fig.add_artist(ab)
                
                # Add "Jack Of All Trades" text aligned with logo
                fig.text(
                    0.48, 0.965, 'Jack Of All Trades',
                    fontsize=9,
                    color='#d29544', 
                    fontweight='bold',
                    horizontalalignment='left', 
                    verticalalignment='center',
                    zorder=1000
                )
            else:
                print(f"Logo file not found at: {logo_path}")
        except Exception as logo_err:
            print(f"Could not add logo to candlestick chart: {logo_err}")
            import traceback
            traceback.print_exc()
        
        # Post-processing: styling, annotations, and contextual overlays
        try:
            fig_axes = list(fig.axes) if fig.axes else []
            price_ax = fig_axes[0] if fig_axes else None
            volume_ax = fig_axes[1] if volume_enabled and len(fig_axes) > 1 else None
            rsi_ax = None
            if rsi_panel is not None:
                rsi_index = 2 if volume_enabled else 1
                if len(fig_axes) > rsi_index:
                    rsi_ax = fig_axes[rsi_index]
            
            if price_ax is not None and len(plot_data) > 0:
                price_ax.grid(alpha=0.18, linestyle='--', linewidth=0.6)
                price_ax.set_ylabel('Price ($)', fontsize=11)
                
                # mplfinance with show_nontrading=False uses integer x-axis positions (0, 1, 2...)
                # Explicitly expand the axis limits so the latest candles are not compressed
                num_bars = len(plot_data)
                price_ax.set_xlim(-0.5, max(num_bars - 0.5, 0.5))
                x_last = num_bars - 1  # Last bar position
                
                price_ax.tick_params(axis='x', labelrotation=45, labelsize=10)

                # Shade support/resistance zones for quick visual context when both levels exist
                if r1 > 0 and r2 > 0:
                    upper = max(r1, r2)
                    lower = min(r1, r2)
                    price_ax.axhspan(lower, upper, facecolor='#8e2a2a', alpha=0.05, zorder=0)
                if s1 > 0 and s2 > 0:
                    lower = min(s1, s2)
                    upper = max(s1, s2)
                    price_ax.axhspan(lower, upper, facecolor='#1f5f3d', alpha=0.05, zorder=0)

                # Helper to avoid overlapping labels on each side
                y_min, y_max = price_ax.get_ylim()
                y_range = max(y_max - y_min, 1e-6)
                # Minimum vertical separation between stacked labels (in price units).
                # Use 5% of the visible price range so boxes have clear breathing room.
                min_sep = y_range * 0.05
                right_label_ys = []
                left_label_ys = []

                def place_right_label(y):
                    if y <= 0:
                        return None
                    adjusted = float(y)
                    # Push downward slightly if too close to an existing right-side label
                    while any(abs(adjusted - existing) < min_sep for existing in right_label_ys):
                        adjusted -= min_sep
                    right_label_ys.append(adjusted)
                    return adjusted

                def place_left_label(y):
                    if y <= 0:
                        return None
                    adjusted = float(y)
                    # Push upward slightly if too close to an existing left-side label
                    while any(abs(adjusted - existing) < min_sep for existing in left_label_ys):
                        adjusted += min_sep
                    left_label_ys.append(adjusted)
                    return adjusted

                # Right-side labels: position outside the chart box using axes coordinates
                # transform=price_ax.get_yaxis_transform() uses: x in axes coords (0-1), y in data coords
                r1_y = place_right_label(r1) if r1 > 0 else None
                if r1_y is not None:
                    price_ax.text(
                        1.01, r1_y, f'R1 ${r1:.2f}',
                        transform=price_ax.get_yaxis_transform(),
                        color='#ff6b6b', fontsize=10,
                        verticalalignment='center', horizontalalignment='left',
                        fontweight='bold',
                        bbox=dict(boxstyle='round,pad=0.3', facecolor='#1a1a1a', alpha=0.95, edgecolor='#ff6b6b', linewidth=1.2),
                        zorder=12,
                        clip_on=False
                    )

                r2_y = place_right_label(r2) if r2 > 0 else None
                if r2_y is not None:
                    price_ax.text(
                        1.01, r2_y, f'R2 ${r2:.2f}',
                        transform=price_ax.get_yaxis_transform(),
                        color='#ff8787', fontsize=10,
                        verticalalignment='center', horizontalalignment='left',
                        fontweight='bold',
                        bbox=dict(boxstyle='round,pad=0.3', facecolor='#1a1a1a', alpha=0.95, edgecolor='#ff8787', linewidth=1.2),
                        zorder=12,
                        clip_on=False
                    )

                # Left-side labels (supports)
                s1_y = place_left_label(s1) if s1 > 0 else None
                if s1_y is not None:
                    price_ax.text(
                        -0.01, s1_y, f'S1 ${s1:.2f}',
                        transform=price_ax.get_yaxis_transform(),
                        color='#2ecc71', fontsize=10,
                        verticalalignment='center', horizontalalignment='right',
                        fontweight='bold',
                        bbox=dict(boxstyle='round,pad=0.3', facecolor='#1a1a1a', alpha=0.95, edgecolor='#2ecc71', linewidth=1.2),
                        zorder=12,
                        clip_on=False
                    )

                s2_y = place_left_label(s2) if s2 > 0 else None
                if s2_y is not None:
                    price_ax.text(
                        -0.01, s2_y, f'S2 ${s2:.2f}',
                        transform=price_ax.get_yaxis_transform(),
                        color='#58d68d', fontsize=10,
                        verticalalignment='center', horizontalalignment='right',
                        fontweight='bold',
                        bbox=dict(boxstyle='round,pad=0.3', facecolor='#1a1a1a', alpha=0.95, edgecolor='#58d68d', linewidth=1.2),
                        zorder=12,
                        clip_on=False
                    )

                current_y = place_right_label(current_price) if current_price > 0 else None
                if current_y is not None:
                    price_ax.text(
                        1.01, current_y, f'Current ${current_price:.2f}',
                        transform=price_ax.get_yaxis_transform(),
                        color='#d29544', fontsize=11,
                        verticalalignment='center', horizontalalignment='left',
                        fontweight='bold',
                        bbox=dict(boxstyle='round,pad=0.35', facecolor='#1a1a1a', alpha=0.95, edgecolor='#d29544', linewidth=1.5),
                        zorder=13,
                        clip_on=False
                    )

                # Add marker for last closing price at the last candle
                last_close = plot_data['Close'].iloc[-1]
                price_ax.scatter(
                    x_last, last_close,
                    color='#f1c40f', s=36,
                    zorder=14, linewidths=0.8, edgecolors='#1a1a1a'
                )

                # Last price label shares the right-side stack
                last_label_y = place_right_label(last_close)
                if last_label_y is not None:
                    price_ax.text(
                        1.01, last_label_y, f'{last_close:.2f}',
                        transform=price_ax.get_yaxis_transform(),
                        color='#f1c40f',
                        fontsize=10,
                        fontweight='bold',
                        verticalalignment='center',
                        horizontalalignment='left',
                        bbox=dict(boxstyle='round,pad=0.3', facecolor='#1a1a1a', edgecolor='#f1c40f', linewidth=1.2, alpha=0.95),
                        zorder=14,
                        clip_on=False
                    )
                
                # Build a concise legend for overlays
                legend_handles = []
                legend_labels = []
                for line in price_ax.lines:
                    label = line.get_label()
                    if label and not label.startswith('_') and label not in legend_labels:
                        legend_handles.append(line)
                        legend_labels.append(label)
                if legend_handles:
                    legend = price_ax.legend(
                        legend_handles,
                        legend_labels,
                        loc='upper left',
                        bbox_to_anchor=(0, 1.02),
                        fontsize=9,
                        frameon=False,
                        ncol=2,
                        columnspacing=1.1,
                        handlelength=2.0,
                        handletextpad=0.6,
                    )
                    for text in legend.get_texts():
                        text.set_color('#f2f2f2')
            
            if volume_ax is not None:
                volume_ax.set_ylabel('Volume')
                volume_ax.grid(alpha=0.15, linestyle='--', linewidth=0.5)
                volume_ax.tick_params(axis='y', labelsize=9)
            
            if rsi_ax is not None:
                rsi_ax.set_ylabel('RSI (14)')
                rsi_ax.set_ylim(0, 100)
                rsi_ax.set_yticks([20, 30, 40, 50, 60, 70, 80])
                rsi_ax.grid(alpha=0.15, linestyle='--', linewidth=0.5)
                rsi_ax.axhline(70, color='#e74c3c', linestyle='--', linewidth=1.0, alpha=0.6)
                rsi_ax.axhline(50, color='#bdc3c7', linestyle=':', linewidth=0.9, alpha=0.5)
                rsi_ax.axhline(30, color='#2ecc71', linestyle='--', linewidth=1.0, alpha=0.6)
                rsi_ax.tick_params(axis='y', labelsize=9)
        except Exception as label_err:
            print(f"Could not style candlestick axes: {label_err}")
        
        # Adjust layout manually for professional spacing
        try:
            fig.subplots_adjust(left=0.08, right=0.97, top=0.82, bottom=0.16, hspace=0.10)
        except Exception as layout_err:
            print(f"Could not adjust subplots: {layout_err}")
        
        # Save the figure with proper settings - ensure file is valid PNG
        try:
            # Save with explicit settings for Discord compatibility
            fig.savefig(
                chart_path, 
                dpi=100,  # Lower DPI for smaller file size and faster upload
                format='png',
                facecolor='#1a1a1a',
                edgecolor='none',
                bbox_inches=None,  # Don't crop - use exact figure dimensions
                metadata=None
            )
            
            # Explicitly close this figure
            plt.close(fig)
            plt.close('all')
            
            # Ensure file is completely written
            import time
            import sys
            sys.stdout.flush()
            time.sleep(0.3)
            
            # Verify file was created successfully
            if os.path.exists(chart_path):
                file_size = os.path.getsize(chart_path)
                if file_size > 5000:  # At least 5KB for a valid chart
                    print(f"Successfully created candlestick chart: {chart_path} ({file_size} bytes)")
                    return chart_path
                else:
                    print(f"Warning: Chart file too small: {file_size} bytes")
            else:
                print(f"Warning: Chart file was not created: {chart_path}")
        except Exception as save_err:
            print(f"Error saving candlestick chart: {save_err}")
            import traceback
            traceback.print_exc()
        return None
    except Exception as e:
        print(f"Error generating dark candlestick chart for {symbol}: {e}")
        return None

def _generate_line_chart_fallback(symbol: str, data: pd.DataFrame, price_data: dict, chart_path: str) -> str:
    """Fallback line chart generation if candlestick fails (legacy function)."""
    return _generate_line_chart_dark(symbol, data, price_data, chart_path)
