import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { appendLog, loadOwner } from "../viewbot-data.js";
import { botMenu } from "../viewbot-ui.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("bots:remove", async (ctx) => {
  await ctx.answerCallbackQuery();
  const ownerId = ctx.from?.id;
  if (!ownerId) return;
  const data = await loadOwner(ownerId);
  if (data.subBots.length === 0) {
    await ctx.editMessageText("No sub-bots yet — tap Add sub-bot to create one.", { reply_markup: botMenu() });
    return;
  }
  await ctx.editMessageText("Choose the sub-bot to remove.", {
    reply_markup: inlineKeyboard([
      ...data.subBots.map((bot, index) => [inlineButton(bot.name, `bots:drop:${index}`)]),
      [inlineButton("Back", "bots:menu")],
    ]),
  });
});

composer.on("callback_query:data", async (ctx, next) => {
  const match = /^bots:drop:(\d+)$/.exec(ctx.callbackQuery.data);
  if (!match) return next();
  await ctx.answerCallbackQuery();
  const ownerId = ctx.from?.id;
  if (!ownerId) return;
  const data = await loadOwner(ownerId);
  const index = Number(match[1]);
  const bot = data.subBots[index];
  if (!bot) { await ctx.editMessageText("That sub-bot is no longer in your list.", { reply_markup: botMenu() }); return; }
  await ctx.editMessageText(`Remove ${bot.name}?`, {
    reply_markup: inlineKeyboard([[inlineButton("Remove", `bots:confirm:${index}`), inlineButton("Keep", "bots:menu")]]),
  });
});
composer.on("callback_query:data", async (ctx, next) => {
  const match = /^bots:confirm:(\d+)$/.exec(ctx.callbackQuery.data);
  if (!match) return next();
  await ctx.answerCallbackQuery();
  const ownerId = ctx.from?.id;
  if (!ownerId) return;
  const data = await loadOwner(ownerId);
  const index = Number(match[1]);
  const bot = data.subBots[index];
  if (!bot) { await ctx.editMessageText("That sub-bot is no longer in your list.", { reply_markup: botMenu() }); return; }
  const nextData = { ...data, subBots: data.subBots.filter((_, i) => i !== index) };
  await appendLog(ownerId, nextData, "bot_removed", `Removed ${bot.name}.`);
  await ctx.editMessageText(`${bot.name} was removed.`, { reply_markup: botMenu() });
});

export default composer;
