// src/deploy-commands.js
require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const { TIERS, GAMEMODES, CONTINENTS } = require("./constants");

const commands = [

  new SlashCommandBuilder()
    .setName("setupqueue")
    .setDescription("Set up a live queue in this channel (Admin only)")
    .addStringOption(opt =>
      opt.setName("gamemode").setDescription("Gamemode for this queue").setRequired(false)
        .addChoices(...GAMEMODES.map(g => ({ name: g.name, value: g.value }))))
    .addBooleanOption(opt =>
      opt.setName("open").setDescription("Start open? (default: true)").setRequired(false))
    .toJSON(),

  new SlashCommandBuilder()
    .setName("openqueue")
    .setDescription("Open the queue in this channel")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("closequeue")
    .setDescription("Close the queue in this channel")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("test")
    .setDescription("Open a test ticket for a player manually")
    .addUserOption(opt => opt.setName("player").setDescription("The player to test").setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName("rate")
    .setDescription("Assign a tier to a tested player")
    .addUserOption(opt => opt.setName("player").setDescription("The player to rate").setRequired(true))
    .addStringOption(opt =>
      opt.setName("gamemode").setDescription("Which gamemode?").setRequired(true)
        .addChoices(...GAMEMODES.map(g => ({ name: g.name, value: g.value }))))
    .addStringOption(opt =>
      opt.setName("tier").setDescription("Which tier?").setRequired(true)
        .addChoices(...TIERS.map(t => ({ name: t, value: t }))))
    .addStringOption(opt => opt.setName("ign").setDescription("Player's Minecraft IGN").setRequired(true))
    .addStringOption(opt =>
      opt.setName("continent").setDescription("Player's continent/region").setRequired(true)
        .addChoices(...CONTINENTS.map(c => ({ name: c.name, value: c.value }))))
    .addStringOption(opt => opt.setName("notes").setDescription("Optional notes").setRequired(false))
    .toJSON(),

  new SlashCommandBuilder()
    .setName("lookup")
    .setDescription("Look up all tiers for a player")
    .addUserOption(opt => opt.setName("player").setDescription("The player to look up").setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName("tierlist")
    .setDescription("Display the full tierlist for a gamemode")
    .addStringOption(opt =>
      opt.setName("gamemode").setDescription("Which gamemode?").setRequired(true)
        .addChoices(...GAMEMODES.map(g => ({ name: g.name, value: g.value }))))
    .toJSON(),

  new SlashCommandBuilder()
    .setName("closeticket")
    .setDescription("Close and delete the current test ticket")
    .toJSON(),
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  console.log("Registering slash commands...");
  await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
  console.log("✅ Slash commands registered!");
})();
