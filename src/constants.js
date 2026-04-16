// src/constants.js

const TIERS = ["HT1","LT1","HT2","LT2","HT3","LT3","HT4","LT4","HT5","LT5","UNRANKED"];

const TIER_COLORS = {
  HT1: 0xFFD700,
  LT1: 0xFFA500,
  HT2: 0xFF4444,
  LT2: 0xFF7777,
  HT3: 0xFF8C00,
  LT3: 0xFFB347,
  HT4: 0x00C853,
  LT4: 0x66BB6A,
  HT5: 0x00B0FF,
  LT5: 0x64B5F6,
  UNRANKED: 0x607D8B,
};

const TIER_EMOJIS = {
  HT1: "👑", LT1: "🥇",
  HT2: "🔴", LT2: "🩸",
  HT3: "🟠", LT3: "🔶",
  HT4: "🟢", LT4: "💚",
  HT5: "🔵", LT5: "💙",
  UNRANKED: "⚫",
};

// Points matching MCTiers style (descending by rank)
const TIER_POINTS = {
  HT1: 100, LT1: 88,
  HT2: 76,  LT2: 65,
  HT3: 54,  LT3: 44,
  HT4: 34,  LT4: 25,
  HT5: 16,  LT5: 8,
  UNRANKED: 0,
};

const GAMEMODES = [
  { name: "Sword",    value: "sword"   },
  { name: "Mace",     value: "mace"    },
  { name: "Pot PvP",  value: "pot"     },
  { name: "UHC",      value: "uhc"     },
  { name: "Crystal",  value: "crystal" },
  { name: "SMP",      value: "smp"     },
  { name: "Axe",      value: "axe"     },
];

const GAMEMODE_EMOJIS = {
  sword:   "⚔️",
  mace:    "🪓",
  pot:     "🧪",
  uhc:     "💛",
  crystal: "💎",
  smp:     "🌍",
  axe:     "🪓",
};

const CONTINENTS = [
  { name: "North America", value: "NA"  },
  { name: "Europe",        value: "EU"  },
  { name: "Asia",          value: "AS"  },
  { name: "South America", value: "SA"  },
  { name: "Oceania",       value: "OC"  },
  { name: "Africa",        value: "AF"  },
  { name: "Middle East",   value: "ME"  },
];

module.exports = { TIERS, TIER_COLORS, TIER_EMOJIS, TIER_POINTS, GAMEMODES, GAMEMODE_EMOJIS, CONTINENTS };
