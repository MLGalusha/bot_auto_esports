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

  const fields: APIEmbedField[] = [
    { name: "Report", value: truncateEmbedFieldValue(incident.description), inline: false },
    { name: "Reporter", value: truncateEmbedFieldValue(`${incident.reporterGamertag ?? "Not provided"}\n<@${incident.submitterUserId}>`), inline: true },
    { name: "Rule Area", value: getIncidentCategoryLabel(incident.category ?? "other"), inline: true },
    { name: "Context", value: getRacePhaseLabel(incident.racePhase), inline: true },
    { name: "Impact", value: getIncidentImpactLabel(incident.impact), inline: true },
    { name: "Incident Time", value: incident.lapOrTime, inline: true },
    { name: "Submitted", value: formatDiscordTimestamp(incident.createdAt), inline: true },
    { name: "Other Drivers", value: truncateEmbedFieldValue(formatOtherDrivers(incident)), inline: false },
    { name: "Evidence", value: truncateEmbedFieldValue(formatEvidenceLink(incident.evidenceUrl)), inline: false },
  ];

  const followUps = formatFollowUps(incident, 5);
  if (followUps) {
    fields.push({ name: "Follow-Ups", value: followUps, inline: false });
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
    .setDescription(`**${formatStatus(incident.status)}**\nAdmin review card. Use the thread controls to request info or publish a decision.`)
    .addFields(fields)
    .setTimestamp(null);
}

function buildFinalReviewEmbed(incident: Incident): EmbedBuilder {
  const decision = incident.finalDecision;
  if (!decision) {
    return buildIncidentEmbed(incident);
  }

  const fields: APIEmbedField[] = buildDecisionFields(incident);

  fields.push({
    name: "Published",
    value: `${formatDiscordTimestamp(decision.finalizedAt)} by <@${decision.finalizedByUserId}>`,
    inline: false,
  });

  if (decision.internalNote) {
    fields.push({ name: "Internal Admin Note", value: truncateEmbedFieldValue(decision.internalNote), inline: false });
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
    .setTimestamp(decision ? new Date(decision.finalizedAt) : new Date());

  if (decision) {
    embed
      .setDescription(`**${formatDecisionOutcome(decision.outcome)}**`)
      .addFields(buildDecisionFields(incident));
  } else if (incident.decisionNote) {
    embed
      .setDescription(`**${formatStatus(incident.status)}**`)
      .addFields(
        { name: "Decision", value: truncateEmbedFieldValue(incident.decisionNote), inline: false },
        ...buildIncidentReferenceFields(incident),
      );
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
    .setDescription(`**${formatDecisionOutcome(draft.outcome)}**\nAdmins can discuss this wording in the thread. Publish only when this is ready to send to drivers.`);
}

function buildDecisionFields(incident: Incident): APIEmbedField[] {
  const decision = incident.finalDecision;
  if (!decision) {
    return [];
  }

  const fields: APIEmbedField[] = [];

  if (decision.outcome === "penalty") {
    if (decision.driver) {
      fields.push({ name: "Penalized Driver(s)", value: truncateEmbedFieldValue(decision.driver), inline: true });
    }
    if (decision.penalty) {
      fields.push({ name: "Penalty", value: truncateEmbedFieldValue(decision.penalty), inline: true });
    }
    if (decision.rule && decision.rule !== getIncidentCategoryLabel(incident.category)) {
      fields.push({ name: "Reason", value: truncateEmbedFieldValue(decision.rule), inline: false });
    }
  }

  fields.push(
    { name: getDecisionSummaryFieldName(decision.outcome), value: truncateEmbedFieldValue(decision.summary), inline: false },
    ...buildIncidentReferenceFields(incident),
  );

  if (incident.evidenceUrl) {
    fields.push({ name: "Evidence", value: truncateEmbedFieldValue(incident.evidenceUrl), inline: false });
  }

  return fields;
}

function buildIncidentReferenceFields(incident: Incident): APIEmbedField[] {
  return [
    { name: "Incident Time", value: incident.lapOrTime, inline: true },
    { name: "Rule Area", value: getIncidentCategoryLabel(incident.category), inline: true },
    { name: "Context", value: getRacePhaseLabel(incident.racePhase), inline: true },
    { name: "Reporter", value: incident.reporterGamertag ?? `<@${incident.submitterUserId}>`, inline: true },
    { name: "Other Drivers", value: truncateEmbedFieldValue(formatOtherDriversInline(incident)), inline: true },
  ];
}

function formatOtherDriversInline(incident: Incident): string {
  const otherDrivers = formatOtherDrivers(incident)
    .split("\n")
    .map((driver) => driver.trim())
    .filter(Boolean);

  return otherDrivers.length > 0 ? otherDrivers.join(", ") : "Not provided";
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

function formatFollowUps(incident: Incident, limit: number): string {
  const followUps = getUserFollowUps(incident)
    .slice(-limit)
    .reverse()
    .map((event) => formatFollowUp(event, 280))
    .join("\n");

  return truncateText(followUps, 1000);
}

function formatEvidenceLink(evidenceUrl?: string): string {
  return evidenceUrl ? `[Open video](${evidenceUrl})\n${evidenceUrl}` : "Not provided";
}

export function buildSubmissionReceiptEmbed(incident: Incident): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`Incident ${formatIncidentId(incident.id)} Submitted`)
    .setColor(0x10b981)
    .setDescription(`**${formatStatus(incident.status)}**\nYour report is in the admin review queue.`)
    .addFields(
      { name: "Report", value: truncateEmbedFieldValue(incident.description), inline: false },
      { name: "Rule Area", value: getIncidentCategoryLabel(incident.category), inline: true },
      { name: "Context", value: getRacePhaseLabel(incident.racePhase), inline: true },
      { name: "Impact", value: getIncidentImpactLabel(incident.impact), inline: true },
      { name: "Incident Time", value: incident.lapOrTime, inline: true },
      { name: "Your Gamertag", value: incident.reporterGamertag ?? "Not provided", inline: true },
      { name: "Other Drivers", value: truncateEmbedFieldValue(formatOtherDriversInline(incident)), inline: false },
      { name: "Evidence", value: truncateEmbedFieldValue(formatEvidenceLink(incident.evidenceUrl)), inline: false },
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
