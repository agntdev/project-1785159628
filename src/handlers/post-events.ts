import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { appendLog, loadOwner, ownerForChannel, saveOwner } from "../viewbot-data.js";

const composer = new Composer<Ctx>();

composer.on(["channel_post", "message"], async (ctx, next) => {
  const message = ctx.channelPost ?? ctx.message;
  if (!message || (ctx.chat?.type !== "channel" && ctx.chat?.type !== "supergroup" && ctx.chat?.type !== "group")) return next();
  const ownerId = await ownerForChannel(ctx.chat.id);
  if (!ownerId) return next();
  const data = await loadOwner(ownerId);
  const channel = data.channels.find((item) => item.chatId === String(ctx.chat.id));
  if (!channel) return next();
  try {
    const membership = await ctx.api.getChatMember(ctx.chat.id, ctx.me.id);
    if (membership.status !== "administrator" && membership.status !== "creator") {
      const nextData = { ...data, channels: data.channels.map((item) => item.chatId === channel.chatId ? { ...item, botStatus: "lost" as const } : item) };
      await appendLog(ownerId, nextData, "permission_lost", `Admin access was lost for ${channel.label}.`);
      try { await ctx.api.sendMessage(ownerId, `Admin access was lost for ${channel.label}. Add me as an admin to resume monitoring.`); } catch { /* the owner may have blocked the bot */ }
      return;
    }
  } catch {
    return;
  }
  const event = { postId: message.message_id, chatId: String(ctx.chat.id), timestamp: (await import("../viewbot-data.js")).now(), viewsSent: 0, resultStatus: "unavailable" as const };
  const nextData = { ...data, posts: [...data.posts, event] };
  await saveOwner(ownerId, nextData);
  await appendLog(ownerId, nextData, "view_attempt", `Recorded a new-post attempt for ${channel.label}; Telegram exposes no view-generation API.`);
});

export default composer;
