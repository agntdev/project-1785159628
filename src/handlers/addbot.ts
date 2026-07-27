import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { appendLog, loadOwner, saveOwner } from "../viewbot-data.js";
import { botMenu } from "../viewbot-ui.js";

registerMainMenuItem({ label: "Manage sub-bots", data: "bots:menu", order: 10 });
const composer = new Composer<Ctx>();

function tokenPrompt() {
  return inlineKeyboard([[inlineButton("Cancel", "flow:cancel")], [inlineButton("Back to menu", "menu:main")]]);
}

async function beginAdd(ctx: Ctx, edit: boolean): Promise<void> {
  ctx.session.flow = "add_token";
  ctx.session.pendingToken = undefined;
  const text = "Send the token for the sub-bot you want to add.";
  if (edit) await ctx.editMessageText(text, { reply_markup: tokenPrompt() });
  else await ctx.reply(text, { reply_markup: tokenPrompt() });
}

composer.callbackQuery("bots:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Manage the sub-bots that monitor your registered channels.", { reply_markup: botMenu() });
});
composer.callbackQuery("bots:add", async (ctx) => { await ctx.answerCallbackQuery(); await beginAdd(ctx, true); });
composer.callbackQuery("flow:cancel", async (ctx) => {
  ctx.session.flow = undefined;
  ctx.session.pendingToken = undefined;
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Nothing was added.", { reply_markup: botMenu() });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.flow !== "add_token" && ctx.session.flow !== "add_name") return next();
  const ownerId = ctx.from?.id;
  if (!ownerId) return;
  const input = ctx.message.text.trim();
  if (ctx.session.flow === "add_token") {
    const data = await loadOwner(ownerId);
    if (data.subBots.length >= 10) {
      ctx.session.flow = undefined;
      await ctx.reply("You already have 10 sub-bots. Remove one before adding another.", { reply_markup: botMenu() });
      return;
    }
    if (!/^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(input)) {
      ctx.session.flow = undefined;
      await appendLog(ownerId, data, "invalid_token", "A sub-bot token could not be verified.");
      await ctx.reply("That token isn't valid. Create or copy a token from BotFather, then try again.", { reply_markup: botMenu() });
      return;
    }
    let response: Response;
    try {
      await ctx.api.sendChatAction(ctx.chat.id, "typing");
      response = await fetch(`https://api.telegram.org/bot${input}/getMe`);
    } catch {
      await ctx.reply("I couldn't verify that token right now. Check your connection and try again.", { reply_markup: tokenPrompt() });
      return;
    }
    let result: { ok?: boolean; result?: { username?: string; first_name?: string } } = {};
    try { result = await response.json() as typeof result; } catch { /* handled below */ }
    if (!response.ok || !result.ok) {
      ctx.session.flow = undefined;
      await appendLog(ownerId, data, "invalid_token", "A sub-bot token could not be verified.");
      await ctx.reply("That token isn't valid. Create or copy a token from BotFather, then try again.", { reply_markup: botMenu() });
      return;
    }
    ctx.session.pendingToken = input;
    ctx.session.flow = "add_name";
    const suggested = result.result?.username ?? result.result?.first_name ?? "this sub-bot";
    await ctx.reply(`Verified ${suggested}. Send a short name, or type Skip to use that name.`, { reply_markup: tokenPrompt() });
    return;
  }
  const token = ctx.session.pendingToken;
  if (!token) { ctx.session.flow = undefined; await ctx.reply("That setup was interrupted. Tap Add sub-bot to start again.", { reply_markup: botMenu() }); return; }
  const name = input.toLowerCase() === "skip" ? "Sub-bot" : input.slice(0, 40);
  const data = await loadOwner(ownerId);
  if (data.subBots.length >= 10) { ctx.session.flow = undefined; await ctx.reply("You already have 10 sub-bots. Remove one before adding another.", { reply_markup: botMenu() }); return; }
  const nextData = { ...data, subBots: [...data.subBots, { token, name, status: "active" as const }] };
  await appendLog(ownerId, nextData, "bot_added", `Added ${name}.`);
  ctx.session.flow = undefined;
  ctx.session.pendingToken = undefined;
  await ctx.reply(`${name} is ready to monitor new posts.`, { reply_markup: botMenu() });
});

export default composer;
