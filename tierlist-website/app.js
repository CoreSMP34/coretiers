// app.js — CoreTiers Website

const GAMEMODES = [
  { id: "sword",   name: "Sword",   icon: "⚔️" },
  { id: "mace",    name: "Mace",    icon: "🪓" },
  { id: "pot",     name: "Pot",     icon: "🧪" },
  { id: "uhc",     name: "UHC",     icon: "💛" },
  { id: "crystal", name: "Crystal", icon: "💎" },
  { id: "smp",     name: "SMP",     icon: "🌍" },
  { id: "axe",     name: "Axe",     icon: "🪓" },
];

// MCTiers-style points: HT > LT at each level, tier 1 = best
const TIER_POINTS = {
  HT1: 100, LT1: 88,
  HT2: 76,  LT2: 65,
  HT3: 54,  LT3: 44,
  HT4: 34,  LT4: 25,
  HT5: 16,  LT5: 8,
  UNRANKED: 0,
};

const TIER_ORDER = ["HT1","LT1","HT2","LT2","HT3","LT3","HT4","LT4","HT5","LT5","UNRANKED"];

const TIER_ICONS = {
  HT1:"👑", LT1:"🥇", HT2:"🔴", LT2:"🩸",
  HT3:"🟠", LT3:"🔶", HT4:"🟢", LT4:"💚",
  HT5:"🔵", LT5:"💙", UNRANKED:"⚫",
};

const REGION_NAMES = { NA:"North America", EU:"Europe", AS:"Asia", SA:"South America", OC:"Oceania", AF:"Africa", ME:"Middle East" };

function getRankLabel(pts) {
  if (pts >= 400) return "Combat Legend";
  if (pts >= 280) return "Combat Master";
  if (pts >= 180) return "Combat Ace";
  if (pts >= 100) return "Veteran";
  if (pts >=  50) return "Experienced";
  if (pts >    0) return "Beginner";
  return "Unranked";
}

// ── State ─────────────────────────────────────────────────────
let allRatings  = [];
let currentMode = "overall";
let searchQuery = "";

// ── Load data ─────────────────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch("data/tierlist.json?" + Date.now());
    if (!res.ok) throw new Error();
    const json = await res.json();
    allRatings = json.ratings ?? [];
  } catch (_) {
    allRatings = DEMO;
  }
  updateStats();
  render();
}

function updateStats() {
  const players = new Set(allRatings.map(r => r.discord_id)).size;
  document.getElementById("statPlayers").textContent = players;
  document.getElementById("statRatings").textContent = allRatings.length;
}

// ── Build players ─────────────────────────────────────────────
function buildPlayers(mode) {
  const map = {};
  for (const r of allRatings) {
    if (!map[r.discord_id]) map[r.discord_id] = { id: r.discord_id, username: r.username, ign: r.ign ?? r.username, continent: r.continent ?? "NA", tiers: {} };
    map[r.discord_id].tiers[r.gamemode] = r.tier;
    // Update IGN/continent from latest rating
    if (r.ign)       map[r.discord_id].ign       = r.ign;
    if (r.continent) map[r.discord_id].continent = r.continent;
  }

  let players = Object.values(map);
  if (mode !== "overall") players = players.filter(p => p.tiers[mode]);

  players = players.map(p => {
    let pts = 0;
    if (mode === "overall") {
      for (const t of Object.values(p.tiers)) pts += TIER_POINTS[t] ?? 0;
    } else {
      pts = TIER_POINTS[p.tiers[mode]] ?? 0;
    }
    return { ...p, pts };
  });

  players.sort((a, b) => b.pts - a.pts || a.ign.localeCompare(b.ign));
  if (searchQuery) players = players.filter(p => p.ign.toLowerCase().includes(searchQuery.toLowerCase()) || p.username.toLowerCase().includes(searchQuery.toLowerCase()));
  return players;
}

// ── Render ────────────────────────────────────────────────────
function render() {
  const players = buildPlayers(currentMode);
  const body    = document.getElementById("tableBody");

  if (!players.length) {
    body.innerHTML = `<div class="empty">${searchQuery ? "No players match your search." : "No ratings yet for this gamemode."}</div>`;
    return;
  }

  body.innerHTML = players.map((p, i) => {
    const rank      = i + 1;
    const rClass    = rank <= 3 ? ` r${rank}` : "";
    const avatar    = `https://mc-heads.net/avatar/${encodeURIComponent(p.ign)}/40`;
    const label     = getRankLabel(p.pts);
    const regionCls = `region-${p.continent}`;

    let tiersHtml = "";
    if (currentMode === "overall") {
      const sorted = Object.entries(p.tiers).sort((a,b) => TIER_ORDER.indexOf(a[1]) - TIER_ORDER.indexOf(b[1]));
      tiersHtml = sorted.map(([gm, t]) => {
        const g = GAMEMODES.find(x => x.id === gm);
        return `<span class="tb tb-${t}"><span class="tb-icon">${g?.icon ?? "🎮"}</span>${t}</span>`;
      }).join("");
    } else {
      const t = p.tiers[currentMode];
      if (t) tiersHtml = `<span class="tb tb-${t}">${TIER_ICONS[t] ?? ""} ${t}</span>`;
    }

    return `<div class="player-row" style="animation-delay:${Math.min(i,20)*25}ms" onclick="openModal('${p.id}')">
      <span class="td-rank${rClass}">${rank}</span>
      <div class="td-player">
        <img class="p-avatar" src="${avatar}" alt="${p.ign}" onerror="this.src='https://mc-heads.net/avatar/MHF_Steve/40'" loading="lazy"/>
        <div>
          <div class="p-ign">${p.ign}</div>
          <div class="p-discord">${p.username} &mdash; ${label}</div>
        </div>
      </div>
      <div class="td-region"><span class="region-badge ${regionCls}">${p.continent}</span></div>
      <span class="td-points">${p.pts} pts</span>
      <div class="td-tiers">${tiersHtml}</div>
    </div>`;
  }).join("");
}

// ── Modal ─────────────────────────────────────────────────────
function openModal(id) {
  const all    = buildPlayers("overall");
  const p      = all.find(x => x.id === id);
  if (!p) return;
  const avatar = `https://mc-heads.net/avatar/${encodeURIComponent(p.ign)}/64`;
  const label  = getRankLabel(p.pts);
  const rName  = REGION_NAMES[p.continent] ?? p.continent;

  const grid = GAMEMODES.filter(g => p.tiers[g.id]).map(g => {
    const t = p.tiers[g.id];
    return `<div class="modal-row">
      <span class="modal-gm">${g.icon} ${g.name}</span>
      <span class="modal-tier tb-${t} modal-tier">${t}</span>
    </div>`;
  }).join("");

  document.getElementById("modalContent").innerHTML = `
    <div class="modal-head">
      <img class="modal-avatar" src="${avatar}" alt="${p.ign}" onerror="this.src='https://mc-heads.net/avatar/MHF_Steve/64'"/>
      <div>
        <div class="modal-ign">${p.ign}</div>
        <div class="modal-meta">
          <span class="region-badge region-${p.continent}">${p.continent} · ${rName}</span>
          <span>${label} · ${p.pts} pts</span>
        </div>
        <div class="modal-meta" style="color:var(--dim);margin-top:2px">Discord: ${p.username}</div>
      </div>
    </div>
    ${grid ? `<div class="modal-grid">${grid}</div>` : '<p style="color:var(--dim)">No ratings yet.</p>'}
  `;
  document.getElementById("modalBg").classList.add("open");
}

function closeModal() { document.getElementById("modalBg").classList.remove("open"); }

// ── Events ────────────────────────────────────────────────────
document.getElementById("tabs").addEventListener("click", e => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  tab.classList.add("active");
  currentMode = tab.dataset.mode;
  document.getElementById("tableBody").innerHTML = '<div class="loading">Loading</div>';
  setTimeout(render, 60);
});

document.getElementById("searchInput").addEventListener("input", e => { searchQuery = e.target.value.trim(); render(); });
document.getElementById("modalX").addEventListener("click", closeModal);
document.getElementById("modalBg").addEventListener("click", e => { if (e.target === document.getElementById("modalBg")) closeModal(); });
document.addEventListener("keydown", e => {
  if (e.key === "/" && document.activeElement !== document.getElementById("searchInput")) { e.preventDefault(); document.getElementById("searchInput").focus(); }
  if (e.key === "Escape") closeModal();
});

// ── Demo data ─────────────────────────────────────────────────
const DEMO = [
  {discord_id:"1",username:"xXDarkSlayerXx",ign:"DarkSlayer",continent:"NA",gamemode:"sword",   tier:"HT1"},
  {discord_id:"1",username:"xXDarkSlayerXx",ign:"DarkSlayer",continent:"NA",gamemode:"pot",     tier:"LT1"},
  {discord_id:"1",username:"xXDarkSlayerXx",ign:"DarkSlayer",continent:"NA",gamemode:"uhc",     tier:"HT2"},
  {discord_id:"2",username:"PvPKing2025",    ign:"PvPKing",   continent:"EU",gamemode:"sword",   tier:"LT1"},
  {discord_id:"2",username:"PvPKing2025",    ign:"PvPKing",   continent:"EU",gamemode:"crystal", tier:"HT2"},
  {discord_id:"2",username:"PvPKing2025",    ign:"PvPKing",   continent:"EU",gamemode:"mace",    tier:"HT1"},
  {discord_id:"3",username:"SwiftBlade",     ign:"SwiftBlade",continent:"EU",gamemode:"pot",     tier:"HT2"},
  {discord_id:"3",username:"SwiftBlade",     ign:"SwiftBlade",continent:"EU",gamemode:"axe",     tier:"HT3"},
  {discord_id:"4",username:"CrystalGod",     ign:"CrystalGod",continent:"AS",gamemode:"crystal", tier:"HT1"},
  {discord_id:"4",username:"CrystalGod",     ign:"CrystalGod",continent:"AS",gamemode:"uhc",     tier:"LT3"},
  {discord_id:"5",username:"AxeMaster",      ign:"AxeMaster", continent:"NA",gamemode:"axe",     tier:"LT1"},
  {discord_id:"5",username:"AxeMaster",      ign:"AxeMaster", continent:"NA",gamemode:"sword",   tier:"HT3"},
  {discord_id:"6",username:"MacePro",        ign:"MacePro",   continent:"SA",gamemode:"mace",    tier:"LT2"},
  {discord_id:"7",username:"UHCLegend",      ign:"UHCLegend", continent:"OC",gamemode:"uhc",     tier:"HT1"},
];

loadData();
