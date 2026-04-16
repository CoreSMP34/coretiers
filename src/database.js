// src/database.js
const fs   = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");
const DB_FILE  = path.join(DATA_DIR, "tierlist.json");

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ ratings: [], tickets: [], queues: {}, testers: {}, profiles: {} }, null, 2));
  }
  const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  if (!data.queues)   data.queues   = {};
  if (!data.testers)  data.testers  = {};
  if (!data.profiles) data.profiles = {};
  return data;
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function init() {}

// ── Profiles (IGN + Continent) ────────────────────────────────

function setProfile(discordId, { ign, continent }) {
  const db = load();
  db.profiles[discordId] = { ign, continent };
  save(db);
}

function getProfile(discordId) {
  return load().profiles[discordId] ?? null;
}

// ── Ratings ───────────────────────────────────────────────────

function setRating({ discordId, username, ign, continent, gamemode, tier, ratedBy, notes }) {
  const db = load();
  const i  = db.ratings.findIndex(r => r.discord_id === discordId && r.gamemode === gamemode);
  const entry = {
    discord_id: discordId,
    username,
    ign:        ign       ?? username,
    continent:  continent ?? "NA",
    gamemode,
    tier,
    rated_by:  ratedBy,
    rated_at:  new Date().toISOString(),
    notes:     notes ?? null,
  };
  if (i >= 0) db.ratings[i] = entry; else db.ratings.push(entry);
  save(db);
}

function getPlayerRatings(discordId) {
  return load().ratings.filter(r => r.discord_id === discordId);
}

function getGamemodeTierlist(gamemode) {
  const tierOrder = ["HT1","LT1","HT2","LT2","HT3","LT3","HT4","LT4","HT5","LT5","UNRANKED"];
  return load().ratings
    .filter(r => r.gamemode === gamemode)
    .sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier));
}

// ── Tickets ───────────────────────────────────────────────────

function createTicket({ channelId, targetId, targetName, testerId }) {
  const db = load();
  db.tickets.push({ channel_id: channelId, target_id: targetId, target_name: targetName, tester_id: testerId, created_at: new Date().toISOString(), closed: false });
  save(db);
}

function getTicketByChannel(channelId) {
  return load().tickets.find(t => t.channel_id === channelId && !t.closed) ?? null;
}

function closeTicket(channelId) {
  const db = load();
  const t  = db.tickets.find(t => t.channel_id === channelId);
  if (t) t.closed = true;
  save(db);
}

// ── Queues ────────────────────────────────────────────────────

function getQueue(channelId) {
  return load().queues[channelId] ?? null;
}

function initQueue(channelId, gamemode, pinnedMessageId) {
  const db = load();
  if (!db.queues[channelId]) {
    db.queues[channelId] = { gamemode, pinnedMessageId, players: [] };
  } else {
    db.queues[channelId].pinnedMessageId = pinnedMessageId;
    db.queues[channelId].gamemode        = gamemode;
  }
  save(db);
}

function joinQueue(channelId, { id, username }) {
  const db = load();
  if (!db.queues[channelId])                              return "no_queue";
  if (db.queues[channelId].players.find(p => p.id === id)) return "already_in";
  if (db.queues[channelId].players.length >= 20)          return "full";
  db.queues[channelId].players.push({ id, username, joinedAt: new Date().toISOString() });
  save(db);
  return "ok";
}

function leaveQueue(channelId, userId) {
  const db = load();
  if (!db.queues[channelId]) return false;
  db.queues[channelId].players = db.queues[channelId].players.filter(p => p.id !== userId);
  save(db);
  return true;
}

function claimFromQueue(channelId) {
  const db = load();
  if (!db.queues[channelId] || !db.queues[channelId].players.length) return null;
  const player = db.queues[channelId].players.shift();
  save(db);
  return player;
}

function setQueuePinnedId(channelId, messageId) {
  const db = load();
  if (db.queues[channelId]) { db.queues[channelId].pinnedMessageId = messageId; save(db); }
}

// ── Testers ───────────────────────────────────────────────────

function getAvailableTesters(channelId) {
  return load().testers[channelId] ?? [];
}

function toggleTester(channelId, { id, username }) {
  const db = load();
  if (!db.testers[channelId]) db.testers[channelId] = [];
  const exists = db.testers[channelId].find(t => t.id === id);
  if (exists) {
    db.testers[channelId] = db.testers[channelId].filter(t => t.id !== id);
    save(db);
    return "unavailable";
  }
  db.testers[channelId].push({ id, username });
  save(db);
  return "available";
}

module.exports = {
  init, setProfile, getProfile,
  setRating, getPlayerRatings, getGamemodeTierlist,
  createTicket, getTicketByChannel, closeTicket,
  getQueue, initQueue, joinQueue, leaveQueue, claimFromQueue, setQueuePinnedId,
  getAvailableTesters, toggleTester,
};
