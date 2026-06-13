import os
import logging
import asyncio
from maxapi import Bot, Keyboard

# --- Configuration ---
BOT_TOKEN = os.environ.get('MAX_BOT_TOKEN')
MINI_APP_URL = os.environ.get('MINI_APP_URL', 'https://your-domain.vercel.app')

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)


async def start_handler(context):
    """Handle /start command — send welcome with Mini App button."""
    user = context.sender
    name = user.get('first_name', '') or user.get('username', '') or 'друг'
    logger.info("User %s started the bot", user.get('username'))

    keyboard = Keyboard()
    keyboard.add_url_button('🎰 Открыть рулетку', MINI_APP_URL)

    await context.send_text(
        f'Привет, {name}! 🎰\n\n'
        f'Нажми кнопку ниже, чтобы открыть колесо фортуны.',
        keyboard=keyboard
    )


async def main():
    """Start the MAX bot."""
    if not BOT_TOKEN:
        logger.error("MAX_BOT_TOKEN environment variable is not set!")
        print("Ошибка: переменная окружения MAX_BOT_TOKEN не задана.")
        print("Установите: set MAX_BOT_TOKEN=ваш_токен")
        return

    bot = Bot(token=BOT_TOKEN)
    bot.command('start')(start_handler)

    logger.info("MAX bot is starting...")
    await bot.start_polling()


if __name__ == '__main__':
    asyncio.run(main())
