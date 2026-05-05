# Race Incident Bot

Discord bot for submitting racing incidents, routing them to a private admin review channel, and notifying involved drivers when the case status changes.

Each submitted incident creates:

- A private review card in the configured admin channel with the incident details, evidence link, and admin actions.
- A discussion thread attached to that review card with a compact decision control message.
- A thread decision flow for publishing official driver-facing outcomes.
- Optional private log entries when final statuses are reached.

## Local Setup

1. Create a Discord application at https://discord.com/developers/applications.
2. Add a bot to the application.
3. Copy `.env.example` values into `.env` and fill in the real values:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
INCIDENT_REVIEW_CHANNEL_ID=
INCIDENT_LOG_CHANNEL_ID=
STEWARD_ROLE_ID=
DATABASE_URL=file:./data/dev.db
NODE_ENV=development
```

Required for the first build:

- `DISCORD_TOKEN`: Developer Portal > Application > Bot > token.
- `DISCORD_CLIENT_ID`: Developer Portal > Application > General Information > Application ID.
- `DISCORD_GUILD_ID`: Right-click the Discord test server > Copy Server ID.
- `INCIDENT_REVIEW_CHANNEL_ID`: Right-click the private review channel > Copy Channel ID.

Optional:

- `INCIDENT_LOG_CHANNEL_ID`: private admin archive channel for final decisions.
- `STEWARD_ROLE_ID`: role allowed to update incidents. Users with Manage Server can also update incidents.

Enable Discord Developer Mode first:

```text
Discord > User Settings > Advanced > Developer Mode
```

## Invite Bot

In the Developer Portal, go to OAuth2 > URL Generator.

Scopes:

- `bot`
- `applications.commands`

Bot permissions:

- Send Messages
- Embed Links
- Attach Files
- Read Message History
- Create Public Threads
- Create Private Threads
- Send Messages in Threads
- Manage Threads
- Use Slash Commands

Open the generated URL and invite the bot to the test server.

## Run

Install dependencies:

```bash
npm install
```

Register slash commands to the test server:

```bash
npm run register:commands
```

If command registration returns `Missing Access`, run:

```bash
npm run doctor
```

Then open the printed invite URL and invite or re-invite the bot to the server whose ID is `DISCORD_GUILD_ID`.

Start the bot:

```bash
npm run dev
```

## Current Commands

```text
/incident submit
/incident status
/incident setup-check
/incident random
```

Admin decisions are handled from the private review thread.

## First Test Flow

1. Run `npm run register:commands`.
2. Run `npm run dev`.
3. In the test server, submit an incident manually:

```text
/incident submit
```

Or create a random admin test incident:

```text
/incident random
```

4. For manual submissions, complete the private intake board:
   - Rule area
   - Race phase
   - Impact / severity
5. Fill out your gamertag, video link, incident time, and description from the intake buttons. Add other involved drivers/gamertags if known.
7. Confirm the bot posts a review message in the private review channel.
8. Confirm the bot creates a thread for that incident.
9. Discuss in the incident thread, then use `Make Decision` to propose and publish `Need Info`, `No Action`, or `Penalty`.
10. Use `/incident status` to reopen the newest incident card. Use the `Incident List` dropdown to switch incidents, or the follow-up button to add info after `Need Info`.

If submission fails with a review channel permission message, run:

```text
/incident setup-check
```

Then make sure the bot's server role can view and send messages in the configured private review channel.
