import os
import json
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters

# --- Configuration ---
BOT_TOKEN = os.environ.get('BOT_TOKEN')
MINI_APP_URL = os.environ.get('MINI_APP_URL', 'https://your-domain.vercel.app')

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command — send welcome message with Mini App button."""
    user = update.effective_user
    name = user.first_name or 'друг'
    logger.info("User %s (id=%s) started the bot", user.username, user.id)

    keyboard = [
        [InlineKeyboardButton(
            text='🎰 Открыть рулетку',
            web_app=WebAppInfo(url=MINI_APP_URL)
        )]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        f'Привет, {name}! 🎰\n\n'
        f'Нажми кнопку ниже, чтобы открыть колесо фортуны.',
        reply_markup=reply_markup
    )


async def handle_webapp_data(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle data sent from Mini App."""
    try:
        data = json.loads(update.effective_message.web_app_data.data)
        segment = data.get('segment', '?')
        points = data.get('points', 0)

        if points > 0:
            text = f'🎉 Выпало: {segment}\n+{points} очков!'
        elif points < 0:
            text = f'😅 Выпало: {segment}\n{points} очков'
        else:
            text = f'Выпало: {segment}'

        await update.message.reply_text(text)
    except Exception as e:
        logger.error("Error handling webapp data: %s", e)
        await update.message.reply_text('Результат получен! 🎰')


def main() -> None:
    """Start the bot."""
    if not BOT_TOKEN:
        logger.error("BOT_TOKEN environment variable is not set!")
        print("Ошибка: переменная окружения BOT_TOKEN не задана.")
        print("Установите: set BOT_TOKEN=ваш_токен")
        return

    application = Application.builder().token(BOT_TOKEN).build()
    application.add_handler(CommandHandler('start', start))
    application.add_handler(
        MessageHandler(filters.StatusUpdate.WEB_APP_DATA, handle_webapp_data)
    )

    logger.info("Bot is starting...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
