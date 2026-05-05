import { SlashCommandBuilder } from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("incident")
    .setDescription("Submit and track racing incidents.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("submit")
        .setDescription("Open the AERO incident intake panel."),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("setup-check")
        .setDescription("Check whether the bot can access configured private channels."),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription("Open your incident status list."),
    )
    .toJSON(),
];
