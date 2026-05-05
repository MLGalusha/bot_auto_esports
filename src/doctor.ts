import { PermissionFlagsBits } from "discord.js";
import { config } from "./config.js";

const permissions =
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.AttachFiles |
  PermissionFlagsBits.ReadMessageHistory |
  PermissionFlagsBits.CreatePublicThreads |
  PermissionFlagsBits.CreatePrivateThreads |
  PermissionFlagsBits.SendMessagesInThreads |
  PermissionFlagsBits.ManageThreads;

const inviteUrl = new URL("https://discord.com/oauth2/authorize");
inviteUrl.searchParams.set("client_id", config.discordClientId);
inviteUrl.searchParams.set("scope", "bot applications.commands");
inviteUrl.searchParams.set("permissions", permissions.toString());

const values = [
  ["DISCORD_TOKEN", config.discordToken],
  ["DISCORD_CLIENT_ID", config.discordClientId],
  ["DISCORD_GUILD_ID", config.discordGuildId],
  ["INCIDENT_REVIEW_CHANNEL_ID", config.incidentReviewChannelId],
  ["INCIDENT_LOG_CHANNEL_ID", config.incidentLogChannelId],
  ["STEWARD_ROLE_ID", config.stewardRoleId],
] as const;

for (const [key, value] of values) {
  console.log(`${key}: ${value ? `set (${value.length} chars)` : "empty"}`);
}

console.log("\nInvite or re-invite the bot with this URL:");
console.log(inviteUrl.toString());
console.log("\nAfter inviting it to the server matching DISCORD_GUILD_ID, run:");
console.log("npm run register:commands");
