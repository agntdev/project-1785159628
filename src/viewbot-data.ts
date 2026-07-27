import { resolveSessionStorage } from "./toolkit/session/redis.js";
import type { StorageAdapter } from "grammy";

export type SubBotStatus = "active" | "invalid";

export interface SubBot {
  token: string;
  name: string;
  status: SubBotStatus;
}

export interface RegisteredChannel {
  chatId: string;
  label: string;
  botStatus: "admin" | "lost";
}

export interface PostEvent {
  postId: number;
  chatId: string;
  timestamp: number;
  viewsSent: number;
  resultStatus: "unavailable" | "permission_lost";
}

export interface ActivityLog {
  eventType: "bot_added" | "bot_removed" | "channel_registered" | "channel_removed" | "view_attempt" | "permission_lost" | "invalid_token";
  timestamp: number;
  details: string;
}

export interface OwnerData {
  subBots: SubBot[];
  channels: RegisteredChannel[];
  posts: PostEvent[];
  logs: ActivityLog[];
}

interface ChannelIndex { ownerId: string }

let domainStorage: StorageAdapter<OwnerData | ChannelIndex> = resolveSessionStorage<OwnerData | ChannelIndex>(undefined);
const OWNER_PREFIX = "viewbot:owner:";
const CHANNEL_PREFIX = "viewbot:channel:";
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Injectable time seam for post retention and activity timestamps. */
export let now: () => number = () => new Date().getTime();

export function setNowForTests(clock: () => number): void {
  now = clock;
}

/** Worker startup supplies a Durable-Object-backed adapter; Node uses Redis. */
export function configureDomainStorage(storage: StorageAdapter<OwnerData | ChannelIndex>): void {
  domainStorage = storage;
}

function empty(): OwnerData {
  return { subBots: [], channels: [], posts: [], logs: [] };
}

function prune(data: OwnerData): OwnerData {
  const cutoff = now() - RETENTION_MS;
  return {
    ...data,
    posts: data.posts.filter((post) => post.timestamp >= cutoff),
    logs: data.logs.filter((entry) => entry.timestamp >= cutoff),
  };
}

export async function loadOwner(ownerId: number | string): Promise<OwnerData> {
  const stored = await domainStorage.read(OWNER_PREFIX + ownerId);
  return prune((stored as OwnerData | undefined) ?? empty());
}

export async function saveOwner(ownerId: number | string, data: OwnerData): Promise<void> {
  await domainStorage.write(OWNER_PREFIX + ownerId, prune(data));
}

export async function appendLog(ownerId: number | string, data: OwnerData, eventType: ActivityLog["eventType"], details: string): Promise<OwnerData> {
  const next = { ...data, logs: [...data.logs, { eventType, timestamp: now(), details }] };
  await saveOwner(ownerId, next);
  return next;
}

export async function registerChannelOwner(chatId: string, ownerId: number | string): Promise<void> {
  await domainStorage.write(CHANNEL_PREFIX + chatId, { ownerId: String(ownerId) });
}

export async function removeChannelOwner(chatId: string): Promise<void> {
  await domainStorage.delete(CHANNEL_PREFIX + chatId);
}

export async function ownerForChannel(chatId: number | string): Promise<string | undefined> {
  const index = await domainStorage.read(CHANNEL_PREFIX + chatId);
  return (index as ChannelIndex | undefined)?.ownerId;
}

export function formatWhen(timestamp: number): string {
  return new Date(timestamp).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}
