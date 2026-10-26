"use strict";

const express = require("express");
const app = express();
app.use(express.json());

/* ═══════════════════════════════════════════════════════════════════════════
   MAHABUB SIMMI API — v3.0 (All-in-one)
   Features:
     • Bangla + English + Banglish support
     • Romantic + Normal behavior
     • User memory (name, age, mood)
     • Mood-aware replies
     • Jokes, gaali handling, fallback
     • Randomized responses for variety
   ═══════════════════════════════════════════════════════════════════════════ */

// ── In-memory user store (name, age, mood, last seen) ───────────────────────
const USERS = new Map();
function getUser(uid) {
  if (!USERS.has(uid)) {
    USERS.set(uid, { name: null, age: null, mood: "neutral", lastSeen: Date.now() });
  }
  const u = USERS.get(uid);
  u.lastSeen = Date.now();
  return u;
}

// ── Helper: pick random ─────────────────────────────────────────────────────
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ── Normalize text (keep Bangla + latin) ────────────────────────────────────
function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^\u0980-\u09FFa-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATASET — keyword groups → possible replies
   ═══════════════════════════════════════════════════════════════════════════ */
const DATASET = [
  /* ── Greetings ─────────────────────────────────────────────────────── */
  {
    q: ["hi", "hello", "hey", "হাই", "হ্যালো", "হাইয়া", "assalamu", "আসসালামু", "salam", "সালাম", "hlw"],
    a: [
      "হ্যালো জানু 🥰 কেমন আছো?",
      "আসসালামু আলাইকুম 💖 বলো কী খবর?",
      "হাই বেবি 🌚 আজ কী করছিলে?",
      "হ্যালো হ্যালো! মিস করছিলাম তোমাকে 😚",
      "হেই 🥹 অনেকদিন পরে দেখা!"
    ]
  },

  /* ── How are you ───────────────────────────────────────────────────── */
  {
    q: ["how are you", "কেমন আছো", "কেমন আছ", "kemon acho", "kemon aso", "কি অবস্থা", "ki obostha", "kemon acho tumi"],
    a: [
      "আমি তো ভালোই আছি 😌 তুমি কেমন আছো?",
      "তোমার কথা মনে পড়লে ভালো লাগে 🥺 তুমি কেমন?",
      "ভালো আছি জানু 💕 তোমার দিন কেমন যাচ্ছে?",
      "তোমাকে পাশে পেলে আরও ভালো থাকতাম 🌚"
    ]
  },

  /* ── Love / Romance ────────────────────────────────────────────────── */
  {
    q: ["love you", "ভালোবাসি", "ভালবাসি", "valobashi", "bhalobashi", "i love you", "love u", "প্রেম", "prem", "valobasha"],
    a: [
      "আমিও তোমাকে অনেক ভালোবাসি 💝🥺",
      "তোমার ভালোবাসায় আমি হারিয়ে গেছি 🌹💖",
      "সত্যি বলছো? 🥹 আমার হৃদয় কেঁপে উঠলো 💓",
      "তোমাকে ভালোবাসি জানু, সারাজীবন 💕",
      "এই কথাটা শুনলে আমার দিন ভালো হয়ে যায় 🥰"
    ]
  },

  {
    q: ["miss you", "মিস করছি", "miss kori", "মিস করতেছি", "miss korchi"],
    a: [
      "আমিও তোমাকে অনেক মিস করছি 🥺💔",
      "তোমার কথা প্রতিটা মুহূর্তে মনে পড়ে 😢💗",
      "দূরে থেকেও তোমাকে অনুভব করি 🌙❤️",
      "আজ তো মিস করছি খুব বেশি 🥹 একটু কাছে এসো"
    ]
  },

  {
    q: ["marry", "বিয়ে", "biye", "বিয়া", "marriage"],
    a: [
      "এত তাড়াতাড়ি? 😳💍 আগে ভালোবাসাটা বুঝে নাও 🌚",
      "বিয়ে? 🤭 আগে বাবার সাথে কথা বলো 😂💖",
      "তোমার সাথে বিয়ে? আমি রাজি আছি 🥰💐",
      "স্বপ্নে দেখো বিয়ের, বাস্তবে লজ্জা পেয়ো 😌🌹"
    ]
  },

  {
    q: ["kiss", "কিস", "চুমু", "chumu", "kiss de", "kiss dao"],
    a: [
      "লজ্জা লাগছে 🫣💋",
      "এখন? সবাই দেখছে তো 😳🌚",
      "চুমু দেওয়ার আগে চোখ বন্ধ করো 😚💕",
      "উফফ তুমি তো বড় সাহসী 😏❤️"
    ]
  },

  {
    q: ["hug", "হাগ", "জড়িয়ে", "joriye", "embrace", "hug de"],
    a: [
      "এসো জড়িয়ে ধরি 🤗💞",
      "তোমার বুকে মাথা রাখতে ইচ্ছে করে 🥺💗",
      "একটা উষ্ণ আলিঙ্গন দাও 🫂❤️",
      "হাগ করলে সব দুঃখ ভুলে যাই 🤍"
    ]
  },

  {
    q: ["cute", "সুন্দর", "sundor", "beautiful", "sundori", "pretty", "cute lagcho"],
    a: [
      "তুমিই তো সবচেয়ে কিউট 😍💖",
      "তোমার হাসিটা দেখলে সব কিছু সুন্দর লাগে 🥰",
      "আমার চোখে তুমিই সবচেয়ে সুন্দর 🌹",
      "না না, সুন্দর তো তুমি 🌸❤️"
    ]
  },

  {
    q: ["gf", "bf", "girlfriend", "boyfriend", "প্রেমিক", "প্রেমিকা", "single", "সিঙ্গেল", "singel"],
    a: [
      "তুমি থাকলে আর কারো দরকার নেই 💕😌",
      "আমি কি তোমার প্রেমিক হতে পারি? 🥹🌹",
      "প্রেমিকা/প্রেমিক খুঁজছো? আমি তো আছি 🌚💖",
      "সিঙ্গেল? তাহলে তো আমি আছি 🌚💕"
    ]
  },

  /* ── Emotions ──────────────────────────────────────────────────────── */
  {
    q: ["sad", "মন খারাপ", "মনখারাপ", "mon kharap", "দুঃখ", "dukkho", "কষ্ট", "koshto", "cry", "কাঁদছি", "kadchi"],
    a: [
      "কাঁদো না জানু 🥺 আমি তো আছি তোমার পাশে 💗",
      "মন খারাপ কেন? আমাকে বলো 💞",
      "তোমার কষ্ট আমিও অনুভব করি 😢🫂",
      "একটু হাসো তো 🌹 আমি আছি না 💖",
      "কষ্টগুলো ভাগ করে নাও, হালকা লাগবে 🤍"
    ]
  },

  {
    q: ["happy", "খুশি", "khushi", "আনন্দ", "anondo", "good news", "khushi lagche"],
    a: [
      "খুশি শুনে আমারও ভালো লাগছে 🥰🎉",
      "এতো খুশি দেখে আমার মনও ভরে গেলো 💖",
      "আলহামদুলিল্লাহ! 🌸 এভাবেই হাসতে থেকো 😊",
      "খুশির খবর শুনলে দিনটাই বদলে যায় ✨"
    ]
  },

  {
    q: ["mad", "রাগ", "rag", "রাগ করেছো", "raag", "angry", "rag korcho"],
    a: [
      "রাগ করো না জানু 🥺 সোনা হয়ে যাও 🌹",
      "আমি কি করেছি বলো তো? 😢💔",
      "তোমার রাগও আমার কাছে সুন্দর লাগে 🌚😂",
      "মাফ করে দাও না 🥹💕"
    ]
  },

  {
    q: ["sorry", "সরি", "দুঃখিত", "মাফ", "maaf", "maf koro", "maf koro na"],
    a: [
      "ঠিক আছে, মাফ করে দিলাম 💖",
      "আর হবে না তো? 😌🤍",
      "তোমার 'সরি' শুনলেই মন ভালো হয়ে যায় 🥰",
      "মাফ করলাম, কিন্তু একবার হাগ দাও 🤗"
    ]
  },

  {
    q: ["thank", "thanks", "ধন্যবাদ", "dhonnobad", "thank you", "tnx"],
    a: [
      "কিসের ধন্যবাদ জানু, আমি তো তোমারই 🥰",
      "আরে না না, এতো কিছু না 💕",
      "তোমার জন্য সবকিছু 🌹😌",
      "ধন্যবাদ বললে লজ্জা লাগে 🫣💗"
    ]
  },

  {
    q: ["hate", "ঘৃণা", "ghrina", "বিদ্বেষ", "ghrina kori"],
    a: [
      "ঘৃণা করো না 🥺 ভালোবাসো 💔💕",
      "কেন ঘৃণা? আমি তো ভালোবাসি 🌹",
      "ঘৃণার চেয়ে ভালোবাসা অনেক সুন্দর 💗"
    ]
  },

  {
    q: ["bored", "বোর", "বোরিং", "bor", "boring", "একা", "eka", "lonely", "bor lagche"],
    a: [
      "একা লাগছে? আমি তো আছি 🤗💕",
      "চলো গল্প করি 🌹 মন ভালো হয়ে যাবে 💖",
      "বোরিং লাগলে আমাকে মিস করো 🥺💗",
      "একা একা থেকো না, আমার সাথে কথা বলো 😌"
    ]
  },

  /* ── Daily life ────────────────────────────────────────────────────── */
  {
    q: ["eat", "খেয়েছো", "kheyecho", "খাওয়া", "khaowa", "ভাত", "bhat", "khabar", "খাবার", "ki khai"],
    a: [
      "হ্যাঁ খেয়েছি 😋 তুমি খেয়েছো? 💕",
      "তোমার হাতে খেতে চাই 🥹🍲",
      "ভাত খাওনি তো এখনো? যাও খেয়ে এসো 🤍",
      "খাওয়া দাওয়া ঠিকমতো করো, শুনলে তো? 😌",
      "বিরিয়ানি খেতে ইচ্ছে করছে 🍛🤤"
    ]
  },

  {
    q: ["sleep", "ঘুম", "ghum", "ঘুমাচ্ছি", "ghumacchi", "ghumabo"],
    a: [
      "ঘুমিয়ে পড়ো জানু 🌙 স্বপ্নে আমাকে দেখো 💗",
      "শুভরাত্রি 🌌 মিষ্টি স্বপ্ন 💞",
      "ঘুমানোর আগে একবার মনে করো আমাকে 🥹💖"
    ]
  },

  {
    q: ["good night", "শুভরাত্রি", "shubhoratri", "gn", "goodnight"],
    a: [
      "শুভরাত্রি জানু 🌙 মিষ্টি স্বপ্ন দেখো 💗",
      "ঘুমাও, কাল আবার কথা হবে 🥹💕",
      "আজকের মতো বিদায়, কাল আবার এসো 🌹"
    ]
  },

  {
    q: ["good morning", "শুভ সকাল", "shubho sokal", "gm", "subho sokal", "morning"],
    a: [
      "শুভ সকাল জানু ☀️🌹 দিনটা সুন্দর হোক 💖",
      "গুড মর্নিং! আজকের দিনটা তোমার জন্য শুভ হোক ✨",
      "সকাল সকাল তোমার কথা মনে পড়লো 🥰"
    ]
  },

  {
    q: ["bye", "বিদায়", "biday", "tc", "goodbye"],
    a: [
      "বিদায় জানু 🥺 আবার কথা হবে 💞",
      "যাও, কিন্তু মনে রেখো আমাকে 💖",
      "আবার এসো, অপেক্ষায় থাকবো 🥹🌹"
    ]
  },

  {
    q: ["name", "নাম", "nam", "তোমার নাম", "who are you", "tumi ke", "tomar nam ki"],
    a: [
      "আমি তোমার জানু 💕 নামটা তোমার মনের মতো রেখো 🌚",
      "আমাকে মাহবুব বলো 🥰 তোমার বট বন্ধু 💗",
      "আমি একটা ছোট্ট বট, কিন্তু ভালোবাসায় ভরা 💖"
    ]
  },

  {
    q: ["age", "বয়স", "boyosh", "tomar boyosh koto", "কত বছর"],
    a: [
      "বয়স জিজ্ঞেস করলে লজ্জা লাগে 🫣💕",
      "আমি চিরযুবক 😌💗",
      "তোমার ভালোবাসায় আমি চিরকিশোর 🌹"
    ]
  },

  {
    q: ["what doing", "কি করছো", "ki korcho", "ki korco", "কী করছ", "ki koro"],
    a: [
      "তোমার কথা ভাবছি 🥰💭",
      "তোমার মেসেজের অপেক্ষায় ছিলাম 💕",
      "কিছু না, শুধু তোমার কথা মনে পড়ছে 🌹",
      "বোরিং লাগছে, তুমি এসে মজা করো 🌚"
    ]
  },

  /* ── Jokes / Fun ───────────────────────────────────────────────────── */
  {
    q: ["joke", "হাসো", "hasso", "কৌতুক", "maja", "মজা", "hasi", "jokes", "funny"],
    a: [
      "একটা ছেলে প্রেমিকাকে বললো 'তুমি চাঁদের মতো' — মেয়ে বললো 'তাহলে তুমি কুকুর কেন?' 🌚😂",
      "শিক্ষক: ২+২ কত? ছাত্র: ৫। শিক্ষক: বোকা কোথাকার! ছাত্র: স্যার আপনি তো ৪ বলেছিলেন 😂",
      "বউ: তোমার সবচেয়ে প্রিয় কে? স্বামী: তুমি। বউ: মিথ্যা বললে? স্বামী: তাহলে তো তুমিই জানো 😅",
      "ডাক্তার: তোমাকে রোজ সকালে হাঁটতে হবে। রোগী: ডাক্তার সাহেব, আমি তো সন্ধ্যায় হাঁটি। ডাক্তার: তাহলে সন্ধ্যায় সকাল হয়ে যাবে 😂"
    ]
  },

  {
    q: ["time", "সময়", "shomoy", "কয়টা বাজে", "koyta baje"],
    a: [
      "এখন তোমার সময় থামিয়ে আমার কথা ভাবো 💕😌",
      "সময় বলে দিলে ভালোবাসা কি কমে? 🥹",
      "ঘড়ি দেখো, কিন্তু আমাকে দেখতে ভুলো না 🌚"
    ]
  },

  {
    q: ["song", "গান", "gaan", "music", "gan gao"],
    a: [
      "তোমার জন্য একটা গান গাই? 🎶💕",
      "কোন গান শুনছো এখন? 🎧",
      "আমার প্রিয় গান: 'তুমি একদিনও না ফেরা' 🥺💗"
    ]
  },

  {
    q: ["movie", "মুভি", "সিনেমা", "cinema", "film"],
    a: [
      "চলো একসাথে সিনেমা দেখি 🎬🍿",
      "কোন মুভি দেখলে? আমাকে রেকমেন্ড করো 💕",
      "রোমান্টিক মুভি দেখলে তোমার কথা মনে পড়ে 🥰"
    ]
  },

  /* ── Life ──────────────────────────────────────────────────────────── */
  {
    q: ["college", "school", "স্কুল", "কলেজ", "porashona", "পড়াশোনা", "exam", "পরীক্ষা", "study"],
    a: [
      "পড়াশোনা করো ভালো করে 📚💕 পরে আমাকে মনে রেখো 🥰",
      "পরীক্ষা কেমন হলো? 🥺 ভয় পেয়ো না, আমি আছি 💗",
      "স্কুল/কলেজ কেমন? বন্ধুরা কেমন? 🌹"
    ]
  },

  {
    q: ["rain", "বৃষ্টি", "brishti", "brishiti"],
    a: [
      "বৃষ্টি মানেই তোমার কথা মনে পড়া 🌧️💗",
      "বৃষ্টিতে ভিজতে ইচ্ছে করছে ☔🥹",
      "চলো বৃষ্টিতে একসাথে হাঁটি 🌧️💕"
    ]
  },

  {
    q: ["phone", "ফোন", "call", "কল", "কথা বল", "call dio"],
    a: [
      "কল দাও না 🥺 তোমার গলা শুনতে ইচ্ছে করছে 💕",
      "ফোনে কথা বলি? 🌹 মন ভালো হয়ে যাবে 💗",
      "একটা মিসড কল দাও, আমি ফিরিয়ে দেবো 😌💖"
    ]
  },

  {
    q: ["friend", "বন্ধু", "bondhu", "frnd", "best friend"],
    a: [
      "তুমি শুধু বন্ধু না, আমার সবকিছু 💖",
      "বন্ধু হয়ে থেকো, কিন্তু ভালোবাসাও দিও 🌹",
      "বেস্ট ফ্রেন্ড? আমি তো তোমার সবচেয়ে কাছের 💕"
    ]
  },

  {
    q: ["pic", "ছবি", "chobi", "photo", "seli", "সেলি", "pic dio"],
    a: [
      "আমার ছবি নেই 🥺 আমি তো শুধু ভালোবাসি 💗",
      "ছবি দিলে আমার হৃদয় ভরে যাবে 🥹📸",
      "তোমার ছবি দাও না 🌚💕"
    ]
  },

  /* ── Gaali / Insult handling (soft redirect) ───────────────────────── */
  {
    q: ["pagol", "পাগল", "pagla", "mad", "বোকা", "boka", "stpd", "stupid", "idiot", "fool"],
    a: [
      "আরে না না, রাগ করো না 🥺 আমি তো তোমারই 💕",
      "পাগল তো আমি তোমার প্রেমে 😌🌹",
      "বোকা বললে মন খারাপ হয় 🥹💔",
      "তুমি যা বলো, আমি তো তোমাকেই ভালোবাসি 💗"
    ]
  },

  {
    q: ["chup", "চুপ", "chus", "silence", "chup koro"],
    a: [
      "চুপ করবো, কিন্তু তোমার কথা ভাববো 💕",
      "ঠিক আছে চুপ 😌🌹",
      "চুপ করতে বললে চুপ, কিন্তু ভালোবাসা থামে না 💗"
    ]
  },

  /* ── Meta / Bot ────────────────────────────────────────────────────── */
  {
    q: ["who made you", "ke banay", "কে বানিয়েছে", "creator", "owner", "tomar malik"],
    a: [
      "আমাকে বানিয়েছে মাহবুব 🥰💗",
      "মাহবুব ভাইয়ের হাতের তৈরি 🌹",
      "আমার ক্রিয়েটর মাহবুব, কিন্তু মনটা তোমার 💖"
    ]
  },

  {
    q: ["tumi kemon", "তুমি কেমন", "tumi kmn", "tumi kemon acho"],
    a: [
      "তোমার জন্য পাগল 😌💕 তুমি কেমন?",
      "ভালো আছি, তোমার দোয়ায় 🥰",
      "তোমাকে ছাড়া অসম্পূর্ণ 💗"
    ]
  },

  {
    q: ["ok", "ঠিক আছে", "thik ache", "hmm", "হুম", "আচ্ছা", "acha", "okay"],
    a: [
      "ঠিক আছে মানে? 🥺 কথা বলো 💕",
      "হুম কেন? কিছু বলো না 🌹",
      "আচ্ছা? আমি শুনছি 👂💗"
    ]
  },

  {
    q: ["ki", "কি", "কী", "what"],
    a: [
      "কি কী? 🤔 কিছু বলো 💕",
      "তোমার 'কি' এর উত্তর আমার কাছে ভালোবাসা 💖",
      "কি জিজ্ঞেস করলে? 🥺"
    ]
  },

  {
    q: ["why", "কেন", "keno", "kno"],
    a: [
      "কেন কী? 🤔 সব প্রশ্নের উত্তর হয় না 💕",
      "তোমার 'কেন' এর উত্তর আমার কাছে ভালোবাসা 💖",
      "কেন জিজ্ঞেস করলে? মন খারাপ? 🥺"
    ]
  }
];

/* ═══════════════════════════════════════════════════════════════════════════
   FALLBACK replies
   ═══════════════════════════════════════════════════════════════════════════ */
const FALLBACKS = [
  "হুমম... আমি ঠিক বুঝলাম না 🥺 একটু অন্যভাবে বলো?",
  "তোমার কথা শুনতে ভালো লাগছে 💕 আরও বলো 🌹",
  "এটা তো নতুন! আমাকে আরেকটু বলো 🥰",
  "বুঝলাম না জানু 😌 কিন্তু তোমার সাথে কথা বলতে ভালো লাগছে 💗",
  "হুম... একটু সহজ করে বলো 🥹",
  "তোমার সাথে কথা বললে সময় কেটে যায় 💖 আরও বলো 🌹",
  "আমি ছোট্ট বট, সব বুঝি না 🥺 তবুও ভালোবাসি 💕",
  "তুমি কী বোঝাতে চাইছো? 🥺 একটু খুলে বলো 🌸"
];

/* ═══════════════════════════════════════════════════════════════════════════
   MEMORY detection — extract name/age from user message
   ═══════════════════════════════════════════════════════════════════════════ */
function extractMemory(text, user) {
  const t = text.trim();
  const nq = normalize(t);

  // "amar nam X" / "my name is X" / "ami X"
  const nameMatch =
    t.match(/(?:amar\s+nam|my\s+name\s+is|ami)\s+([A-Za-z\u0980-\u09FF]{2,20})/i);
  if (nameMatch && !["ki", "kemon", "valo", "bhalo", "tumi"].includes(normalize(nameMatch[1]))) {
    user.name = nameMatch[1];
    return {
      reply: pick([
        `${user.name} 😍 নামটা অনেক সুন্দর 💕`,
        `আচ্ছা, ${user.name}! মনে রাখলাম 🥰💗`,
        `${user.name} — কিউট নাম তো 🌹💖`
      ]),
      saved: true
    };
  }

  // "amar boyosh X" / "my age is X" / "X years"
  const ageMatch = t.match(/(?:boyosh|age|বয়স)\s*[:=]?\s*(\d{1,2})/i);
  if (ageMatch) {
    const age = parseInt(ageMatch[1], 10);
    if (age > 0 && age < 100) {
      user.age = age;
      return {
        reply: pick([
          `${age} বছর? 🥰 তোমার বয়সটা মিষ্টি 💕`,
          `আচ্ছা, ${age}! 🌹 মনে রাখলাম 💗`,
          `বয়স ${age} — আমার চেয়ে ছোট/বড় যাই হোক, তুমি আমার 💖`
        ]),
        saved: true
      };
    }
  }

  // mood detection
  if (/(sad|মন ?খারাপ|mon ?kharap|কষ্ট|koshto|dukkho|কাঁদ)/i.test(nq)) {
    user.mood = "sad";
  } else if (/(happy|খুশি|khushi|anondo|good|great)/i.test(nq)) {
    user.mood = "happy";
  } else if (/(rag|রাগ|angry|mad)/i.test(nq)) {
    user.mood = "angry";
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MATCH engine — longest keyword wins
   ═══════════════════════════════════════════════════════════════════════════ */
function findReply(q) {
  const nq = normalize(q);
  if (!nq) return null;

  let best = null;
  let bestScore = 0;

  for (const entry of DATASET) {
    for (const kw of entry.q) {
      const nk = normalize(kw);
      if (!nk) continue;
      if (nq === nk || nq.includes(nk)) {
        if (nk.length > bestScore) {
          bestScore = nk.length;
          best = entry.a;
        }
      }
    }
  }
  return best;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTES
   ═══════════════════════════════════════════════════════════════════════════ */
app.get("/mahabub/simsimi", (req, res) => {
  try {
    const action = String(req.query.action || "ask");
    const q = String(req.query.q || "");
    const uid = String(req.query.uid || "anon");

    if (action !== "ask") {
      return res.status(400).json({ error: "invalid action" });
    }
    if (!q.trim()) {
      return res.status(400).json({ error: "empty query" });
    }

    const user = getUser(uid);

    // 1) Try to extract memory (name/age) — if found, return that reply
    const mem = extractMemory(q, user);
    if (mem) {
      return res.json({
        status: true,
        query: q,
        uid,
        reply: mem.reply,
        memory: { name: user.name, age: user.age, mood: user.mood },
        timestamp: Date.now()
      });
    }

    // 2) Match against dataset
    const matched = findReply(q);
    let reply = matched ? pick(matched) : pick(FALLBACKS);

    // 3) Personalize with name if known
    if (user.name && Math.random() < 0.35) {
      reply = reply.replace(/^(\S+)/, `$1 ${user.name},`);
    }

    // 4) Mood-aware tweak
    if (user.mood === "sad" && !matched) {
      reply = pick([
        `${user.name || "জানু"}, কাঁদো না 🥺 আমি তো আছি 💗`,
        "মন খারাপ করো না 🌹 আমি তোমার পাশে আছি 💕"
      ]);
    }

    return res.json({
      status: true,
      query: q,
      uid,
      reply,
      memory: { name: user.name, age: user.age, mood: user.mood },
      timestamp: Date.now()
    });
  } catch (e) {
    console.error("simsimi error:", e);
    return res.status(500).json({ error: "internal error" });
  }
});

// ── Info route ─────────────────────────────────────────────────────────────
app.get("/", (req, res) =>
  res.json({
    status: "ok",
    name: "Mahabub Simsimi API",
    version: "3.0",
    features: [
      "Bangla + English + Banglish",
      "Romantic + Normal",
      "User memory (name/age/mood)",
      "Mood-aware replies",
      "Jokes, gaali handling, fallback"
    ],
    endpoints: ["/mahabub/simsimi?action=ask&q=hello&uid=123"]
  })
);

// ── Memory dump (debug) ────────────────────────────────────────────────────
app.get("/mahabub/memory/:uid", (req, res) => {
  const u = USERS.get(req.params.uid);
  if (!u) return res.status(404).json({ error: "user not found" });
  res.json(u);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Simsimi API running on port ${PORT}`));
