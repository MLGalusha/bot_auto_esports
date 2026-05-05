import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  PermissionFlagsBits,
  PermissionsBitField,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ThreadAutoArchiveDuration,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type APIInteractionGuildMember,
  type GuildMember,
  type ModalSubmitInteraction,
  type TextChannel,
} from "discord.js";
import {
  evidenceReadiness,
  getEvidenceReadinessLabel,
  getEvidenceReadinessOptions,
  getDefaultIntakeValues,
  getIncidentCategoryLabel,
  getIncidentImpactLabel,
  getIncidentImpactOptions,
  getRacePhaseLabel,
  getRacePhaseOptions,
  incidentCategories,
  shouldShowEvidenceSelect,
  shouldShowImpactSelect,
} from "./aero-rules.js";
import { config } from "./config.js";
import {
  createIncident,
  formatIncidentId,
  formatStatus,
  getIncident,
  incidentStatuses,
  listIncidentsForUser,
  updateIncident,
  type Incident,
  type IncidentStatus,
} from "./incidents.js";
import {
  buildIncidentEmbed,
  buildLogEmbed,
  buildReviewActions,
  buildSubmissionReceiptEmbed,
  buildUserStatusMessage,
} from "./messages.js";

const loggedStatuses = new Set<IncidentStatus>(["no_action", "penalty", "closed"]);

type IntakeDraft = {
  id: string;
  guildId: string;
  userId: string;
  reporterGamertag?: string;
  category?: string;
  racePhase?: string;
  impact?: string;
  evidenceReadiness?: string;
  evidenceLink?: string;
  lapOrTime?: string;
  description?: string;
  drivers: string[];
  createdAt: number;
};

const intakeDrafts = new Map<string, IntakeDraft>();

type ParsedIntakeCustomId = {
  draftId?: string;
  action: string;
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
      return;
    }

    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      await handleStringSelect(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    }
  } catch (error) {
    console.error(error);
    const message = formatInteractionError(error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: message, ephemeral: true });
    } else if (interaction.isRepliable()) {
      await interaction.followUp({ content: message, ephemeral: true });
    }
  }
});

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (interaction.commandName !== "incident") {
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  if (subcommand === "submit") {
    await handleSubmit(interaction);
    return;
  }

  if (subcommand === "setup-check") {
    await handleSetupCheck(interaction);
    return;
  }

  if (subcommand === "status") {
    await handleStatus(interaction);
    return;
  }
}

async function handleSubmit(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "Incidents can only be submitted inside a server.", ephemeral: true });
    return;
  }

  const draft = createIntakeDraft(interaction.guildId, interaction.user.id);
  await interaction.reply({
    ephemeral: true,
    embeds: [buildIntakeEmbed(draft)],
    components: buildIntakeComponents(draft),
  });
}

async function handleSetupCheck(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!canModerate(interaction.member, interaction.memberPermissions)) {
    await interaction.reply({ content: "Only admins can run setup checks.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const review = await describeChannelAccess(config.incidentReviewChannelId, "Review channel");
  const log = config.incidentLogChannelId
    ? await describeChannelAccess(config.incidentLogChannelId, "Log channel")
    : "Log channel: not configured.";

  await interaction.editReply([review, log].join("\n"));
}

async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "Incident status can only be checked inside a server.", ephemeral: true });
    return;
  }

  const incidents = await listIncidentsForUser(interaction.guildId, interaction.user.id);
  if (incidents.length === 0) {
    await interaction.reply({
      ephemeral: true,
      embeds: [buildIncidentListEmbed(incidents)],
      components: [],
    });
    return;
  }

  await interaction.reply({
    ephemeral: true,
    embeds: [buildStatusEmbed(incidents[0])],
    components: buildStatusComponents(incidents[0], incidents),
  });
}

function buildIncidentListEmbed(incidents: Incident[]): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Your Incidents")
    .setColor(0x2563eb)
    .setDescription(
      incidents.length === 0
        ? "You do not have any submitted or involved incidents yet."
        : `Select an incident below to view details. Showing ${Math.min(incidents.length, 25)} most recent.`,
    );
}

function buildIncidentListComponents(
  incidents: Incident[],
  selectedIncidentId?: string,
): ActionRowBuilder<StringSelectMenuBuilder>[] {
  const options = incidents.slice(0, 25);
  if (options.length === 0) {
    return [];
  }

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("status:select")
        .setPlaceholder("Incident List")
        .addOptions(
          options.map((incident) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(truncateText(`${formatIncidentId(incident.id)} - ${getIncidentCategoryLabel(incident.category)}`, 100))
              .setDescription(
                truncateText(`${formatShortDate(incident.createdAt)} | ${formatStatus(incident.status)} | ${incident.lapOrTime}`, 100),
              )
              .setValue(incident.id)
              .setDefault(incident.id === selectedIncidentId),
          ),
        ),
    ),
  ];
}

function buildStatusEmbed(incident: Incident): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`Incident ${formatIncidentId(incident.id)}`)
    .setColor(0x2563eb)
    .setDescription(`**${formatStatus(incident.status)}**`)
    .addFields(
      { name: "Submitted", value: formatDiscordTimestamp(incident.createdAt), inline: true },
      { name: "Rule Area", value: getIncidentCategoryLabel(incident.category), inline: true },
      { name: "Your Gamertag", value: incident.reporterGamertag ?? "Not provided", inline: true },
      { name: "Context", value: getRacePhaseLabel(incident.racePhase), inline: true },
      { name: "Impact", value: getIncidentImpactLabel(incident.impact), inline: true },
      { name: "Time", value: incident.lapOrTime, inline: true },
      { name: "Video Link", value: incident.evidenceUrl ?? "Not provided", inline: false },
      { name: "Other Drivers", value: incident.involvedDriversText, inline: false },
      { name: "Summary", value: incident.description, inline: false },
    )
    .setTimestamp(new Date());

  const followUps = formatFollowUps(incident, 5);
  if (followUps) {
    embed.addFields({ name: "Follow-Ups", value: followUps, inline: false });
  }

  if (incident.decisionNote) {
    embed.addFields({ name: "Latest Admin Note", value: incident.decisionNote, inline: false });
  }

  return embed;
}

function buildStatusComponents(
  incident: Incident,
  incidents: Incident[] = [],
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
  const incidentListRows = buildIncidentListComponents(incidents, incident.id);
  if (incidentListRows.length > 0) {
    rows.push(...incidentListRows);
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`status:view:${incident.id}`)
        .setLabel("Refresh")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`followup:open:${incident.id}`)
        .setLabel("Add Follow-Up")
        .setStyle(ButtonStyle.Primary),
    ),
  );

  return rows;
}

function canViewIncident(userId: string, incident: Incident): boolean {
  return incident.submitterUserId === userId || incident.involvedUserIds.includes(userId);
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

function formatDiscordTimestamp(isoDate: string): string {
  const seconds = Math.floor(Date.parse(isoDate) / 1000);
  return Number.isFinite(seconds) ? `<t:${seconds}:f>` : isoDate;
}

function formatShortDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function addUserFollowUp(
  id: string,
  userId: string,
  note: string,
): Promise<Incident | undefined> {
  return updateIncident(id, (current) => ({
    ...current,
    history: [
      ...current.history,
      {
        actorUserId: userId,
        action: "user_response",
        status: current.status,
        note,
        createdAt: new Date().toISOString(),
      },
    ],
  }));
}

async function postReviewMessage(incident: Incident) {
  const channel = await getWritableTextChannel(config.incidentReviewChannelId);

  const message = await channel.send({
    content: buildReviewMessageContent(incident),
    embeds: [buildIncidentEmbed(incident)],
    components: buildReviewActions(incident),
  });

  const thread = await message.startThread({
    name: `${formatIncidentId(incident.id)} - ${incident.event}`.slice(0, 100),
    autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
    reason: `Incident review thread for ${formatIncidentId(incident.id)}`,
  });

  return { message, threadId: thread.id };
}

function buildReviewMessageContent(incident: Incident): string {
  const lines = [
    `${config.stewardRoleId ? `<@&${config.stewardRoleId}> ` : ""}**New Incident Submitted:** ${formatIncidentId(incident.id)}`,
    `Open the thread on this card to discuss. Use the card buttons for review decisions.`,
  ];

  return lines.filter(Boolean).join("\n");
}

async function handleStringSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  if (interaction.customId === "status:select") {
    const incident = await getIncident(interaction.values[0]);
    if (!incident) {
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("Incident Not Found")
            .setColor(0xef4444)
            .setDescription("That incident could not be found."),
        ],
        components: [],
      });
      return;
    }

    const canView =
      canViewIncident(interaction.user.id, incident) ||
      canModerate(interaction.member, interaction.memberPermissions);

    if (!canView) {
      await interaction.reply({ content: "You can only view incidents you submitted or were involved in.", ephemeral: true });
      return;
    }

    const incidents = interaction.guildId
      ? await listIncidentsForUser(interaction.guildId, interaction.user.id)
      : [incident];

    await interaction.update({
      embeds: [buildStatusEmbed(incident)],
      components: buildStatusComponents(incident, incidents),
    });
    return;
  }

  const intakeCustomId = parseIntakeCustomId(interaction.customId);
  if (!intakeCustomId) {
    return;
  }

  const draft = getIntakeDraft(interaction.guildId, interaction.user.id);
  if (!draft) {
    await interaction.update({
      embeds: [buildInactiveIntakeEmbed("Incident Intake Expired", "Run `/incident submit` again to start a new report.")],
      components: [],
    });
    return;
  }

  if (intakeCustomId.draftId && intakeCustomId.draftId !== draft.id) {
    await interaction.update({
      embeds: [buildInactiveIntakeEmbed("Incident Intake Replaced", "Use the newest intake card or run `/incident submit` again.")],
      components: [],
    });
    return;
  }

  const field = intakeCustomId.action;
  if (field === "category") {
    draft.category = interaction.values[0];
    const defaults = getDefaultIntakeValues(draft.category);
    draft.impact = defaults.impact;
    draft.evidenceReadiness = defaults.evidenceReadiness ?? draft.evidenceReadiness;
    if (!getRacePhaseOptions(draft.category).some((option) => option.value === draft.racePhase)) {
      draft.racePhase = undefined;
    }
    if (shouldShowImpactSelect(draft.category) && !getIncidentImpactOptions(draft.category).some((option) => option.value === draft.impact)) {
      draft.impact = undefined;
    }
    if (shouldShowEvidenceSelect(draft.category) && !getEvidenceReadinessOptions(draft.category).some((option) => option.value === draft.evidenceReadiness)) {
      draft.evidenceReadiness = undefined;
    }
  } else if (field === "phase") {
    draft.racePhase = interaction.values[0];
  } else if (field === "impact") {
    draft.impact = interaction.values[0];
  } else if (field === "evidence") {
    draft.evidenceReadiness = interaction.values[0];
  }

  intakeDrafts.set(getIntakeKey(draft.guildId, interaction.user.id), draft);
  await interaction.update({
    embeds: [buildIntakeEmbed(draft)],
    components: buildIntakeComponents(draft),
  });
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId === "status:list") {
    if (!interaction.guildId) {
      await interaction.reply({ content: "Open the incident list from the server with `/incident status`.", ephemeral: false });
      return;
    }

    const incidents = await listIncidentsForUser(interaction.guildId, interaction.user.id);
    if (incidents.length === 0) {
      await interaction.update({
        embeds: [buildIncidentListEmbed(incidents)],
        components: [],
      });
      return;
    }

    await interaction.update({
      embeds: [buildStatusEmbed(incidents[0])],
      components: buildStatusComponents(incidents[0], incidents),
    });
    return;
  }

  if (interaction.customId.startsWith("followup:open:")) {
    const [, , id] = interaction.customId.split(":");
    const incident = await getIncident(id);

    if (!incident) {
      await interaction.reply({ content: `I could not find incident ${formatIncidentId(id)}.`, ephemeral: Boolean(interaction.guildId) });
      return;
    }

    if (!canViewIncident(interaction.user.id, incident)) {
      await interaction.reply({
        content: "You can only add follow-up to incidents you submitted or were involved in.",
        ephemeral: Boolean(interaction.guildId),
      });
      return;
    }

    await interaction.showModal(buildFollowUpModal(incident));
    return;
  }

  if (interaction.customId.startsWith("status:view:")) {
    const [, , id] = interaction.customId.split(":");
    const incident = await getIncident(id);

    if (!incident) {
      await interaction.reply({ content: `I could not find incident ${formatIncidentId(id)}.`, ephemeral: Boolean(interaction.guildId) });
      return;
    }

    const canView =
      canViewIncident(interaction.user.id, incident) ||
      Boolean(interaction.guildId && canModerate(interaction.member, interaction.memberPermissions));

    if (!canView) {
      await interaction.reply({
        content: "You can only view incidents you submitted or were involved in.",
        ephemeral: Boolean(interaction.guildId),
      });
      return;
    }

    const incidents = interaction.guildId
      ? await listIncidentsForUser(interaction.guildId, interaction.user.id)
      : [incident];

    await interaction.update({
      embeds: [buildStatusEmbed(incident)],
      components: buildStatusComponents(incident, incidents),
    });
    return;
  }

  const intakeCustomId = parseIntakeCustomId(interaction.customId);
  if (intakeCustomId) {
    const draft = getIntakeDraft(interaction.guildId, interaction.user.id);
    if (!draft) {
      await interaction.update({
        embeds: [buildInactiveIntakeEmbed("Incident Intake Expired", "Run `/incident submit` again to start a new report.")],
        components: [],
      });
      return;
    }

    if (intakeCustomId.draftId && intakeCustomId.draftId !== draft.id) {
      await interaction.update({
        embeds: [buildInactiveIntakeEmbed("Incident Intake Replaced", "Use the newest intake card or run `/incident submit` again.")],
        components: [],
      });
      return;
    }

    if (intakeCustomId.action === "submit") {
      if (!isIntakeComplete(draft)) {
        await interaction.reply({ content: getIncompleteIntakeMessage(draft), ephemeral: true });
        return;
      }

      await submitIncidentDraft(interaction, draft);
      return;
    }

    if (["details", "drivers", "set_video", "set_location", "set_summary"].includes(intakeCustomId.action)) {
      await interaction.showModal(buildIntakeDetailsModal(draft));
      return;
    }

    if (intakeCustomId.action === "reset") {
      if (!interaction.guildId) {
        return;
      }

      const nextDraft = createIntakeDraft(interaction.guildId, interaction.user.id);
      await interaction.update({
        embeds: [buildIntakeEmbed(nextDraft)],
        components: buildIntakeComponents(nextDraft),
      });
      return;
    }

    return;
  }

  const [scope, status, id] = interaction.customId.split(":");
  if (scope !== "incident" || !isIncidentStatus(status) || !id) {
    return;
  }

  if (!canModerate(interaction.member, interaction.memberPermissions)) {
    await interaction.reply({ content: "Only admins can update incidents.", ephemeral: true });
    return;
  }

  if (status === "under_review" || status === "closed") {
    await updateStatus(interaction, id, status);
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`incident-modal:${status}:${id}`)
    .setTitle(`${adminActionTitle(status)} ${formatIncidentId(id)}`);

  const note = new TextInputBuilder()
    .setCustomId("note")
    .setLabel(adminActionNoteLabel(status))
    .setPlaceholder(adminActionNotePlaceholder(status))
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1000)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(note));
  await interaction.showModal(modal);
}

function adminActionTitle(status: IncidentStatus): string {
  switch (status) {
    case "need_more_info":
      return "Request Info";
    case "no_action":
      return "No Action";
    case "penalty":
      return "Penalty";
    default:
      return formatStatus(status);
  }
}

function adminActionNoteLabel(status: IncidentStatus): string {
  switch (status) {
    case "need_more_info":
      return "What should the driver add?";
    case "no_action":
      return "Reason for no action";
    case "penalty":
      return "Penalty decision";
    default:
      return "Admin note";
  }
}

function adminActionNotePlaceholder(status: IncidentStatus): string {
  switch (status) {
    case "need_more_info":
      return "Example: Need a longer clip showing corner entry and exit.";
    case "no_action":
      return "Example: Racing incident; no avoidable contact found.";
    case "penalty":
      return "Example: 5-second penalty for avoidable contact.";
    default:
      return "Add the note users/admins should see.";
  }
}

async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId === "incident-submit") {
    await interaction.reply({ content: "This form is no longer active. Use `/incident submit` to open the intake card.", ephemeral: true });
    return;
  }

  if (
    interaction.customId === "intake-details" ||
    interaction.customId.startsWith("intake-details:") ||
    interaction.customId === "intake-drivers" ||
    interaction.customId.startsWith("intake-drivers:")
  ) {
    await handleIntakeDetailsModal(interaction);
    return;
  }

  if (interaction.customId.startsWith("intake-set:")) {
    await handleLegacyIntakeTextModal(interaction);
    return;
  }

  if (interaction.customId.startsWith("followup-submit:")) {
    await handleFollowUpModal(interaction);
    return;
  }

  const [scope, status, id] = interaction.customId.split(":");
  if (scope !== "incident-modal" || !isIncidentStatus(status) || !id) {
    return;
  }

  if (!canModerate(interaction.member, interaction.memberPermissions)) {
    await interaction.reply({ content: "Only admins can update incidents.", ephemeral: true });
    return;
  }

  const note = interaction.fields.getTextInputValue("note");
  await updateStatus(interaction, id, status, note);
}

function buildIntakeEmbed(draft: IntakeDraft): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("AERO Incident Intake")
    .setColor(getIntakeEmbedColor(draft))
    .setDescription(
      [
        formatIntakeSubmitStatus(draft),
        "Incidents are queued for admin review. Do not argue with other drivers during the race or session.",
        "",
        "Evidence should show a few seconds before and after the incident when possible.",
      ].join("\n"),
    )
    .addFields(
      { name: "Rules Selected", value: "\u200b", inline: false },
      { name: "Rule Area", value: getIncidentCategoryLabel(draft.category ?? "Not selected"), inline: true },
      { name: "Context", value: getRacePhaseLabel(draft.racePhase), inline: true },
      { name: "Impact", value: getIncidentImpactLabel(draft.impact), inline: true },
      { name: "Report Details", value: "\u200b", inline: false },
      { name: "Your Gamertag", value: draft.reporterGamertag ?? "Not added", inline: true },
      { name: "Video Link", value: formatDraftVideoLinkStatus(draft), inline: true },
      { name: "Time", value: draft.lapOrTime ?? "Not added", inline: true },
      { name: "Other Drivers", value: formatDraftDrivers(draft), inline: false },
      { name: "Summary", value: draft.description ?? "Not added", inline: false },
    );
}

function buildIntakeComponents(draft: IntakeDraft): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  const rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [
    buildSelectRow(buildIntakeCustomId(draft, "category"), "Rule area", incidentCategories, draft.category),
    buildSelectRow(buildIntakeCustomId(draft, "phase"), "Context", getRacePhaseOptions(draft.category), draft.racePhase, !draft.category),
  ];

  if (shouldShowImpactSelect(draft.category)) {
    rows.push(
      buildSelectRow(buildIntakeCustomId(draft, "impact"), "Impact / severity", getIncidentImpactOptions(draft.category), draft.impact, !draft.category),
    );
  }

  if (shouldShowEvidenceSelect(draft.category)) {
    rows.push(
      buildSelectRow(buildIntakeCustomId(draft, "evidence"), "Video status", getEvidenceReadinessOptions(draft.category), draft.evidenceReadiness, !draft.category),
    );
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(buildIntakeCustomId(draft, "details"))
        .setLabel("Details")
        .setStyle(getDetailsButtonStyle(draft)),
      new ButtonBuilder()
        .setCustomId(buildIntakeCustomId(draft, "submit"))
        .setLabel("Submit")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!isIntakeComplete(draft)),
    ),
  );

  return rows;
}

function buildIntakeCustomId(draft: IntakeDraft, action: string): string {
  return `intake:${draft.id}:${action}`;
}

function buildSelectRow(
  customId: string,
  placeholder: string,
  options: readonly { value: string; label: string; description: string }[],
  selectedValue?: string,
  disabled = false,
): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(disabled ? "Select rule area first" : selectedValue ? `${placeholder}: selected` : `Select ${placeholder.toLowerCase()}`)
      .setDisabled(disabled)
      .addOptions(
        options.map((option) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(option.label)
            .setDescription(option.description)
            .setValue(option.value)
            .setDefault(option.value === selectedValue),
        ),
      ),
  );
}

function buildIntakeDetailsModal(draft: IntakeDraft): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`intake-details:${draft.id}`)
    .setTitle("Incident Details");

  const reporterGamertag = new TextInputBuilder()
    .setCustomId("reporter_gamertag")
    .setLabel("Your gamertag")
    .setPlaceholder("Your gamertag")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(80)
    .setRequired(true);

  if (draft.reporterGamertag) {
    reporterGamertag.setValue(draft.reporterGamertag);
  }

  const drivers = new TextInputBuilder()
    .setCustomId("drivers")
    .setLabel("Other drivers, one per line")
    .setPlaceholder(["GridRunner88", "ApexShift7", "TrackLimit24"].join("\n"))
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1000)
    .setRequired(false);

  if (draft.drivers.length > 0) {
    drivers.setValue(draft.drivers.join("\n"));
  }

  const evidenceLink = new TextInputBuilder()
    .setCustomId("evidence_link")
    .setLabel("Video link")
    .setPlaceholder("Paste video URL")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(500)
    .setRequired(draft.evidenceReadiness !== "needs_upload" && draft.evidenceReadiness !== "no_clip");

  if (draft.evidenceLink) {
    evidenceLink.setValue(draft.evidenceLink);
  }

  const lapOrTime = new TextInputBuilder()
    .setCustomId("lap_or_time")
    .setLabel("Time in video")
    .setPlaceholder("0:42 in clip, Lap 12, T1")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(140)
    .setRequired(true);

  if (draft.lapOrTime) {
    lapOrTime.setValue(draft.lapOrTime);
  }

  const summary = new TextInputBuilder()
    .setCustomId("summary")
    .setLabel("What happened?")
    .setPlaceholder("Short summary for admins")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1800)
    .setRequired(true);

  if (draft.description) {
    summary.setValue(draft.description);
  }

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(reporterGamertag),
    new ActionRowBuilder<TextInputBuilder>().addComponents(drivers),
    new ActionRowBuilder<TextInputBuilder>().addComponents(evidenceLink),
    new ActionRowBuilder<TextInputBuilder>().addComponents(lapOrTime),
    new ActionRowBuilder<TextInputBuilder>().addComponents(summary),
  );
  return modal;
}

async function handleIntakeDetailsModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "Incident details can only be edited inside a server.", ephemeral: true });
    return;
  }

  const [, modalDraftId] = interaction.customId.split(":");
  const draft = getIntakeDraft(interaction.guildId, interaction.user.id);
  if (!draft) {
    await updateInactiveIntakeModalSource(interaction, "Incident Intake Expired", "Run `/incident submit` again to start a new report.");
    return;
  }

  if (modalDraftId && modalDraftId !== draft.id) {
    await updateInactiveIntakeModalSource(interaction, "Incident Intake Replaced", "Use the newest intake card or run `/incident submit` again.");
    return;
  }

  const reporterGamertag = getOptionalModalTextValue(interaction, "reporter_gamertag").trim();
  const drivers = getOptionalModalTextValue(interaction, "drivers");
  const evidenceLink = getOptionalModalTextValue(interaction, "evidence_link").trim();
  const lapOrTime = getOptionalModalTextValue(interaction, "lap_or_time").trim();
  const summary = getOptionalModalTextValue(interaction, "summary").trim();

  draft.reporterGamertag = reporterGamertag || undefined;
  draft.drivers = normalizeDrivers(drivers).slice(0, 12);
  if (interaction.customId.startsWith("intake-details:")) {
    draft.evidenceLink = evidenceLink || undefined;
    draft.lapOrTime = lapOrTime || undefined;
    draft.description = summary || undefined;
  }
  intakeDrafts.set(getIntakeKey(draft.guildId, interaction.user.id), draft);

  await updateIntakeModalSource(interaction, draft);
}

function getOptionalModalTextValue(interaction: ModalSubmitInteraction, customId: string): string {
  try {
    return interaction.fields.getTextInputValue(customId);
  } catch {
    return "";
  }
}

async function handleLegacyIntakeTextModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "Incident details can only be edited inside a server.", ephemeral: true });
    return;
  }

  const { draftId, field } = parseIntakeTextModalCustomId(interaction.customId);
  const draft = getIntakeDraft(interaction.guildId, interaction.user.id);
  if (!draft) {
    await updateInactiveIntakeModalSource(interaction, "Incident Intake Expired", "Run `/incident submit` again to start a new report.");
    return;
  }

  if (draftId && draftId !== draft.id) {
    await updateInactiveIntakeModalSource(interaction, "Incident Intake Replaced", "Use the newest intake card or run `/incident submit` again.");
    return;
  }

  const value = interaction.fields.getTextInputValue("value").trim();
  if (field === "video") {
    draft.evidenceLink = value || undefined;
  } else if (field === "location") {
    draft.lapOrTime = value || undefined;
  } else if (field === "summary") {
    draft.description = value || undefined;
  }

  intakeDrafts.set(getIntakeKey(draft.guildId, interaction.user.id), draft);
  await updateIntakeModalSource(interaction, draft);
}

async function updateIntakeModalSource(interaction: ModalSubmitInteraction, draft: IntakeDraft): Promise<void> {
  const payload = {
    embeds: [buildIntakeEmbed(draft)],
    components: buildIntakeComponents(draft),
  };

  if (interaction.isFromMessage()) {
    await interaction.update(payload);
    return;
  }

  await interaction.reply({
    ephemeral: true,
    ...payload,
  });
}

async function updateInactiveIntakeModalSource(interaction: ModalSubmitInteraction, title: string, description: string): Promise<void> {
  const payload = {
    embeds: [buildInactiveIntakeEmbed(title, description)],
    components: [],
  };

  if (interaction.isFromMessage()) {
    await interaction.update(payload);
    return;
  }

  await interaction.reply({
    ephemeral: true,
    ...payload,
  });
}

function buildFollowUpModal(incident: Incident): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`followup-submit:${incident.id}`)
    .setTitle(`Follow-Up ${formatIncidentId(incident.id)}`);

  const message = new TextInputBuilder()
    .setCustomId("message")
    .setLabel("Follow-up details")
    .setPlaceholder("Short update for admins")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1500)
    .setRequired(true);

  const evidenceLink = new TextInputBuilder()
    .setCustomId("evidence_link")
    .setLabel("Link")
    .setPlaceholder("Paste video URL")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(500)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(message),
    new ActionRowBuilder<TextInputBuilder>().addComponents(evidenceLink),
  );

  return modal;
}

async function submitIncidentDraft(interaction: ButtonInteraction, draft: Required<IntakeDraft>): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "Incidents can only be submitted inside a server.", ephemeral: true });
    return;
  }

  await interaction.deferUpdate();
  await assertReviewChannelReady();

  const involvedDriversText = draft.drivers.join("\n");
  const formattedDriversText = formatDriverList(involvedDriversText) || "Not provided";
  const involvedUserIds = parseDiscordUserIds(involvedDriversText);

  const incident = await createIncident({
    guildId: interaction.guildId,
    submitterUserId: interaction.user.id,
    reporterGamertag: draft.reporterGamertag,
    category: draft.category,
    racePhase: draft.racePhase,
    impact: draft.impact,
    evidenceReadiness: draft.evidenceReadiness,
    involvedUserIds,
    involvedDriversText: formattedDriversText,
    event: "Current AERO Event",
    lapOrTime: draft.lapOrTime,
    description: draft.description,
    evidenceUrl: draft.evidenceLink,
  });

  const reviewTarget = await postReviewMessage(incident);
  await updateIncident(incident.id, (current) => ({
    ...current,
    reviewChannelId: reviewTarget.message.channelId,
    reviewMessageId: reviewTarget.message.id,
    reviewThreadId: reviewTarget.threadId,
  }));
  const incidents = await listIncidentsForUser(interaction.guildId, interaction.user.id);

  await interaction.editReply({
    embeds: [buildSubmissionReceiptEmbed(incident)],
    components: buildStatusComponents(incident, incidents),
    content: "",
  });

  intakeDrafts.delete(getIntakeKey(interaction.guildId, interaction.user.id));
}

async function handleFollowUpModal(interaction: ModalSubmitInteraction): Promise<void> {
  const [, id] = interaction.customId.split(":");
  const incident = await getIncident(id);

  if (!incident) {
    await interaction.reply({ content: `I could not find incident ${formatIncidentId(id)}.`, ephemeral: Boolean(interaction.guildId) });
    return;
  }

  if (!canViewIncident(interaction.user.id, incident)) {
    await interaction.reply({
      content: "You can only add follow-up to incidents you submitted or were involved in.",
      ephemeral: Boolean(interaction.guildId),
    });
    return;
  }

  const message = interaction.fields.getTextInputValue("message");
  const evidenceLink = interaction.fields.getTextInputValue("evidence_link") || undefined;
  const note = evidenceLink ? `${message}\nEvidence: ${evidenceLink}` : message;

  const updated = await addUserFollowUp(id, interaction.user.id, note);
  const latestIncident = updated ?? incident;
  await refreshReviewMessage(latestIncident);

  if (interaction.isFromMessage()) {
    const incidents = interaction.guildId
      ? await listIncidentsForUser(interaction.guildId, interaction.user.id)
      : [latestIncident];

    await interaction.update({
      embeds: [buildStatusEmbed(latestIncident)],
      components: buildStatusComponents(latestIncident, incidents),
      content: "",
    });
    return;
  }

  await interaction.reply({
    content: `Your follow-up was added to ${formatIncidentId(id)} for admin review.`,
    ephemeral: Boolean(interaction.guildId),
  });
}

async function updateStatus(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  id: string,
  status: IncidentStatus,
  note?: string,
): Promise<void> {
  const incident = await updateIncident(id, (current) => ({
    ...current,
    status,
    decisionNote: note ?? current.decisionNote,
    history: [
      ...current.history,
      {
        actorUserId: interaction.user.id,
        action: `set_${status}`,
        status,
        note,
        createdAt: new Date().toISOString(),
      },
    ],
  }));

  if (!incident) {
    await interaction.reply({ content: `I could not find incident ${id}.`, ephemeral: true });
    return;
  }

  await refreshReviewMessage(incident);
  await notifyParticipants(incident);
  await maybePostIncidentLog(incident);

  const content = `${formatIncidentId(incident.id)} updated to ${formatStatus(incident.status)}.`;
  if (interaction.isButton()) {
    await interaction.reply({ content, ephemeral: true });
  } else {
    await interaction.reply({ content, ephemeral: true });
  }
}

async function refreshReviewMessage(incident: Incident): Promise<void> {
  if (!incident.reviewChannelId || !incident.reviewMessageId) {
    return;
  }

  const channel = await client.channels.fetch(incident.reviewChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    return;
  }

  const message = await (channel as TextChannel).messages.fetch(incident.reviewMessageId);
  await message.edit({
    embeds: [buildIncidentEmbed(incident)],
    components: buildReviewActions(incident),
  });
}

async function notifyParticipants(incident: Incident): Promise<void> {
  const userIds = Array.from(new Set([incident.submitterUserId, ...incident.involvedUserIds]));

  await Promise.allSettled(
    userIds.map(async (userId) => {
      const user = await client.users.fetch(userId);
      await user.send(buildUserStatusMessage(incident));
    }),
  );
}

async function maybePostIncidentLog(incident: Incident): Promise<void> {
  if (!config.incidentLogChannelId || !loggedStatuses.has(incident.status)) {
    return;
  }

  if (incident.history.some((event) => event.action === `logged_${incident.status}`)) {
    return;
  }

  const channel = await client.channels.fetch(config.incidentLogChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    console.warn("INCIDENT_LOG_CHANNEL_ID is set but is not an accessible text channel.");
    return;
  }

  await channel.send({
    embeds: [buildLogEmbed(incident)],
  });

  await updateIncident(incident.id, (current) => ({
    ...current,
    history: [
      ...current.history,
      {
        actorUserId: client.user?.id ?? "bot",
        action: `logged_${incident.status}`,
        status: incident.status,
        createdAt: new Date().toISOString(),
      },
    ],
  }));
}

function createIntakeDraft(guildId: string, userId: string): IntakeDraft {
  const draft: IntakeDraft = {
    id: createDraftId(),
    guildId,
    userId,
    drivers: [],
    createdAt: Date.now(),
  };
  intakeDrafts.set(getIntakeKey(guildId, userId), draft);
  return draft;
}

function createDraftId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseIntakeCustomId(customId: string): ParsedIntakeCustomId | undefined {
  if (!customId.startsWith("intake:")) {
    return undefined;
  }

  const parts = customId.split(":");
  if (parts.length === 2) {
    return { action: parts[1] };
  }

  return { draftId: parts[1], action: parts[2] };
}

function parseIntakeTextModalCustomId(customId: string): { draftId?: string; field: "video" | "location" | "summary" } {
  const parts = customId.split(":");
  if (parts.length === 2) {
    return { field: parts[1] as "video" | "location" | "summary" };
  }

  return { draftId: parts[1], field: parts[2] as "video" | "location" | "summary" };
}

function buildInactiveIntakeEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(0x6b7280)
    .setDescription(description);
}

function getIntakeDraft(guildId: string | null, userId: string): IntakeDraft | undefined {
  if (!guildId) {
    return undefined;
  }

  const draft = intakeDrafts.get(getIntakeKey(guildId, userId));
  if (!draft) {
    return undefined;
  }

  draft.drivers ??= [];

  const maxAgeMs = 30 * 60 * 1000;
  if (Date.now() - draft.createdAt > maxAgeMs) {
    intakeDrafts.delete(getIntakeKey(guildId, userId));
    return undefined;
  }

  return draft;
}

function getIntakeKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

function isIntakeComplete(draft: IntakeDraft): draft is Required<IntakeDraft> {
  const hasImpact = !shouldShowImpactSelect(draft.category) || Boolean(draft.impact);
  const hasEvidence = !shouldShowEvidenceSelect(draft.category) || Boolean(draft.evidenceReadiness);
  const needsVideo = draft.evidenceReadiness !== "needs_upload" && draft.evidenceReadiness !== "no_clip";
  return Boolean(
      draft.category &&
      draft.reporterGamertag &&
      draft.racePhase &&
      hasImpact &&
      hasEvidence &&
      (!needsVideo || hasValidEvidenceLink(draft)) &&
      draft.lapOrTime &&
      draft.description,
  );
}

function getIncompleteIntakeMessage(draft: IntakeDraft): string {
  if (draft.evidenceLink && !isValidHttpUrl(draft.evidenceLink)) {
    return "The video link needs to be a valid full URL, like `https://...`. Update the Video Link field and try again.";
  }

  return "Complete the required incident details first.";
}

function formatIntakeSubmitStatus(draft: IntakeDraft): string {
  const missing = getMissingIntakeItems(draft);
  if (missing.length === 0) {
    return "**Ready to submit.** Review the details below, then submit the incident.";
  }

  return [
    "**Cannot submit yet.**",
    `Needs: ${missing.join(", ")}.`,
  ].join("\n");
}

function getIntakeEmbedColor(draft: IntakeDraft): number {
  if (draft.evidenceLink && !isValidHttpUrl(draft.evidenceLink)) {
    return 0xef4444;
  }

  return isIntakeComplete(draft) ? 0x10b981 : 0x2563eb;
}

function getMissingIntakeItems(draft: IntakeDraft): string[] {
  const missing: string[] = [];
  const hasImpact = !shouldShowImpactSelect(draft.category) || Boolean(draft.impact);
  const hasEvidence = !shouldShowEvidenceSelect(draft.category) || Boolean(draft.evidenceReadiness);
  const needsVideo = draft.evidenceReadiness !== "needs_upload" && draft.evidenceReadiness !== "no_clip";

  if (!draft.category) missing.push("rule area");
  if (!draft.racePhase) missing.push("context");
  if (!hasImpact) missing.push("impact");
  if (!hasEvidence) missing.push("video status");
  if (!draft.reporterGamertag) missing.push("your gamertag");
  if (needsVideo && !draft.evidenceLink) missing.push("video link");
  if (draft.evidenceLink && !isValidHttpUrl(draft.evidenceLink)) missing.push("valid video link");
  if (!draft.lapOrTime) missing.push("time");
  if (!draft.description) missing.push("summary");

  return missing;
}

async function assertReviewChannelReady(): Promise<void> {
  await getWritableTextChannel(config.incidentReviewChannelId);
}

async function getWritableTextChannel(channelId: string): Promise<TextChannel> {
  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error("INCIDENT_REVIEW_CHANNEL_ID must point to a server text channel the bot can access.");
  }

  const guild = channel.guild;
  const me = guild.members.me ?? (await guild.members.fetchMe());
  const permissions = channel.permissionsFor(me);
  const missing = [
    [PermissionFlagsBits.ViewChannel, "View Channel"],
    [PermissionFlagsBits.SendMessages, "Send Messages"],
    [PermissionFlagsBits.EmbedLinks, "Embed Links"],
    [PermissionFlagsBits.ReadMessageHistory, "Read Message History"],
    [PermissionFlagsBits.CreatePublicThreads, "Create Public Threads"],
    [PermissionFlagsBits.SendMessagesInThreads, "Send Messages in Threads"],
  ]
    .filter(([permission]) => !permissions?.has(permission as bigint))
    .map(([, label]) => label);

  if (missing.length > 0) {
    throw new Error(`Bot is missing permissions in the review channel: ${missing.join(", ")}.`);
  }

  return channel;
}

async function describeChannelAccess(channelId: string, label: string): Promise<string> {
  try {
    const channel = await getWritableTextChannel(channelId);
    return `${label}: OK (${channel.name})`;
  } catch (error) {
    return `${label}: ${error instanceof Error ? error.message : "unknown error"}`;
  }
}

function formatInteractionError(error: unknown): string {
  if (error instanceof Error && error.message.includes("Bot is missing permissions")) {
    return error.message;
  }

  if (error instanceof Error && error.message.includes("INCIDENT_REVIEW_CHANNEL_ID")) {
    return error.message;
  }

  if (typeof error === "object" && error && "code" in error && error.code === 50001) {
    return "The bot cannot access the configured review channel. Give the bot role access to that private channel, or update INCIDENT_REVIEW_CHANNEL_ID.";
  }

  return "Something went wrong while handling that incident action.";
}

function isIncidentStatus(value: string | undefined): value is IncidentStatus {
  return incidentStatuses.includes(value as IncidentStatus);
}

function parseDiscordUserIds(value: string): string[] {
  const ids = new Set<string>();
  const mentionPattern = /<@!?(\d{17,20})>/g;
  const idPattern = /\b\d{17,20}\b/g;

  for (const match of value.matchAll(mentionPattern)) {
    ids.add(match[1]);
  }

  for (const match of value.matchAll(idPattern)) {
    ids.add(match[0]);
  }

  return Array.from(ids);
}

function formatDriverList(value: string): string {
  const drivers = normalizeDrivers(value);

  return drivers.length > 0 ? drivers.map((driver) => `- ${driver}`).join("\n") : value.trim();
}

function normalizeDrivers(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((driver) => driver.trim())
        .filter(Boolean),
    ),
  );
}

function formatDraftDrivers(draft: IntakeDraft): string {
  if (draft.drivers.length === 0) {
    return "None added";
  }

  return draft.drivers.map((driver) => `- ${driver}`).join("\n");
}

function formatDraftVideoLinkStatus(draft: IntakeDraft): string {
  if (!draft.evidenceLink) {
    return "Not added";
  }

  return isValidHttpUrl(draft.evidenceLink)
    ? draft.evidenceLink
    : `Invalid link\n${truncateFieldValue(draft.evidenceLink, 120)}\nUse a full \`https://...\` URL`;
}

function truncateFieldValue(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function getDetailsButtonStyle(draft: IntakeDraft): ButtonStyle {
  if (draft.evidenceLink && !isValidHttpUrl(draft.evidenceLink)) {
    return ButtonStyle.Danger;
  }

  const needsVideo = draft.evidenceReadiness !== "needs_upload" && draft.evidenceReadiness !== "no_clip";
  const hasRequiredDetails = Boolean(
    draft.reporterGamertag &&
      (!needsVideo || draft.evidenceLink) &&
      draft.lapOrTime &&
      draft.description,
  );

  return hasRequiredDetails ? ButtonStyle.Success : ButtonStyle.Secondary;
}

function hasValidEvidenceLink(draft: IntakeDraft): boolean {
  return Boolean(draft.evidenceLink && isValidHttpUrl(draft.evidenceLink));
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function canModerate(
  member: GuildMember | APIInteractionGuildMember | null,
  permissions?: Readonly<PermissionsBitField> | null,
): boolean {
  if (!member || typeof member !== "object") {
    return false;
  }

  if (config.stewardRoleId) {
    const roles = member.roles;
    if (Array.isArray(roles) && roles.includes(config.stewardRoleId)) {
      return true;
    }

    if (!Array.isArray(roles) && roles.cache.has(config.stewardRoleId)) {
      return true;
    }
  }

  return permissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

await client.login(config.discordToken);
