import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { formatWhen, loadOwner } from "../viewbot-data.js";

registerMainMenuItem({ label: "Activity log", data: "logs:show", order: 40 });
const composer = new Composer<Ctx>();

async function logText(ctx: Ctx): Promise<string> {
  const ownerId = ctx.from?.id;
  if (!ownerId) return "I couldn't find your account. Open the menu and try again.";
  const logs = (await loadOwner(ownerId)).logs.slice(-10).reverse();
  if (logs.length === 0) return "No activity yet — add a sub-bot or register a channel to get started.";
  return logs.map((entry) => `${formatWhen(entry.timestamp)} — ${entry.details}`).join("\n");
}

composer.callbackQuery("logs:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(await logText(ctx), { reply_markup: inlineKeyboard([[inlineButton("Refresh", "logs:show")], [inlineButton("Back to menu", "menu:main")]]) });
});

export default composer;
