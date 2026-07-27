# ViewBot Manager — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

Telegram bot that manages up to 10 sub-bots to automatically send views to new posts in channels/groups where the sub-bots are admins. Provides a /status interface to track view counts and bot health for channel/group owners who want increased visibility without manual effort.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Telegram channel administrators
- Telegram group managers

## Success criteria

- Automatic view generation for new posts in registered channels/groups
- Management of up to 10 sub-bots with status tracking
- Error notifications for invalid tokens or permissions

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with bot management options
- **/addbot** (command, actor: user, command: /addbot) — Add a new sub-bot with token and optional name
- **/removebot** (command, actor: user, command: /removebot) — Remove an existing sub-bot by ID
- **/registerchannel** (command, actor: user, command: /registerchannel) — Register a channel/group where sub-bots should monitor posts
- **/status** (command, actor: user, command: /status) — Show active sub-bots and view statistics
- **/logs** (command, actor: user, command: /logs) — View detailed activity log of view generation events

## Flows

### Sub-bot management
_Trigger:_ /addbot

1. Receive sub-bot token
2. Validate token with Telegram API
3. Add to sub-bot list if valid

_Data touched:_ sub-bots

### Channel registration
_Trigger:_ /registerchannel

1. Receive channel/group ID
2. Verify bot is admin
3. Store channel in registry

_Data touched:_ registered_channels

### View generation
_Trigger:_ New post event

1. Detect new post in registered channel
2. Trigger view generation from active sub-bots
3. Log view count and result status

_Data touched:_ post_events, logs

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **sub-bots** _(retention: persistent)_ — List of up to 10 sub-bots with tokens and status
  - fields: token, name, status
- **registered_channels** _(retention: persistent)_ — Telegram channels/groups where view generation is active
  - fields: chat_id, bot_status
- **post_events** _(retention: persistent)_ — Record of view generation attempts for posts
  - fields: post_id, chat_id, timestamp, views_sent, result_status
- **logs** _(retention: persistent)_ — Activity log of bot operations and errors
  - fields: event_type, timestamp, details

## Integrations

- **Telegram Bot API** (required) — Message delivery and admin permissions verification
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Add/remove sub-bots
- Register/deregister channels
- View status and logs
- Receive error notifications

## Notifications

- Error alerts when sub-bot tokens are invalid
- Notifications when sub-bots lose admin permissions
- View count summaries on /status command

## Permissions & privacy

- Only owner can manage bot settings
- Sub-bots only interact with registered channels
- View logs retained for 30 days

## Edge cases

- Invalid sub-bot token validation
- Exceeding 10 sub-bot limit
- Existing posts not triggering views

## Required tests

- End-to-end test of sub-bot addition → channel registration → view generation for new post
- Error handling test with invalid token

## Assumptions

- Default view count per sub-bot set to 30-50 views per post
- Sub-bots only generate views for new posts, not existing ones
- Main bot handles all user interface interactions
