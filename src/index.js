// src/index.js
require("dotenv").config();
const fs   = require("fs");
const path = require("path");
const {
  Client, GatewayIntentBits, PermissionFlagsBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType,
} = require("discord.js");

const db = require("./database");
const { TIERS, TIER_COLORS, TIER_EMOJIS, TIER_POINTS, GAMEMODES, GAMEMODE_EMOJIS, CONTINENTS } = require("./constants");

fs.mkdirSync(path.join(__dirname, "../data"), { recursive: true });
db.init();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

// ── Helpers ───────────────────────────────────────────────────

function isTester(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const roleId = process.env.TESTER_ROLE_ID;
  if (roleId) return member.roles.cache.has(roleId);
  return member.permissions.has(PermissionFlagsBits.ManageChannels);
}

function gamemodeFromChannel(channelName) {
  const n = channelName.toLowerCase();
  if (n.includes("sword"))   return "sword";
  if (n.includes("mace"))    return "mace";
  if (n.includes("pot"))     return "pot";
  if (n.includes("uhc"))     return "uhc";
  if (n.includes("crystal")) return "crystal";
  if (n.includes("smp"))     return "smp";
  if (n.includes("axe"))     return "axe";
  return null;
}

function getTotalPoints(ratings) {
  return ratings.reduce((sum, r) => sum + (TIER_POINTS[r.tier] ?? 0), 0);
}

function getRankLabel(points) {
  if (points >= 400) return "Combat Legend";
  if (points >= 280) return "Combat Master";
  if (points >= 180) return "Combat Ace";
  if (points >= 100) return "Veteran";
  if (points >=  50) return "Experienced";
  if (points >    0) return "Beginner";
  return "Unranked";
}

// ── Queue Embed ───────────────────────────────────────────────

function buildQueueEmbed(channelId, gamemode, isOpen) {
  const queue   = db.getQueue(channelId);
  const testers = db.getAvailableTesters(channelId);
  const players = queue?.players ?? [];
  const gmName  = GAMEMODES.find(g => g.value === gamemode)?.name ?? gamemode;
  const gEmoji  = GAMEMODE_EMOJIS[gamemode] ?? "🎮";

  return new EmbedBuilder()
    .setTitle(`${gEmoji} ${gmName} Testing Queue`)
    .setColor(isOpen ? 0x00C853 : 0xFF4444)
    .setTimestamp()
    .setFooter({ text: "CoreTiers Bot • Updates live" })
    .addFields(
      { name: "📋 Status", value: isOpen ? "🟢 **OPEN**" : "🔴 **CLOSED**", inline: true },
      {
        name: `✅ Available Testers (${testers.length})`,
        value: testers.length ? testers.map(t => `• ${t.username}`).join("\n") : "None",
        inline: true,
      },
      {
        name: `⏳ Queue (${players.length}/20)`,
        value: players.length ? players.map((p, i) => `${i + 1}. ${p.username}`).join("\n") : "No players in queue.",
        inline: false,
      },
    );
}

function buildQueueButtons(isOpen) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("queue_join").setLabel("Join Queue").setStyle(ButtonStyle.Primary).setEmoji("⏳").setDisabled(!isOpen),
    new ButtonBuilder().setCustomId("queue_leave").setLabel("Leave Queue").setStyle(ButtonStyle.Secondary).setEmoji("🚪"),
    new ButtonBuilder().setCustomId("tester_toggle").setLabel("Toggle Available").setStyle(ButtonStyle.Success).setEmoji("✅"),
    new ButtonBuilder().setCustomId("queue_claim").setLabel("Claim Next").setStyle(ButtonStyle.Danger).setEmoji("⚔️"),
  );
}

async function refreshQueueMessage(channel, isOpen) {
  const queue = db.getQueue(channel.id);
  if (!queue) return;
  const embed = buildQueueEmbed(channel.id, queue.gamemode, isOpen);
  const row   = buildQueueButtons(isOpen);
  try {
    const msg = await channel.messages.fetch(queue.pinnedMessageId);
    await msg.edit({ embeds: [embed], components: [row] });
  } catch (_) {
    const msg = await channel.send({ embeds: [embed], components: [row] });
    await msg.pin().catch(() => {});
    db.setQueuePinnedId(channel.id, msg.id);
  }
}

// ── Profile Embed ─────────────────────────────────────────────

function buildProfileEmbed(user, ratings) {
  const points    = getTotalPoints(ratings);
  const label     = getRankLabel(points);
  const profile   = ratings[0];
  const ign       = profile?.ign       ?? user.username;
  const continent = profile?.continent ?? "??";

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ ${ign}'s PvP Profile`)
    .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(ign)}/128`)
    .setColor(ratings.length ? TIER_COLORS[ratings[0].tier] : 0x607D8B)
    .setFooter({ text: "CoreTiers Bot" })
    .setTimestamp()
    .addFields(
      { name: "Discord",   value: `<@${user.id}>`,               inline: true },
      { name: "Region",    value: `\`${continent}\``,            inline: true },
      { name: "Rank",      value: `**${label}** (${points} pts)`, inline: true },
    );

  if (!ratings.length) {
    embed.setDescription("This player has no ratings yet.");
    return embed;
  }

  const lines = ratings.map(r => {
    const gmName = GAMEMODES.find(g => g.value === r.gamemode)?.name ?? r.gamemode;
    return `${GAMEMODE_EMOJIS[r.gamemode] ?? "🎮"} **${gmName}** — ${TIER_EMOJIS[r.tier] ?? ""} **${r.tier}**` +
           (r.notes ? `\n> *${r.notes}*` : "");
  });

  embed.addFields({ name: "Tiers", value: lines.join("\n") });
  return embed;
}

// ── Slash Commands ────────────────────────────────────────────

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, guild, member, channel } = interaction;

  // /setupqueue
  if (commandName === "setupqueue") {
    if (!member.permissions.has(PermissionFlagsBits.ManageChannels) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ You need **Manage Channels** permission.", ephemeral: true });
    }
    const gamemode = interaction.options.getString("gamemode") ?? gamemodeFromChannel(channel.name);
    if (!gamemode) return interaction.reply({ content: "❌ Could not detect gamemode. Use the `gamemode` option.", ephemeral: true });
    const isOpen = interaction.options.getBoolean("open") ?? true;
    const msg    = await channel.send({ embeds: [buildQueueEmbed(channel.id, gamemode, isOpen)], components: [buildQueueButtons(isOpen)] });
    await msg.pin().catch(() => {});
    db.initQueue(channel.id, gamemode, msg.id);
    return interaction.reply({ content: `✅ Queue set up for **${gamemode}**!`, ephemeral: true });
  }

  // /openqueue
  if (commandName === "openqueue") {
    if (!isTester(member)) return interaction.reply({ content: "❌ Testers only.", ephemeral: true });
    await refreshQueueMessage(channel, true);
    return interaction.reply({ content: "✅ Queue is now **open**!", ephemeral: true });
  }

  // /closequeue
  if (commandName === "closequeue") {
    if (!isTester(member)) return interaction.reply({ content: "❌ Testers only.", ephemeral: true });
    await refreshQueueMessage(channel, false);
    return interaction.reply({ content: "🔒 Queue is now **closed**.", ephemeral: true });
  }

  // /test
  if (commandName === "test") {
    if (!isTester(member)) return interaction.reply({ content: "❌ You need the **Tester** role.", ephemeral: true });
    const target = interaction.options.getUser("player");
    let ticketChannel;
    try {
      ticketChannel = await guild.channels.create({
        name: `test-${target.username.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        type: ChannelType.GuildText,
        parent: process.env.TICKET_CATEGORY_ID || null,
        permissionOverwrites: [
          { id: guild.roles.everyone, deny:  [PermissionFlagsBits.ViewChannel] },
          { id: target.id,            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: member.id,            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: client.user.id,       allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
        ],
      });
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "❌ Failed to create ticket channel.", ephemeral: true });
    }
    db.createTicket({ channelId: ticketChannel.id, targetId: target.id, targetName: target.username, testerId: member.id });

    const welcomeEmbed = new EmbedBuilder()
      .setTitle("⚔️ PvP Test Ticket")
      .setDescription(
        `Welcome <@${target.id}>, you're being tested by <@${member.id}>!\n\n` +
        `**Tester:** When done, use:\n` +
        `\`/rate player:@${target.username} gamemode:<mode> tier:<tier> ign:<minecraft_name> continent:<region>\`\n\n` +
        `**Make sure to fill in the IGN and Continent fields!**`
      )
      .setColor(0xFFD700)
      .addFields(
        { name: "🎮 Gamemodes", value: GAMEMODES.map(g => `${GAMEMODE_EMOJIS[g.value]} ${g.name}`).join("\n"), inline: true },
        { name: "🏅 Tiers",     value: TIERS.slice(0, 6).map(t => `${TIER_EMOJIS[t]} ${t}`).join("\n"), inline: true },
        { name: "\u200b",       value: TIERS.slice(6).map(t => `${TIER_EMOJIS[t]} ${t}`).join("\n"),   inline: true },
      )
      .setFooter({ text: "Use /closeticket to close." }).setTimestamp();

    const closeBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("close_ticket").setLabel("🔒 Close Ticket").setStyle(ButtonStyle.Danger)
    );
    await ticketChannel.send({ content: `<@${target.id}> <@${member.id}>`, embeds: [welcomeEmbed], components: [closeBtn] });
    return interaction.reply({ content: `✅ Ticket created: ${ticketChannel}`, ephemeral: true });
  }

  // /rate
  if (commandName === "rate") {
    if (!isTester(member)) return interaction.reply({ content: "❌ Testers only.", ephemeral: true });
    const target    = interaction.options.getUser("player");
    const gamemode  = interaction.options.getString("gamemode");
    const tier      = interaction.options.getString("tier");
    const ign       = interaction.options.getString("ign");
    const continent = interaction.options.getString("continent");
    const notes     = interaction.options.getString("notes") ?? null;

    db.setRating({
      discordId: target.id,
      username:  target.username,
      ign,
      continent,
      gamemode,
      tier,
      ratedBy:   member.user.username,
      notes,
    });

    const gmName     = GAMEMODES.find(g => g.value === gamemode)?.name ?? gamemode;
    const contName   = CONTINENTS.find(c => c.value === continent)?.name ?? continent;
    const allRatings = db.getPlayerRatings(target.id);
    const points     = getTotalPoints(allRatings);
    const rankLabel  = getRankLabel(points);

    const embed = new EmbedBuilder()
      .setTitle("✅ Rating Saved")
      .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(ign)}/64`)
      .setDescription(`**${ign}** has been rated in **${gmName}**`)
      .addFields(
        { name: "Tier",      value: `${TIER_EMOJIS[tier]} **${tier}**`, inline: true },
        { name: "Region",    value: `\`${continent}\` ${contName}`,     inline: true },
        { name: "Rated by",  value: `<@${member.id}>`,                  inline: true },
        { name: "Total pts", value: `**${points}** — ${rankLabel}`,     inline: true },
      )
      .setColor(TIER_COLORS[tier]).setTimestamp();

    if (notes) embed.addFields({ name: "Notes", value: notes });
    return interaction.reply({ embeds: [embed] });
  }

  // /lookup
  if (commandName === "lookup") {
    const target  = interaction.options.getUser("player");
    const ratings = db.getPlayerRatings(target.id);
    return interaction.reply({ embeds: [buildProfileEmbed(target, ratings)] });
  }

  // /tierlist
  if (commandName === "tierlist") {
    const gamemode = interaction.options.getString("gamemode");
    const rows     = db.getGamemodeTierlist(gamemode);
    const gmName   = GAMEMODES.find(g => g.value === gamemode)?.name ?? gamemode;

    const embed = new EmbedBuilder()
      .setTitle(`${GAMEMODE_EMOJIS[gamemode] ?? "🎮"} ${gmName} Tierlist`)
      .setColor(0x2B2D31).setFooter({ text: "CoreTiers Bot" }).setTimestamp();

    if (!rows.length) { embed.setDescription("No players rated yet."); return interaction.reply({ embeds: [embed] }); }

    const grouped = {};
    for (const r of rows) { if (!grouped[r.tier]) grouped[r.tier] = []; grouped[r.tier].push(`${r.ign ?? r.username} \`${r.continent ?? "??"}\``); }

    embed.addFields(TIERS.filter(t => grouped[t]?.length).map(t => ({
      name: `${TIER_EMOJIS[t]} ${t}`, value: grouped[t].map(u => `• ${u}`).join("\n"), inline: true,
    })));

    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === "closeticket") return handleCloseTicket(interaction);
});

// ── Buttons ───────────────────────────────────────────────────

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  const { customId, channel, user, guild } = interaction;

  let member = interaction.member;
  if (!member) { try { member = await guild.members.fetch(user.id); } catch (_) {} }

  // Toggle tester FIRST
  if (customId === "tester_toggle") {
    if (!isTester(member)) return interaction.reply({ content: "❌ Only testers can toggle availability.", ephemeral: true });
    const queue = db.getQueue(channel.id);
    if (!queue) return interaction.reply({ content: "❌ No queue in this channel.", ephemeral: true });
    const status = db.toggleTester(channel.id, { id: user.id, username: user.username });
    await interaction.reply({ content: status === "available" ? "✅ You are now **available**!" : "⏸️ You are now **unavailable**.", ephemeral: true });
    await refreshQueueMessage(channel, true);
    return;
  }

  if (customId === "queue_join") {
    const result = db.joinQueue(channel.id, { id: user.id, username: user.username });
    if (result === "no_queue")   return interaction.reply({ content: "❌ No queue here.", ephemeral: true });
    if (result === "already_in") return interaction.reply({ content: "⚠️ You're already in the queue!", ephemeral: true });
    if (result === "full")       return interaction.reply({ content: "❌ Queue is full (20/20)!", ephemeral: true });
    await interaction.reply({ content: "✅ You joined the queue!", ephemeral: true });
    await refreshQueueMessage(channel, true);
    return;
  }

  if (customId === "queue_leave") {
    db.leaveQueue(channel.id, user.id);
    await interaction.reply({ content: "👋 You left the queue.", ephemeral: true });
    await refreshQueueMessage(channel, true);
    return;
  }

  if (customId === "queue_claim") {
    if (!isTester(member)) return interaction.reply({ content: "❌ Only testers can claim.", ephemeral: true });
    const player = db.claimFromQueue(channel.id);
    if (!player) return interaction.reply({ content: "❌ Queue is empty!", ephemeral: true });
    const queue = db.getQueue(channel.id);
    let ticketChannel;
    try {
      ticketChannel = await guild.channels.create({
        name: `test-${player.username.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        type: ChannelType.GuildText,
        parent: process.env.TICKET_CATEGORY_ID || null,
        permissionOverwrites: [
          { id: guild.roles.everyone, deny:  [PermissionFlagsBits.ViewChannel] },
          { id: player.id,            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: user.id,              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: client.user.id,       allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
        ],
      });
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "❌ Failed to create ticket.", ephemeral: true });
    }
    db.createTicket({ channelId: ticketChannel.id, targetId: player.id, targetName: player.username, testerId: user.id });
    const gmName = GAMEMODES.find(g => g.value === queue?.gamemode)?.name ?? "Unknown";
    await ticketChannel.send({
      content: `<@${player.id}> <@${user.id}>`,
      embeds: [new EmbedBuilder()
        .setTitle("⚔️ PvP Test Ticket")
        .setDescription(
          `Welcome <@${player.id}>, being tested by <@${user.id}>!\nGamemode: **${gmName}**\n\n` +
          `When done:\n\`/rate player:@${player.username} gamemode:${queue?.gamemode} tier:<tier> ign:<mc_name> continent:<region>\``
        )
        .setColor(0xFFD700)
        .addFields({ name: "🏅 Tiers", value: TIERS.map(t => `${TIER_EMOJIS[t]} ${t}`).join("\n"), inline: true })
        .setFooter({ text: "Use /closeticket to close." }).setTimestamp()],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("close_ticket").setLabel("🔒 Close Ticket").setStyle(ButtonStyle.Danger)
      )],
    });
    await interaction.reply({ content: `✅ Claimed <@${player.id}>! → ${ticketChannel}`, ephemeral: true });
    await refreshQueueMessage(channel, true);
    return;
  }

  if (customId === "close_ticket") return handleCloseTicket(interaction);
});

// ── Close Ticket ──────────────────────────────────────────────

async function handleCloseTicket(interaction) {
  const ticket = db.getTicketByChannel(interaction.channelId);
  if (!ticket) return interaction.reply({ content: "❌ Not an active ticket.", ephemeral: true });
  const canClose = isTester(interaction.member) || interaction.user.id === ticket.target_id ||
                   interaction.member?.permissions.has(PermissionFlagsBits.Administrator);
  if (!canClose) return interaction.reply({ content: "❌ Only the tester or tested player can close this.", ephemeral: true });
  await interaction.reply({ content: "🔒 Closing in 5 seconds..." });
  db.closeTicket(interaction.channelId);
  setTimeout(async () => { try { await interaction.channel.delete(); } catch (_) {} }, 5000);
}

// ── Keep-alive ping (for hosting on free services) ────────────
const http = require("http");
http.createServer((req, res) => res.end("CoreTiers bot is running!")).listen(process.env.PORT || 3000);

// ── Ready ─────────────────────────────────────────────────────

client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setActivity("⚔️ CoreTiers PvP", { type: 3 });

  // Reconnect watchdog — restart if disconnected
  setInterval(() => {
    if (!client.ws.shards.size) {
      console.log("⚠️ No shards detected, reconnecting...");
      client.login(process.env.DISCORD_TOKEN);
    }
  }, 30000);
});

client.on("error", err => console.error("Client error:", err));
client.on("warn",  msg => console.warn("Warn:", msg));

client.login(process.env.DISCORD_TOKEN);
