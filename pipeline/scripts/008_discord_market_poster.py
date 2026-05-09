#!/usr/bin/env python3
"""
Discord Market Analysis Poster
Posts formatted market analysis findings to Discord channel.
Reads from market_analysis_export.json and formats for Discord.
"""

import os
import json
import asyncio
import discord
from discord.ext import commands
from dotenv import load_dotenv
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

class MarketAnalysisPoster:
    """Posts market analysis data to Discord in formatted messages."""

    def __init__(self, token: str, channel_id: int):
        """Initialize with bot token and target channel."""
        self.token = token
        self.channel_id = channel_id

        # Create bot with minimal intents
        intents = discord.Intents.default()
        intents.message_content = False
        self.bot = commands.Bot(command_prefix='!', intents=intents)
        self.setup_events()

    def setup_events(self):
        """Set up bot event handlers."""
        @self.bot.event
        async def on_ready():
            print(f'{self.bot.user} has connected to Discord!')

    def load_market_data(self, filepath: str) -> Optional[Dict]:
        """Load market analysis data from JSON file."""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            print(f"Loaded market data from {filepath}")
            return data
        except FileNotFoundError:
            print(f"Error: Market data file not found at {filepath}")
            return None
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON: {e}")
            return None

    def format_price(self, price: float) -> str:
        """Format price for display."""
        if price >= 100:
            return f"${price:.0f}"
        elif price >= 10:
            return f"${price:.1f}"
        else:
            return f"${price:.2f}"

    def format_percentage(self, pct: float) -> str:
        """Format percentage with appropriate emoji."""
        if pct > 0:
            return f"+{pct:.1f}% 📈"
        else:
            return f"{pct:.1f}% 📉"

    def create_card_link(self, card_name: str, printing_id: str) -> str:
        """Create clickable link to fabbazaar.app for a card."""
        if printing_id:
            return f"[{card_name}](<https://fabbazaar.app/printing/{printing_id}>)"
        else:
            return card_name

    def create_market_summary(self, data: Dict) -> str:
        """Create market summary embed content."""
        stats = data.get('market_stats', {})

        summary = "## 🏪 Daily Price Report\n\n"
        summary += f"**Cards Compared:** {stats.get('total_comparisons', 0):,}\n"
        summary += f"**Analysis Date:** {data.get('analysis_date', 'Unknown')}\n\n"
        summary += "📊 *TCGPlayer prices compared to previous day. Not financial advice.*\n"

        return summary

    def create_hot_movers_message(self, data: Dict) -> str:
        """Create message for top price increases."""
        increases = data.get('selling_opportunities', {}).get('hot_movers', [])

        if not increases:
            return "No significant price increases found."

        message = "## 🔥 Largest Price Increases\n\n"

        for i, card in enumerate(increases[:5], 1):
            old_price = self.format_price(card.get('old_price', 0))
            new_price = self.format_price(card.get('new_price', 0))
            pct_change = self.format_percentage(card.get('percent_change', 0))

            card_name = card.get('card_name', 'Unknown Card')
            printing_id = card.get('printing_id', '')
            set_name = card.get('set', '')
            rarity = card.get('rarity', '').upper()

            # Create clickable card name
            card_link = self.create_card_link(card_name, printing_id)

            message += f"**{i}. {card_link}**"
            if set_name:
                message += f" *({set_name})*"
            if rarity:
                message += f" `{rarity}`"
            message += f"\n{old_price} → {new_price} ({pct_change})\n\n"

        return message

    def create_buying_opportunities_message(self, data: Dict) -> str:
        """Create message for price decreases/buying opportunities."""
        decreases = data.get('buying_opportunities', {}).get('major_drops', [])

        if not decreases:
            return "No significant price decreases found."

        message = "## 📉 Largest Price Decreases\n\n"

        for i, card in enumerate(decreases[:5], 1):
            old_price = self.format_price(card.get('old_price', 0))
            new_price = self.format_price(card.get('new_price', 0))
            pct_change = self.format_percentage(card.get('percent_change', 0))

            card_name = card.get('card_name', 'Unknown Card')
            printing_id = card.get('printing_id', '')
            set_name = card.get('set', '')
            rarity = card.get('rarity', '').upper()

            # Create clickable card name
            card_link = self.create_card_link(card_name, printing_id)

            message += f"**{i}. {card_link}**"
            if set_name:
                message += f" *({set_name})*"
            if rarity:
                message += f" `{rarity}`"
            message += f"\n{old_price} → {new_price} ({pct_change})\n\n"

        return message

    def create_volatility_message(self, data: Dict) -> str:
        """Create message for high volatility cards."""
        volatile = data.get('advanced_strategies', {}).get('high_volatility', [])

        if not volatile:
            return "No high volatility cards found."

        message = "## ⚡ Largest % Changes\n\n"

        for i, card in enumerate(volatile[:3], 1):
            old_price = self.format_price(card.get('old_price', 0))
            new_price = self.format_price(card.get('new_price', 0))
            pct_change = self.format_percentage(card.get('percent_change', 0))

            card_name = card.get('card_name', 'Unknown Card')
            printing_id = card.get('printing_id', '')
            set_name = card.get('set', '')

            # Create clickable card name
            card_link = self.create_card_link(card_name, printing_id)

            message += f"**{i}. {card_link}**"
            if set_name:
                message += f" *({set_name})*"
            message += f"\n{old_price} → {new_price} ({pct_change})\n\n"

        return message

    def create_value_opportunities_message(self, data: Dict) -> str:
        """Create message for calculated value opportunities."""
        opportunities = data.get('advanced_strategies', {}).get('value_opportunities', [])

        if not opportunities:
            return "No value opportunities identified."

        message = "## 💎 Notable Drops by Rarity\n\n"
        message += "*Cards with significant price decreases, filtered by rarity and type*\n\n"

        for i, card in enumerate(opportunities[:3], 1):
            old_price = self.format_price(card.get('old_price', 0))
            new_price = self.format_price(card.get('new_price', 0))
            pct_change = self.format_percentage(card.get('percent_change', 0))
            opportunity_score = card.get('opportunity_score', 0)

            card_name = card.get('card_name', 'Unknown Card')
            printing_id = card.get('printing_id', '')
            set_name = card.get('set', '')
            rarity = card.get('rarity', '').upper()

            # Create clickable card name
            card_link = self.create_card_link(card_name, printing_id)

            message += f"**{i}. {card_link}**"
            if set_name:
                message += f" *({set_name})*"
            if rarity:
                message += f" `{rarity}`"
            message += f"\n{old_price} → {new_price} ({pct_change})"
            message += f"\n*Opportunity Score: {opportunity_score}/10*\n\n"

        return message

    async def post_market_analysis(self, data_file: str = "market_analysis_export.json") -> bool:
        """Post complete market analysis to Discord."""
        # Load market data
        data = self.load_market_data(data_file)
        if not data:
            return False

        # Guard: skip post if no movers were found (stale data). Reads the keys
        # that 010_compute_movers.py actually writes into market_stats.
        stats = data.get('market_stats', {})
        if stats.get('top_gainers_count', 0) == 0 and stats.get('top_decliners_count', 0) == 0:
            print("Skipping Discord post — no price changes detected (possible stale data)")
            return True

        try:
            await self.bot.wait_until_ready()
            channel = self.bot.get_channel(self.channel_id)

            if not channel:
                print(f"Error: Could not find channel with ID {self.channel_id}")
                return False

            # Post market summary
            summary_msg = self.create_market_summary(data)
            await channel.send(summary_msg)

            # Small delay between messages
            await asyncio.sleep(1)

            # Post hot movers
            hot_movers_msg = self.create_hot_movers_message(data)
            if len(hot_movers_msg) < 2000:  # Discord character limit
                await channel.send(hot_movers_msg)
            else:
                # Split if too long
                chunks = [hot_movers_msg[i:i+1900] for i in range(0, len(hot_movers_msg), 1900)]
                for chunk in chunks:
                    await channel.send(chunk)
                    await asyncio.sleep(1)

            await asyncio.sleep(1)

            # Post buying opportunities
            buying_msg = self.create_buying_opportunities_message(data)
            if len(buying_msg) < 2000:
                await channel.send(buying_msg)
            else:
                chunks = [buying_msg[i:i+1900] for i in range(0, len(buying_msg), 1900)]
                for chunk in chunks:
                    await channel.send(chunk)
                    await asyncio.sleep(1)

            await asyncio.sleep(1)

            # Post volatility info
            volatility_msg = self.create_volatility_message(data)
            await channel.send(volatility_msg)

            await asyncio.sleep(1)

            # Post value opportunities
            value_msg = self.create_value_opportunities_message(data)
            await channel.send(value_msg)

            # Footer message
            footer = "---\n📊 *TCGPlayer prices compared to previous day. Not financial advice.*"
            await channel.send(footer)

            print("✅ Market analysis posted successfully to Discord!")
            return True

        except discord.Forbidden:
            print("Error: Bot doesn't have permission to send messages")
            return False
        except Exception as e:
            print(f"Error posting to Discord: {e}")
            return False

    async def start_and_post(self, data_file: str = "market_analysis_export.json"):
        """Start bot, post analysis, then stop."""
        try:
            # Start bot
            bot_task = asyncio.create_task(self.bot.start(self.token))

            # Wait for bot to be ready
            await asyncio.sleep(3)

            # Post analysis
            success = await self.post_market_analysis(data_file)

            # Stop bot
            await self.bot.close()

            return success

        except Exception as e:
            print(f"Error: {e}")
            return False

def main():
    """Main function."""
    import sys

    print("=== DISCORD MARKET ANALYSIS POSTER ===")

    # Load environment variables
    load_dotenv()

    # Get bot token
    token = os.getenv('DISCORD_BOT_TOKEN')
    if not token:
        print("Error: DISCORD_BOT_TOKEN not found in environment")
        return 1

    # Get channel ID (default to the one you provided)
    channel_id = 1406714754961113210
    if len(sys.argv) > 1:
        try:
            channel_id = int(sys.argv[1])
        except ValueError:
            print("Error: Channel ID must be a number")
            return 1

    # Get data file path
    data_file = "market_analysis_export.json"
    if len(sys.argv) > 2:
        data_file = sys.argv[2]

    # Check if data file exists
    if not Path(data_file).exists():
        print(f"Error: Data file {data_file} not found")
        print("Make sure to run price_analysis3.py first to generate the data")
        return 1

    # Create poster and run
    poster = MarketAnalysisPoster(token, channel_id)

    try:
        success = asyncio.run(poster.start_and_post(data_file))
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\nPosting cancelled by user.")
        return 1

if __name__ == "__main__":
    exit(main())