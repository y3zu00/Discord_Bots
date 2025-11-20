import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv


load_dotenv()


@dataclass
class Secret:
    """Environment-backed secrets for Discord bot.

    Define DISCORD_TOKEN, SIGNAL_CHANNEL_ID, and COMMAND_CHANNEL_ID in your environment or .env file.
    """

    token: Optional[str] = os.getenv("DISCORD_TOKEN")
    signal_channel_id: Optional[int] = (
        int(os.getenv("SIGNAL_CHANNEL_ID")) if os.getenv("SIGNAL_CHANNEL_ID") else None
    )
    command_channel_id: Optional[int] = (
        int(os.getenv("COMMAND_CHANNEL_ID")) if os.getenv("COMMAND_CHANNEL_ID") else None
    )


