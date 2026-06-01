import { GeminiOutput } from "../types";

export class TelegramServiceClient {
  private botToken: string;
  private chatId: string;

  constructor(botToken: string, chatId: string) {
    if (!botToken || !chatId) {
      throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required");
    }
    this.botToken = botToken;
    this.chatId = chatId;
  }

  /**
   * Dispatches a highly styled HTML notification to Telegram
   */
  async sendReport(output: GeminiOutput, nextWakeupTimeIso: string): Promise<boolean> {
    const nextWakeupCzech = new Date(nextWakeupTimeIso).toLocaleString("cs-CZ", {
      timeZone: "Europe/Prague",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    let message = `🤖 <b>Autonomní Cyklus AI Agenta Dokončen</b>\n\n`;
    
    if (output.thoughts) {
      message += `💡 <b>Myšlenkový směr:</b>\n<i>${this.escapeHtml(output.thoughts)}</i>\n\n`;
    }

    if (output.report) {
      message += `📋 <b>Hlavní report:</b>\n${this.escapeHtml(output.report)}\n\n`;
    }

    if (output.newTasks && output.newTasks.length > 0) {
      message += `<b>📋 Nové úkoly:</b>\n`;
      output.newTasks.forEach(t => {
        message += `• [${t.priority.toUpperCase()}] ${this.escapeHtml(t.title)}\n`;
      });
      message += `\n`;
    }

    if (output.completedTasks && output.completedTasks.length > 0) {
      message += `<b>✅ Uzavřené úkoly:</b>\n`;
      output.completedTasks.forEach(t => {
        message += `• ✅ ${this.escapeHtml(t)}\n`;
      });
      message += `\n`;
    }

    if (output.newGoals && output.newGoals.length > 0) {
      message += `<b>🎯 Nové strategické cíle:</b>\n`;
      output.newGoals.forEach(g => {
        message += `• 🎯 ${this.escapeHtml(g)}\n`;
      });
      message += `\n`;
    }

    message += `⏰ <b>Další nahlášené probuzení:</b>\nza ${output.nextWakeupMinutes} minut (${nextWakeupCzech} SEČ)`;

    // Telegram supports max 4096 characters per message
    if (message.length > 4000) {
      message = message.substring(0, 3900) + "\n\n...(Zpráva zkrácena kvůli limitu Telegramu)...";
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: "HTML",
        }),
      });

      if (!response.ok) {
        console.error(`Telegram API rejected report: ${response.status} - ${await response.text()}`);
        return false;
      }
      return true;
    } catch (error: any) {
      console.error(`Failed sending dispatch to Telegram: ${error.message}`);
      return false;
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
