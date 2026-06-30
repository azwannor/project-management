export async function sendTelegramMessage(text: string, replyMarkup?: any, targetChatId?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = targetChatId || process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn("Telegram bot token or chat ID is missing. Cannot send message.");
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        reply_markup: replyMarkup
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Failed to send Telegram message:", errorData);
    }
  } catch (error) {
    console.error("Error sending Telegram message:", error);
  }
}

export function formatHtmlForTelegram(html: string | null | undefined): string {
  if (!html) return "-";
  let text = html;
  
  text = text.replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'");

  text = text.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, innerOl) => {
    let index = 1;
    return innerOl.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (liMatch: string, liInner: string) => {
      return `${index++}. ${liInner}\n`;
    });
  });

  text = text.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, innerUl) => {
    return innerUl.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (liMatch: string, liInner: string) => {
      return `• ${liInner}\n`;
    });
  });

  text = text.replace(/<\/p>/gi, '\n')
             .replace(/<br\s*\/?>/gi, '\n');

  text = text.replace(/<[^>]*>?/gm, '');

  text = text.replace(/\n\s*\n/g, '\n').trim();
  
  return text || "-";
}
