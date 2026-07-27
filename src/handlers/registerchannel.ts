import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { appendLog, loadOwner, registerChannelOwner, removeChannelOwner, saveOwner } from "../viewbot-data.js";

registerMainMenuItem({ label: "Channels", data: "channels:menu", order: 20 });
const composer = new Composer<Ctx>();
const channelMenu = () => inlineKeyboard([
  [inlineButton("Register channel", "channels:add")],
  [inlineButton("Remove channel", "channels:remove")],
  [inlineButton("Back to menu", "menu:main")],
]);

composer.callbackQuery("channels:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Register a channel or group after adding this bot as an admin.", { reply_markup: channelMenu() });
});
composer.callbackQuery("channels:add", async (ctx) => {
  ctx.session.flow = "register_channel";
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Send the channel or group @username, or its numeric chat ID.", {
    reply_markup: inlineKeyboard([[inlineButton("Cancel", "flow:channel-cancel")], [inlineButton("Back", "channels:menu")]]),
  });
});
composer.callbackQuery("flow:channel-cancel", async (ctx) => {
  ctx.session.flow = undefined;
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Nothing was registered.", { reply_markup: channelMenu() });
});
composer.callbackQuery("channels:remove", async (ctx) => {
  await ctx.answerCallbackQuery();
  const ownerId = ctx.from?.id;
  if (!ownerId) return;
  const data = await loadOwner(ownerId);
  if (data.channels.length === 0) { await ctx.editMessageText("No channels yet — tap Register channel to add one.", { reply_markup: channelMenu() }); return; }
  await ctx.editMessageText("Choose the channel or group to remove.", {
    reply_markup: inlineKeyboard([...data.channels.map((channel, index) => [inlineButton(channel.label, `channels:drop:${index}`)]), [inlineButton("Back", "channels:menu")]]),
  });
});
composer.on("callback_query:data", async (ctx, next) => {
  const match = /^channels:drop:(\d+)$/.exec(ctx.callbackQuery.data);
  if (!match) return next();
  await ctx.answerCallbackQuery();
  const ownerId = ctx.from?.id;
  if (!ownerId) return;
  const data = await loadOwner(ownerId);
  const channel = data.channels[Number(match[1])];
  if (!channel) { await ctx.editMessageText("That channel is no longer registered.", { reply_markup: channelMenu() }); return; }
  const nextData = { ...data, channels: data.channels.filter((item) => item.chatId !== channel.chatId) };
  await saveOwner(ownerId, nextData);
  await removeChannelOwner(channel.chatId);
  await appendLog(ownerId, nextData, "channel_removed", `Removed ${channel.label}.`);
  await ctx.editMessageText(`${channel.label} was removed.`, { reply_markup: channelMenu() });
});
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.flow !== "register_channel") return next();
  const ownerId = ctx.from?.id;
  if (!ownerId) return;
  const target = ctx.message.text.trim();
  if (!/^@[A-Za-z0-9_]{5,}$/.test(target) && !/^-?\d+$/.test(target)) {
    await ctx.reply("Send an @username or numeric chat ID for a channel or group where I'm an admin.", { reply_markup: channelMenu() });
    return;
  }
  try {
    const chat = await ctx.api.getChat(target);
    const member = await ctx.api.getChatMember(chat.id, ctx.me.id);
    if (member.status !== "administrator" && member.status !== "creator") {
      ctx.session.flow = undefined;
      await ctx.reply("I need admin access there before I can register it. Add me as an admin, then try again.", { reply_markup: channelMenu() });
      return;
    }
    const data = await loadOwner(ownerId);
    if (data.channels.some((item) => item.chatId === String(chat.id))) {
      ctx.session.flow = undefined;
      await ctx.reply("That channel is already registered.", { reply_markup: channelMenu() });
      return;
    }
    const label = chat.title || chat.username ? `@${chat.username ?? chat.title}` : "Registered channel";
    const nextData = { ...data, channels: [...data.channels, { chatId: String(chat.id), label, botStatus: "admin" as const }] };
    await saveOwner(ownerId, nextData);
    await registerChannelOwner(String(chat.id), ownerId);
    await appendLog(ownerId, nextData, "channel_registered", `Registered ${label}.`);
    ctx.session.flow = undefined;
    await ctx.reply(`${label} is registered. Only new posts will be monitored.`, { reply_markup: channelMenu() });
  } catch {
    ctx.session.flow = undefined;
    await ctx.reply("I couldn't verify that channel. Check that the address is correct and that I'm an admin.", { reply_markup: channelMenu() });
  }
});

export default composer;
