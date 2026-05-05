import "dotenv/config";

const requiredEnv = [
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
  "DISCORD_GUILD_ID",
  "INCIDENT_REVIEW_CHANNEL_ID",
] as const;

function readRequiredEnv(key: (typeof requiredEnv)[number]): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  discordToken: readRequiredEnv("DISCORD_TOKEN"),
  discordClientId: readRequiredEnv("DISCORD_CLIENT_ID"),
  discordGuildId: readRequiredEnv("DISCORD_GUILD_ID"),
  incidentReviewChannelId: readRequiredEnv("INCIDENT_REVIEW_CHANNEL_ID"),
  incidentLogChannelId: process.env.INCIDENT_LOG_CHANNEL_ID?.trim() || undefined,
  stewardRoleId: process.env.STEWARD_ROLE_ID?.trim() || undefined,
};
