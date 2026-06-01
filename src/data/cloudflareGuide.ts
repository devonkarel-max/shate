export const CLOUDFLARE_GUIDE = {
  title: "Nasazení Autonomního TypeScript Workeru",
  description: "Díky tomuto postupu zprovozníte kompletního autonomního plánovacího agenta přímo na serverech Cloudflare (Edge). Agent bude mít vlastní paměť, úkoly a cíle ve Firestore a bude vám posílat zprávy na Telegram nebo Discord zcela zdarma a bez nutnosti zapnutého PC či platební karty.",
  steps: [
    {
      step: 1,
      title: "Stažení / push projektu na GitHub",
      instruction: "Všechny soubory pro tento Cloudflare Worker máme stoprocentně připraveny ve složce `./cf-agent` vašeho projektu. Exportujte projekt jako ZIP (přes nastavení AI Studia) nebo jej nahrajte přímo na GitHub."
    },
    {
      step: 2,
      title: "Instalace a přihlášení do Cloudflare",
      instruction: "Otevřete terminál ve stažené složce `./cf-agent` a spusťte příkazy pro instalaci a propojení s vaším Cloudflare účtem:\n\n1. `npm install` (instalace wrangleru a typů)\n2. `npx wrangler login` (přihlášení v prohlížeči, bez jakékoliv platební karty)"
    },
    {
      step: 3,
      title: "Nastavení ID projektu v wrangler.toml",
      instruction: "Otevřete soubor `./cf-agent/wrangler.toml` ve svém editoru a změňte položku `FIREBASE_PROJECT_ID` na skutečné ID vašeho Firebase projektu. Soubor uložte."
    },
    {
      step: 4,
      title: "Nastavení tajných klíčů (Secrets)",
      instruction: "Citlivé údaje nelze ukládat v kódu. Nastavte je bezpečně v administraci Cloudflare nebo jednoduše přes tyto terminálové příkazy ve složce `./cf-agent`:\n\n1. `npx wrangler secret put GEMINI_API_KEY` (váš API klíč)\n2. `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON` (GCP Service Account klíč pro zápis do Firestore)\n3. `npx wrangler secret put TELEGRAM_BOT_TOKEN` a `npx wrangler secret put TELEGRAM_CHAT_ID` (pro notifikace na Telegram)\n4. `npx wrangler secret put DISCORD_WEBHOOK_URL` (pro případný souběžný Discord)"
    },
    {
      step: 5,
      title: "Spuštění a nahrání (Deploy)",
      instruction: "Spusťte příkaz `npm run deploy` (nebo `npx wrangler deploy`). Cloudflare během 5 vteřin zkompiluje TypeScript a nahraje kód. V administraci Cloudflare v sekci Triggers uvidíte aktivní Cron na každých 5 minut, který bude agenta bezplatně budit!"
    }
  ],
  workerCode: `// Hlavní spouštěcí kód Cloudflare Workeru (cf-agent/src/index.ts)
import { WorkerEnv } from "./types";
import { FirestoreServiceClient } from "./services/firestore";
import { GeminiServiceClient } from "./services/gemini";
import { MemoryManager } from "./services/memory";
import { PlanningEngine } from "./services/planner";
import { AgentScheduler } from "./services/scheduler";
import { TelegramServiceClient } from "./services/telegram";

export default {
  // Spouštěno automatickým Cron časovačem každých 5 minut s vyhodnocením stavu
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAutonomousCycle(env, false));
  },

  // Spouštěno přes HTTP POST např. z rozhraní pro ruční diagnostiku
  async fetch(request, env, ctx) {
    // ... kompletní API rozhraní pro ruční trigger, autentizaci a odeslání do fronty
  }
};`
};
