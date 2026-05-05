import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type APIEmbedField,
} from "discord.js";
import {
  getIncidentCategoryLabel,
  getIncidentImpactLabel,
  getRacePhaseLabel,
} from "./aero-rules.js";
import {
  formatIncidentId,
  formatStatus,
  type Incident,
  type IncidentDecisionDraft,
  type IncidentStatus,
} from "./incidents.js";

export function buildIncidentEmbed(incident: Incident): EmbedBuilder {
  if (incident.finalDecision) {
    return buildFinalReviewEmbed(incident);
  }

  const fields: APIEmbedField[] = [
    { name: "Submitted", value: formatDiscordTimestamp(incident.createdAt), inline: true },
    { name: "Reporter", value: `<@${incident.submitterUserId}>`, inline: true },
    { name: "Status", value: formatStatus(incident.status), inline: true },
    { name: "Reporter Gamertag", value: incident.reporterGamertag ?? "Not provided", inline: true },
    { name: "Rule Area", value: getIncidentCategoryLabel(incident.category ?? "other"), inline: true },
    { name: "Context", value: getRacePhaseLabel(incident.racePhase), inline: true },
    { name: "Impact", value: getIncidentImpactLabel(incident.impact), inline: true },
    { name: "Time", value: incident.lapOrTime, inline: true },
    { name: "Video Link", value: incident.evidenceUrl ?? "Not provided", inline: false },
    {
      name: "Other Drivers",
      value: formatOtherDrivers(incident),
      inline: false,
    },
    { name: "Description", value: incident.description, inline: false },
  ];

  const followUps = formatFollowUps(incident, 5);
  if (followUps) {
    fields.push({ name: "Follow-Ups", value: followUps, inline: false });
  }

  if (incident.finalDecision) {
    fields.push({ name: "Final Decision", value: formatDecisionDraft(incident.finalDecision, "admin"), inline: false });
  }

  if (incident.decisionNote && !incident.finalDecision) {
    fields.push({ name: "Decision Note", value: incident.decisionNote, inline: false });
  }

  const recentTimeline = incident.history
    .filter((event) => event.action !== "submitted" && event.action !== "user_response")
    .slice(-3)
    .reverse()
    .map((event) => {
      const note = event.note ? ` - ${truncateText(event.note, 160)}` : "";
      return `${formatDiscordTimestamp(event.createdAt)} <@${event.actorUserId}>: **${formatStatus(event.status)}**${note}`;
    })
    .join("\n");

  if (recentTimeline) {
    fields.push({ name: "Admin Activity", value: recentTimeline, inline: false });
  }

  return new EmbedBuilder()
    .setTitle(`Incident ${formatIncidentId(incident.id)} Review`)
    .setColor(statusColor(incident.status))
    .setDescription("Discuss in the thread. The card updates when an official decision is published.")
    .addFields(fields)
    .setTimestamp(null);
}

function buildFinalReviewEmbed(incident: Incident): EmbedBuilder {
  const decision = incident.finalDecision;
  if (!decision) {
    return buildIncidentEmbed(incident);
  }

  const fields: APIEmbedField[] = [
    { name: "Outcome", value: formatDecisionOutcome(decision.outcome), inline: true },
    { name: "Published", value: formatDiscordTimestamp(decision.finalizedAt), inline: true },
    { name: "Published By", value: `<@${decision.finalizedByUserId}>`, inline: true },
  ];

  if (decision.driver) {
    fields.push({ name: "Driver", value: decision.driver, inline: true });
  }
  if (decision.penalty) {
    fields.push({ name: "Penalty", value: decision.penalty, inline: true });
  }
  if (decision.rule) {
    fields.push({ name: "Finding / Rule", value: decision.rule, inline: false });
  }

  fields.push({ name: "Official Decision", value: decision.summary, inline: false });

  if (decision.internalNote) {
    fields.push({ name: "Internal Admin Note", value: decision.internalNote, inline: false });
  }

  fields.push(
    { name: "Incident Submitted", value: formatDiscordTimestamp(incident.createdAt), inline: true },
    { name: "Reporter", value: `<@${incident.submitterUserId}>`, inline: true },
    { name: "Reporter Gamertag", value: incident.reporterGamertag ?? "Not provided", inline: true },
    { name: "Rule Area", value: getIncidentCategoryLabel(incident.category ?? "other"), inline: true },
    { name: "Context", value: getRacePhaseLabel(incident.racePhase), inline: true },
    { name: "Time", value: incident.lapOrTime, inline: true },
    { name: "Other Drivers", value: formatOtherDrivers(incident), inline: false },
    { name: "Original Report", value: incident.description, inline: false },
  );

  if (incident.evidenceUrl) {
    fields.push({ name: "Evidence", value: incident.evidenceUrl, inline: false });
  }

  return new EmbedBuilder()
    .setTitle(`Incident ${formatIncidentId(incident.id)} Final Decision`)
    .setColor(statusColor(incident.status))
    .setDescription("Official ruling has been published to the involved drivers.")
    .addFields(fields)
    .setTimestamp(new Date(decision.finalizedAt));
}

export function buildReviewActions(incident: Incident): ActionRowBuilder<ButtonBuilder>[] {
  return [];
}

export function buildThreadReviewActions(incident: Incident): ActionRowBuilder<ButtonBuilder>[] {
  const decisionButton = new ButtonBuilder()
    .setCustomId(`incident-decision:start:${incident.id}`)
    .setLabel(incident.decisionDraft ? "Edit Decision" : "Make Decision")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(isFinalStatus(incident.status));

  const buttons = [decisionButton];
  if (incident.evidenceUrl) {
    buttons.push(new ButtonBuilder().setLabel("Open Video").setStyle(ButtonStyle.Link).setURL(incident.evidenceUrl));
  }

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)];
}

export function buildDecisionProposalActions(incident: Incident): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`incident-finalize:confirm:${incident.id}`)
        .setLabel("Publish Decision")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!incident.decisionDraft || isFinalStatus(incident.status)),
      new ButtonBuilder()
        .setCustomId(`incident-decision:start:${incident.id}`)
        .setLabel("Edit")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(isFinalStatus(incident.status)),
    ),
  ];
}

export function formatDecisionDraft(draft: IncidentDecisionDraft, audience: "admin" | "driver" = "driver"): string {
  const lines = [`Outcome: **${formatDecisionOutcome(draft.outcome)}**`];

  if (draft.driver) {
    lines.push(`Driver: ${draft.driver}`);
  }
  if (draft.rule) {
    lines.push(`Rule: ${draft.rule}`);
  }
  if (draft.penalty) {
    lines.push(`Penalty: ${draft.penalty}`);
  }

  lines.push(`Summary: ${draft.summary}`);

  if (audience === "admin" && draft.internalNote) {
    lines.push(`Internal: ${draft.internalNote}`);
  }

  return truncateText(lines.join("\n"), audience === "admin" ? 1000 : 1600);
}

export function formatDecisionDraftForParticipants(draft: IncidentDecisionDraft): string {
  return formatDecisionDraft(draft, "driver");
}

export function buildParticipantDecisionEmbed(incident: Incident): EmbedBuilder {
  const decision = incident.finalDecision;
  const embed = new EmbedBuilder()
    .setTitle(`Incident ${formatIncidentId(incident.id)} Decision`)
    .setColor(statusColor(incident.status))
    .setTimestamp(decision ? new Date(decision.finalizedAt) : new Date())
    .addFields(
      { name: "Outcome", value: decision ? formatDecisionOutcome(decision.outcome) : formatStatus(incident.status), inline: true },
      { name: "Incident Time", value: incident.lapOrTime, inline: true },
      { name: "Rule Area", value: getIncidentCategoryLabel(incident.category), inline: true },
    );

  if (decision) {
    if (decision.driver) {
      embed.addFields({ name: "Driver", value: decision.driver, inline: true });
    }
    if (decision.penalty) {
      embed.addFields({ name: "Penalty", value: decision.penalty, inline: true });
    }
    if (decision.rule) {
      embed.addFields({ name: "Finding / Rule", value: decision.rule, inline: false });
    }

    embed.addFields({ name: "Decision", value: decision.summary, inline: false });
  } else if (incident.decisionNote) {
    embed.addFields({ name: "Decision", value: incident.decisionNote, inline: false });
  }

  embed.addFields(
    { name: "Reporter Gamertag", value: incident.reporterGamertag ?? "Not provided", inline: true },
    { name: "Other Drivers", value: formatOtherDrivers(incident), inline: false },
  );

  if (incident.evidenceUrl) {
    embed.addFields({ name: "Evidence", value: incident.evidenceUrl, inline: false });
  }

  return embed;
}

function formatDecisionOutcome(outcome: IncidentDecisionDraft["outcome"]): string {
  switch (outcome) {
    case "need_more_info":
      return "Need More Info";
    case "no_action":
      return "No Action";
    case "penalty":
      return "Penalty";
  }
}

function isFinalStatus(status: IncidentStatus): boolean {
  return status === "no_action" || status === "penalty" || status === "closed";
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatFollowUps(incident: Incident, limit: number): string {
  const followUps = incident.history
    .filter((event) => event.action === "user_response" && event.note)
    .slice(-limit)
    .reverse()
    .map((event) => `${formatDiscordTimestamp(event.createdAt)} <@${event.actorUserId}>: ${truncateText(event.note ?? "", 280)}`)
    .join("\n\n");

  return truncateText(followUps, 1000);
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
      { name: "Other Drivers", value: formatOtherDrivers(incident), inline: false },
      { name: "Summary", value: incident.description, inline: false },
    )
    .setTimestamp(new Date());
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
    .setDescription(`**${formatStatus(incident.status)}**`)
    .addFields({
      name: "Recent Timeline",
      value: history || "No timeline entries recorded.",
      inline: false,
    });
}

export function formatOtherDrivers(incident: Incident): string {
  if (incident.involvedUserIds.length > 0) {
    return incident.involvedUserIds.map((userId) => `<@${userId}>`).join("\n");
  }

  const drivers = incident.involvedDriversText
    .split(/[\n,]+/)
    .map((driver) => driver.trim())
    .filter(Boolean);

  return drivers.length > 0 ? drivers.join("\n") : "Not provided";
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
