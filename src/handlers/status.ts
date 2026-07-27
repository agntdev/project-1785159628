import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { loadOwner } from "../viewbot-data.js";

registerMainMenuItem({ label: "Status", data: "status:show", order: 30 });
const composer = new Composer<Ctx>();

async function statusText(ctx: Ctx): Promise<string> {
  const ownerId = ctx.from?.id;
  if (!ownerId) return "I couldn't find your account. Open the menu and try again.";
  const data = await loadOwner(ownerId);
  const active = data.subBots.filter((bot) => bot.status === "active").length;
  const attempted = data.posts.length;
  const recorded = data.posts.reduce((total, post) => total + post.viewsSent, 0);
  if (data.subBots.length === 0 && data.channels.length === 0) {
    return "Nothing is connected yet — add a sub-bot, then register a channel.";
  }
  return `You have ${active} active sub-bot${active === 1 ? "" : "s"} and ${data.channels.length} registered channel${data.channels.length === 1 ? "" : "s"}.\n\nNew-post attempts: ${attempted}\nViews recorded: ${recorded}\n\nTelegram doesn't provide an API for sending artificial views, so attempts are logged without invented counts.`;
}

composer.callbackQuery("status:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(await statusText(ctx), { reply_markup: inlineKeyboard([[inlineButton("Refresh", "status:show")], [inlineButton("Back to menu", "menu:main")]]) });
});

export default composer;
