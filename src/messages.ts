import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type APIEmbedField,
} from "discord.js";
import {
  getEvidenceReadinessLabel,
  getIncidentCategoryLabel,
  getIncidentImpactLabel,
  getRacePhaseLabel,
} from "./aero-rules.js";
import { formatIncidentId, formatStatus, type Incident, type IncidentStatus } from "./incidents.js";

export function buildIncidentEmbed(incident: Incident): EmbedBuilder {
  const fields: APIEmbedField[] = [
    { name: "Submitted", value: formatDiscordTimestamp(incident.createdAt), inline: true },
    { name: "Last Updated", value: formatDiscordTimestamp(incident.updatedAt), inline: true },
    { name: "Reporter", value: `<@${incident.submitterUserId}>`, inline: true },
    { name: "Reporter Gamertag", value: incident.reporterGamertag ?? "Not provided", inline: true },
    { name: "Rule Area", value: getIncidentCategoryLabel(incident.category ?? "other"), inline: true },
    { name: "Context", value: getRacePhaseLabel(incident.racePhase), inline: true },
    { name: "Impact", value: getIncidentImpactLabel(incident.impact), inline: true },
    { name: "Time", value: incident.lapOrTime, inline: true },
    { name: "Evidence", value: getEvidenceReadinessLabel(incident.evidenceReadiness), inline: true },
    {
      name: "Other Drivers",
      value:
        incident.involvedUserIds.length > 0
          ? incident.involvedUserIds.map((userId) => `<@${userId}>`).join(", ")
          : incident.involvedDriversText,
      inline: false,
    },
    { name: "Description", value: incident.description, inline: false },
  ];

  if (incident.decisionNote) {
    fields.push({ name: "Latest Note", value: incident.decisionNote, inline: false });
  }

  const recentTimeline = incident.history
    .slice(-5)
    .reverse()
    .map((event) => {
      const note = event.note ? ` - ${truncateText(event.note, 160)}` : "";
      return `${formatDiscordTimestamp(event.createdAt)} <@${event.actorUserId}>: **${formatStatus(event.status)}**${note}`;
    })
    .join("\n");

  if (recentTimeline) {
    fields.push({ name: "Recent Activity", value: recentTimeline, inline: false });
  }

  return new EmbedBuilder()
    .setTitle(`Incident ${formatIncidentId(incident.id)}`)
    .setColor(statusColor(incident.status))
    .setDescription(`**${formatStatus(incident.status)}**`)
    .addFields(fields)
    .setTimestamp(null);
}

export function buildReviewActions(incident: Incident): ActionRowBuilder<ButtonBuilder>[] {
  const rows = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`incident:under_review:${incident.id}`)
        .setLabel("Reviewing")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(false),
      new ButtonBuilder()
        .setCustomId(`incident:need_more_info:${incident.id}`)
        .setLabel("Need Info")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(false),
      new ButtonBuilder()
        .setCustomId(`incident:no_action:${incident.id}`)
        .setLabel("No Action")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(false),
      new ButtonBuilder()
        .setCustomId(`incident:penalty:${incident.id}`)
        .setLabel("Penalty")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(false),
      new ButtonBuilder()
        .setCustomId(`incident:closed:${incident.id}`)
        .setLabel("Close")
        .setStyle(ButtonStyle.Success)
        .setDisabled(false),
    ),
  ];

  if (incident.evidenceUrl) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Open Video")
          .setStyle(ButtonStyle.Link)
          .setURL(incident.evidenceUrl),
      ),
    );
  }

  return rows;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function buildSubmissionReceiptEmbed(incident: Incident): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`Incident ${formatIncidentId(incident.id)}`)
    .setColor(0x10b981)
    .setDescription(`**${formatStatus(incident.status)}**`)
    .addFields(
      { name: "Submitted", value: formatDiscordTimestamp(incident.createdAt), inline: true },
      { name: "Your Gamertag", value: incident.reporterGamertag ?? "Not provided", inline: true },
      { name: "Rule Area", value: getIncidentCategoryLabel(incident.category), inline: true },
      { name: "Context", value: getRacePhaseLabel(incident.racePhase), inline: true },
      { name: "Impact", value: getIncidentImpactLabel(incident.impact), inline: true },
      { name: "Time", value: incident.lapOrTime, inline: true },
      { name: "Video Link", value: incident.evidenceUrl ?? "Not provided", inline: false },
      { name: "Other Drivers", value: incident.involvedDriversText, inline: false },
      { name: "Summary", value: incident.description, inline: false },
    )
    .setTimestamp(new Date());
}

export function buildUserStatusMessage(incident: Incident): string {
  const base = [
    `Incident ${formatIncidentId(incident.id)} is now **${formatStatus(incident.status)}**.`,
    `Your Gamertag: ${incident.reporterGamertag ?? "Not provided"}`,
    `Time: ${incident.lapOrTime}`,
  ];

  if (incident.decisionNote) {
    base.push(`Note: ${incident.decisionNote}`);
  }

  return base.join("\n");
}

export function buildLogEmbed(incident: Incident): EmbedBuilder {
  const history = incident.history
    .slice(-8)
    .map((event) => {
      const note = event.note ? ` - ${event.note}` : "";
      return `<@${event.actorUserId}> set **${formatStatus(event.status)}**${note}`;
    })
    .join("\n");

  return buildIncidentEmbed(incident)
    .setTitle(`${formatIncidentId(incident.id)} Final Incident Log`)
    .addFields({
      name: "Recent Timeline",
      value: history || "No timeline entries recorded.",
      inline: false,
    });
}

function statusColor(status: IncidentStatus): number {
  switch (status) {
    case "submitted":
      return 0x6b7280;
    case "queued_review":
      return 0x7c3aed;
    case "under_review":
      return 0x2563eb;
    case "need_more_info":
      return 0xf59e0b;
    case "no_action":
      return 0x10b981;
    case "penalty":
      return 0xef4444;
    case "closed":
      return 0x374151;
  }
}

function formatDiscordTimestamp(isoDate: string): string {
  const seconds = Math.floor(Date.parse(isoDate) / 1000);
  return Number.isFinite(seconds) ? `<t:${seconds}:f>` : isoDate;
}
