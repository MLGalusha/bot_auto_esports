import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
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

const embedFieldValueMaxLength = 1024;
const embedDescriptionMaxLength = 4096;

export function buildIncidentEmbed(incident: Incident): EmbedBuilder {
  if (incident.finalDecision) {
    return buildFinalReviewEmbed(incident);
  }

  const reporter = [`Discord: <@${incident.submitterUserId}>`, `Gamertag: ${incident.reporterGamertag ?? "Not provided"}`].join("\n");
  const incidentDetails = [
    `Rule Area: ${getIncidentCategoryLabel(incident.category ?? "other")}`,
    `Context: ${getRacePhaseLabel(incident.racePhase)}`,
    `Impact: ${getIncidentImpactLabel(incident.impact)}`,
  ].join("\n");
  const timing = [`Submitted: ${formatDiscordTimestamp(incident.createdAt)}`, `Incident Time: ${incident.lapOrTime}`].join("\n");
  const fields: APIEmbedField[] = [
    { name: "Reporter", value: truncateEmbedFieldValue(reporter), inline: true },
    { name: "Incident", value: truncateEmbedFieldValue(incidentDetails), inline: true },
    { name: "Timeline", value: truncateEmbedFieldValue(timing), inline: true },
    { name: "Evidence", value: truncateEmbedFieldValue(formatEvidenceLink(incident.evidenceUrl)), inline: false },
    {
      name: "Other Drivers",
      value: truncateEmbedFieldValue(formatOtherDrivers(incident)),
      inline: false,
    },
    { name: "Report Summary", value: truncateEmbedFieldValue(incident.description), inline: false },
  ];

  const latestFollowUp = getUserFollowUps(incident).at(-1);
  if (latestFollowUp) {
    fields.push({
      name: "Newest Follow-Up",
      value: truncateEmbedFieldValue(formatFollowUp(latestFollowUp, 420)),
      inline: false,
    });
  }

  const previousFollowUps = formatFollowUps(incident, 4, latestFollowUp?.createdAt);
  if (previousFollowUps) {
    fields.push({ name: "Previous Follow-Ups", value: previousFollowUps, inline: false });
  }

  if (incident.finalDecision) {
    fields.push({ name: "Final Decision", value: formatDecisionDraft(incident.finalDecision, "admin"), inline: false });
  }

  if (incident.decisionNote && !incident.finalDecision) {
    fields.push({ name: "Decision Note", value: truncateEmbedFieldValue(incident.decisionNote), inline: false });
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
    fields.push({ name: "Admin Activity", value: truncateEmbedFieldValue(recentTimeline), inline: false });
  }

  return new EmbedBuilder()
    .setTitle(`Incident ${formatIncidentId(incident.id)} Review`)
    .setColor(statusColor(incident.status))
    .setDescription(`**${formatStatus(incident.status)}**\nDiscuss in the thread. Follow-ups and decisions update this card.`)
    .addFields(fields)
    .setTimestamp(null);
}

function buildFinalReviewEmbed(incident: Incident): EmbedBuilder {
  const decision = incident.finalDecision;
  if (!decision) {
    return buildIncidentEmbed(incident);
  }

  const fields: APIEmbedField[] = [
    { name: "Published", value: formatDiscordTimestamp(decision.finalizedAt), inline: true },
    { name: "Published By", value: `<@${decision.finalizedByUserId}>`, inline: true },
  ];

  if (decision.outcome === "penalty" && decision.driver) {
    fields.push({ name: "Driver", value: decision.driver, inline: true });
  }
  if (decision.outcome === "penalty" && decision.penalty) {
    fields.push({ name: "Penalty", value: decision.penalty, inline: true });
  }
  if (decision.outcome === "penalty" && decision.rule) {
    fields.push({ name: "Finding / Rule", value: decision.rule, inline: false });
  }

  fields.push({ name: getDecisionSummaryFieldName(decision.outcome), value: truncateEmbedFieldValue(decision.summary), inline: false });

  if (decision.internalNote) {
    fields.push({ name: "Internal Admin Note", value: truncateEmbedFieldValue(decision.internalNote), inline: false });
  }

  fields.push(
    { name: "Incident Submitted", value: formatDiscordTimestamp(incident.createdAt), inline: true },
    { name: "Reporter", value: `<@${incident.submitterUserId}>`, inline: true },
    { name: "Reporter Gamertag", value: incident.reporterGamertag ?? "Not provided", inline: true },
    { name: "Rule Area", value: getIncidentCategoryLabel(incident.category ?? "other"), inline: true },
    { name: "Context", value: getRacePhaseLabel(incident.racePhase), inline: true },
    { name: "Time", value: incident.lapOrTime, inline: true },
    { name: "Other Drivers", value: truncateEmbedFieldValue(formatOtherDrivers(incident)), inline: false },
    { name: "Original Report", value: truncateEmbedFieldValue(incident.description), inline: false },
  );

  if (incident.evidenceUrl) {
    fields.push({ name: "Evidence", value: truncateEmbedFieldValue(incident.evidenceUrl), inline: false });
  }

  return new EmbedBuilder()
    .setTitle(`Incident ${formatIncidentId(incident.id)} Final Decision`)
    .setColor(statusColor(incident.status))
    .setDescription(`**${formatDecisionOutcome(decision.outcome)}**\nOfficial ruling has been published to the involved drivers.`)
    .addFields(fields)
    .setTimestamp(new Date(decision.finalizedAt));
}

export function buildThreadReviewActions(incident: Incident) {
  if (incident.decisionDraft || isFinalStatus(incident.status)) {
    return [];
  }

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(buildDecisionOutcomeSelect(incident.id, "Make decision")),
  ];
}

export function buildDecisionProposalActions(incident: Incident) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`incident-finalize:confirm:${incident.id}`)
        .setLabel("Publish Decision")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!incident.decisionDraft || isFinalStatus(incident.status)),
    ),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(buildDecisionOutcomeSelect(incident.id, "Change outcome / edit wording").setDisabled(isFinalStatus(incident.status))),
  ];
}

function buildDecisionOutcomeSelect(incidentId: string, placeholder: string): StringSelectMenuBuilder {
  return new StringSelectMenuBuilder()
    .setCustomId(`decision-outcome:${incidentId}`)
    .setPlaceholder(placeholder)
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Need More Info")
        .setDescription("Ask drivers for more evidence or clarification.")
        .setValue("need_more_info"),
      new StringSelectMenuOptionBuilder()
        .setLabel("No Action")
        .setDescription("Publish a no-action ruling.")
        .setValue("no_action"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Penalty")
        .setDescription("Publish a penalty ruling.")
        .setValue("penalty"),
    );
}

export function formatDecisionDraft(draft: IncidentDecisionDraft, audience: "admin" | "driver" = "driver"): string {
  const lines = [`Outcome: **${formatDecisionOutcome(draft.outcome)}**`];

  if (draft.outcome === "penalty" && draft.driver) {
    lines.push(`Driver: ${draft.driver}`);
  }
  if (draft.outcome === "penalty" && draft.rule) {
    lines.push(`Rule: ${draft.rule}`);
  }
  if (draft.outcome === "penalty" && draft.penalty) {
    lines.push(`Penalty: ${draft.penalty}`);
  }

  lines.push(`${getDecisionSummaryLabel(draft.outcome)}: ${draft.summary}`);

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
    if (decision.outcome === "penalty" && decision.driver) {
      embed.addFields({ name: "Driver", value: decision.driver, inline: true });
    }
    if (decision.outcome === "penalty" && decision.penalty) {
      embed.addFields({ name: "Penalty", value: decision.penalty, inline: true });
    }
    if (decision.outcome === "penalty" && decision.rule) {
      embed.addFields({ name: "Finding / Rule", value: decision.rule, inline: false });
    }

    embed.addFields({ name: getDecisionSummaryFieldName(decision.outcome), value: truncateEmbedFieldValue(decision.summary), inline: false });
  } else if (incident.decisionNote) {
    embed.addFields({ name: "Decision", value: truncateEmbedFieldValue(incident.decisionNote), inline: false });
  }

  embed.addFields(
    { name: "Reporter Gamertag", value: incident.reporterGamertag ?? "Not provided", inline: true },
    { name: "Other Drivers", value: truncateEmbedFieldValue(formatOtherDrivers(incident)), inline: false },
  );

  if (incident.evidenceUrl) {
    embed.addFields({ name: "Evidence", value: truncateEmbedFieldValue(incident.evidenceUrl), inline: false });
  }

  return embed;
}

export function buildDecisionDraftPreviewEmbed(incident: Incident): EmbedBuilder {
  const draft = incident.decisionDraft;
  if (!draft) {
    return buildParticipantDecisionEmbed(incident);
  }

  const previewIncident: Incident = {
    ...incident,
    status: draft.outcome,
    finalDecision: {
      ...draft,
      finalizedByUserId: draft.updatedByUserId,
      finalizedAt: draft.updatedAt,
    },
  };

  return buildParticipantDecisionEmbed(previewIncident)
    .setTitle(`Incident ${formatIncidentId(incident.id)} Proposed Decision`)
    .setDescription("Admins can discuss this wording in the thread. Publish only when this is ready to send to drivers.");
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

function getDecisionSummaryFieldName(outcome: IncidentDecisionDraft["outcome"]): string {
  switch (outcome) {
    case "need_more_info":
      return "Requested Info";
    case "no_action":
      return "Decision";
    case "penalty":
      return "Decision";
  }
}

function getDecisionSummaryLabel(outcome: IncidentDecisionDraft["outcome"]): string {
  switch (outcome) {
    case "need_more_info":
      return "Requested Info";
    case "no_action":
    case "penalty":
      return "Decision";
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

export function truncateEmbedDescription(value: string): string {
  return truncateText(value, embedDescriptionMaxLength);
}

export function truncateEmbedFieldValue(value: string): string {
  return truncateText(value || "\u200b", embedFieldValueMaxLength);
}

function getUserFollowUps(incident: Incident) {
  return incident.history.filter((event) => event.action === "user_response" && event.note);
}

function formatFollowUp(event: ReturnType<typeof getUserFollowUps>[number], maxNoteLength: number): string {
  return `${formatDiscordTimestamp(event.createdAt)} <@${event.actorUserId}>: ${truncateText(event.note ?? "", maxNoteLength)}`;
}

function formatFollowUps(incident: Incident, limit: number, excludeCreatedAt?: string): string {
  const followUps = getUserFollowUps(incident)
    .filter((event) => event.createdAt !== excludeCreatedAt)
    .slice(-limit)
    .reverse()
    .map((event) => formatFollowUp(event, 280))
    .join("\n\n");

  return truncateText(followUps, 1000);
}

function formatEvidenceLink(evidenceUrl?: string): string {
  return evidenceUrl ? `[Open video](${evidenceUrl})\n${evidenceUrl}` : "Not provided";
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
      { name: "Video Link", value: truncateEmbedFieldValue(incident.evidenceUrl ?? "Not provided"), inline: false },
      { name: "Other Drivers", value: truncateEmbedFieldValue(formatOtherDrivers(incident)), inline: false },
      { name: "Summary", value: truncateEmbedFieldValue(incident.description), inline: false },
    )
    .setTimestamp(new Date());
}

export function buildLogEmbed(incident: Incident): EmbedBuilder {
  const history = incident.history
    .slice(-8)
    .map((event) => {
      const note = event.note ? ` - ${truncateText(event.note, 240)}` : "";
      return `<@${event.actorUserId}> set **${formatStatus(event.status)}**${note}`;
    })
    .join("\n");

  return buildIncidentEmbed(incident)
    .setTitle(`${formatIncidentId(incident.id)} Final Incident Log`)
    .setDescription(`**${formatStatus(incident.status)}**`)
    .addFields({
      name: "Recent Timeline",
      value: truncateEmbedFieldValue(history || "No timeline entries recorded."),
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
