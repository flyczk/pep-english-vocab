import express from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { dbRun, dbGet, dbAll } from "./db.js";

const app = express();
const PORT = process.env.PORT || 3300;

app.use(express.json({ limit: "12mb" }));
app.use("/api", (req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
app.use(
  express.static("public", {
    etag: false,
    maxAge: 0,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store");
    },
  }),
);

// 综合艾宾浩斯遗忘曲线 + SM-2 超级记忆算法的9阶段复习间隔
const REVIEW_STAGES = [
  { index: 0, label: "5分钟", minutes: 5, color: "#ef4444" },
  { index: 1, label: "30分钟", minutes: 30, color: "#f97316" },
  { index: 2, label: "1天", minutes: 1440, color: "#eab308" },
  { index: 3, label: "3天", minutes: 4320, color: "#84cc16" },
  { index: 4, label: "7天", minutes: 10080, color: "#22c55e" },
  { index: 5, label: "14天", minutes: 20160, color: "#06b6d4" },
  { index: 6, label: "30天", minutes: 43200, color: "#3b82f6" },
  { index: 7, label: "60天", minutes: 86400, color: "#8b5cf6" },
  { index: 8, label: "90天", minutes: 129600, color: "#a855f7", final: true },
];

const BASE_TEXTBOOK_TEMPLATES = [
  { name: "PEP英语七下" },
  { name: "PEP英语八下" },
  { name: "PEP英语九下" },
];

const nowIso = () => new Date().toISOString();
const addMinutes = (date, minutes) =>
  new Date(date.getTime() + minutes * 60 * 1000);
const normalizeTextbookName = (value) => String(value || "").trim().toLowerCase();
const normalizeGradeValue = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "");
const normalizePhoneValue = (value) => String(value || "").replace(/[^\d+]/g, "");
const toSqlBool = (value, fallback = 0) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value === 0 ? 0 : 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return 1;
    if (["0", "false", "no", "off", ""].includes(normalized)) return 0;
  }
  return value ? 1 : 0;
};

const parseGradeLevel = (gradeValue) => {
  const text = normalizeGradeValue(gradeValue);
  if (!text) return null;

  const exactMap = new Map([
    ["一年级", 1],
    ["二年级", 2],
    ["三年级", 3],
    ["四年级", 4],
    ["五年级", 5],
    ["六年级", 6],
    ["七年级", 7],
    ["八年级", 8],
    ["九年级", 9],
    ["高一", 10],
    ["高二", 11],
    ["高三", 12],
    ["高中一年级", 10],
    ["高中二年级", 11],
    ["高中三年级", 12],
    ["初一", 7],
    ["初二", 8],
    ["初三", 9],
    ["1", 1],
    ["2", 2],
    ["3", 3],
    ["4", 4],
    ["5", 5],
    ["6", 6],
    ["7", 7],
    ["8", 8],
    ["9", 9],
    ["10", 10],
    ["11", 11],
    ["12", 12],
  ]);
  if (exactMap.has(text)) return exactMap.get(text);

  if (text.includes("高一") || text.includes("高1")) return 10;
  if (text.includes("高二") || text.includes("高2")) return 11;
  if (text.includes("高三") || text.includes("高3")) return 12;

  const digitMatch = text.match(/\d+/);
  if (digitMatch) {
    const parsed = Number(digitMatch[0]);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 12) {
      if (text.includes("高") && parsed >= 1 && parsed <= 3) {
        return parsed + 9;
      }
      return parsed;
    }
  }

  if (text.includes("一") || text.includes("1")) return 1;
  if (text.includes("二") || text.includes("2")) return 2;
  if (text.includes("三") || text.includes("3")) return 3;
  if (text.includes("四") || text.includes("4")) return 4;
  if (text.includes("五") || text.includes("5")) return 5;
  if (text.includes("六") || text.includes("6")) return 6;
  if (text.includes("七") || text.includes("7")) return 7;
  if (text.includes("八") || text.includes("8")) return 8;
  if (text.includes("九") || text.includes("9")) return 9;

  return null;
};

const textbookMatchesGrade = (name, gradeLevel) => {
  const text = normalizeGradeValue(name);
  if (!text || !gradeLevel) return false;
  if (gradeLevel === 10) return /(高一|高1|10)/.test(text);
  if (gradeLevel === 11) return /(高二|高2|11)/.test(text);
  if (gradeLevel === 12) return /(高三|高3|12)/.test(text);
  if (text.includes("高")) return false;
  if (gradeLevel === 1) return /(一年|1年|一上|一下|1上|1下)/.test(text);
  if (gradeLevel === 2) return /(二年|2年|二上|二下|2上|2下)/.test(text);
  if (gradeLevel === 3) return /(三年|3年|三上|三下|3上|3下)/.test(text);
  if (gradeLevel === 4) return /(四年|4年|四上|四下|4上|4下)/.test(text);
  if (gradeLevel === 5) return /(五年|5年|五上|五下|5上|5下)/.test(text);
  if (gradeLevel === 6) return /(六年|6年|六上|六下|6上|6下)/.test(text);
  if (gradeLevel === 7) return /(?:七|7)(?:年级)?(?:上|下)?/.test(text);
  if (gradeLevel === 8) return /(?:八|8)(?:年级)?(?:上|下)?/.test(text);
  if (gradeLevel === 9) return /(?:九|9)(?:年级)?(?:上|下)?/.test(text);
  return false;
};

const grantUserTextbookAccessByGrade = async (userId, gradeValue) => {
  const gradeLevel = parseGradeLevel(gradeValue);
  if (!gradeLevel) return { granted: 0, gradeLevel: null };

  const textbooks = await dbAll(
    "SELECT id, name FROM textbooks ORDER BY is_base DESC, sort_order, id",
  );
  const matched = textbooks.filter((row) => textbookMatchesGrade(row.name, gradeLevel));
  let granted = 0;
  for (const textbook of matched) {
    await dbRun(
      "INSERT OR IGNORE INTO user_textbook_access (user_id, textbook_id) VALUES (?, ?)",
      [userId, textbook.id],
    );
    granted += 1;
  }
  return { granted, gradeLevel };
};

const normalizeWordForRangeMatch = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const extractUnitSortOrder = (name) => {
  const text = String(name || "").trim();
  if (!text) return null;
  const enMatch = text.match(/unit\s*(\d+)/i);
  if (enMatch) return Number(enMatch[1]);
  const zhMatch = text.match(/第?\s*(\d+)\s*单元/i);
  if (zhMatch) return Number(zhMatch[1]);
  return null;
};

const computeNextReview = (stageIndex) => {
  const stage =
    REVIEW_STAGES[Math.max(0, Math.min(stageIndex, REVIEW_STAGES.length - 1))];
  return addMinutes(new Date(), stage.minutes).toISOString();
};
const computeNextReviewFromBase = (stageIndex, baseDate) => {
  const stage =
    REVIEW_STAGES[Math.max(0, Math.min(stageIndex, REVIEW_STAGES.length - 1))];
  return addMinutes(baseDate, stage.minutes).toISOString();
};
const normalizeStageIndex = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return 0;
  return Math.max(0, Math.min(parsed, REVIEW_STAGES.length - 1));
};

const REMOTE_TTS_ENGINES = new Set(["youdao", "baidu", "bing"]);
const WORD_TTS_ENGINE_SET = new Set(["", "auto", "youdao", "baidu", "bing", "browser"]);
const sanitizeTtsText = (value) => String(value || "").replace(/\s+/g, " ").trim();
const normalizeWordTtsEngine = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized || normalized === "auto") return "";
  if (!WORD_TTS_ENGINE_SET.has(normalized)) return "";
  return normalized;
};
const buildRemoteTtsUrl = (engine, text) => {
  const encoded = encodeURIComponent(text);
  if (engine === "youdao") {
    return `https://dict.youdao.com/dictvoice?audio=${encoded}&type=2`;
  }
  if (engine === "baidu") {
    return `https://fanyi.baidu.com/gettts?lan=en&text=${encoded}&spd=3&source=web`;
  }
  return `https://cn.bing.com/dict/Speech?language=en&text=${encoded}`;
};
const getRemoteTtsReferer = (engine) => {
  if (engine === "youdao") return "https://dict.youdao.com/";
  if (engine === "baidu") return "https://fanyi.baidu.com/";
  return "https://cn.bing.com/";
};

const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "未登录" });

  const session = await dbGet(
    "SELECT token, user_id, expires_at FROM sessions WHERE token = ? AND expires_at > ?",
    [token, nowIso()],
  );
  if (!session) return res.status(401).json({ error: "登录已过期" });

  const user = await dbGet(
    "SELECT id, username, name, bio, role, active, avatar_url, birth_date, grade, phone, gender FROM users WHERE id = ?",
    [session.user_id],
  );
  if (!user) return res.status(401).json({ error: "用户不存在" });
  if (user.active === 0) return res.status(403).json({ error: "账号已被停用" });

  req.user = user;
  req.token = token;
  next();
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin")
    return res.status(403).json({ error: "需要管理员权限" });
  next();
};

const parseClientIp = (req) => {
  const xff = String(req.headers["x-forwarded-for"] || "").trim();
  if (xff) {
    return xff.split(",")[0].trim().slice(0, 120);
  }
  return String(req.socket?.remoteAddress || "").trim().slice(0, 120);
};

const safeStringifyMetadata = (value) => {
  if (value === undefined || value === null) return "";
  try {
    const text = JSON.stringify(value);
    return text.length > 4000 ? text.slice(0, 4000) : text;
  } catch {
    return "";
  }
};

const createActivityLog = async ({
  req,
  userId = null,
  username = "",
  role = "",
  action,
  targetType = "",
  targetId = "",
  targetName = "",
  metadata = null,
}) => {
  const normalizedAction = String(action || "").trim().toLowerCase().slice(0, 64);
  if (!normalizedAction) return;

  const payload = [
    Number.isInteger(Number(userId)) ? Number(userId) : null,
    String(username || "").trim().slice(0, 80),
    String(role || "").trim().slice(0, 20),
    normalizedAction,
    String(targetType || "").trim().slice(0, 40),
    String(targetId || "").trim().slice(0, 80),
    String(targetName || "").trim().slice(0, 200),
    safeStringifyMetadata(metadata),
    parseClientIp(req),
    String(req.headers["user-agent"] || "").slice(0, 255),
    nowIso(),
  ];

  try {
    await dbRun(
      `INSERT INTO activity_logs
       (user_id, username, role, action, target_type, target_id, target_name, metadata, ip, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      payload,
    );
  } catch (error) {
    console.error("[activity-log] insert failed:", error?.message || error);
  }
};

const createWordMemoryEvent = async ({
  userId,
  wordId,
  eventType,
  fromStage = null,
  toStage = null,
  result = "",
  source = "",
  metadata = null,
}) => {
  const normalizedType = String(eventType || "").trim().toLowerCase().slice(0, 40);
  if (!normalizedType) return;
  try {
    await dbRun(
      `INSERT INTO user_word_memory_events
       (user_id, word_id, event_type, from_stage, to_stage, result, source, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(userId),
        Number(wordId),
        normalizedType,
        Number.isInteger(Number(fromStage)) ? Number(fromStage) : null,
        Number.isInteger(Number(toStage)) ? Number(toStage) : null,
        String(result || "").trim().slice(0, 40),
        String(source || "").trim().slice(0, 40),
        safeStringifyMetadata(metadata),
        nowIso(),
      ],
    );
  } catch (error) {
    console.error("[memory-event] insert failed:", error?.message || error);
  }
};

const restoreBaseTextbooks = async () => {
  const rows = await dbAll("SELECT id, name, is_base FROM textbooks");
  const byName = new Map(rows.map((row) => [normalizeTextbookName(row.name), row]));
  let created = 0;
  let updated = 0;

  for (const template of BASE_TEXTBOOK_TEMPLATES) {
    const key = normalizeTextbookName(template.name);
    const existing = byName.get(key);
    if (existing) {
      if (Number(existing.is_base || 0) !== 1) {
        await dbRun("UPDATE textbooks SET is_base = 1 WHERE id = ?", [existing.id]);
        updated += 1;
      }
      continue;
    }

    const maxSortRow = await dbGet("SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM textbooks");
    const nextSort = Number(maxSortRow?.max_sort ?? -1) + 1;
    await dbRun(
      "INSERT INTO textbooks (name, sort_order, is_base) VALUES (?, ?, 1)",
      [template.name, nextSort],
    );
    created += 1;
  }

  return { created, updated, templates: BASE_TEXTBOOK_TEMPLATES.length };
};

const POS_CANONICAL_TOKENS = [
  "n",
  "v",
  "adj",
  "adv",
  "prep",
  "conj",
  "pron",
  "num",
  "art",
  "int",
  "vi",
  "vt",
  "phr",
  "interj",
  "aux",
  "modal",
  "det",
];
const POS_REGEX_TOKENS = ["modal\\s*v", ...POS_CANONICAL_TOKENS];
const POS_CANONICAL_SET = new Set(POS_CANONICAL_TOKENS);
const POS_ALIAS_MAP = {
  noun: "n",
  verb: "v",
  adjective: "adj",
  adverb: "adv",
  preposition: "prep",
  conjunction: "conj",
  pronoun: "pron",
  number: "num",
  article: "art",
  interjection: "int",
  phrase: "phr",
};
const POS_SEQUENCE_PATTERN = `(?:${POS_REGEX_TOKENS.join("|")})`;

const normalizePosToken = (rawPos) => {
  const source = String(rawPos || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!source) return "";
  const collapsed = source.replace(/[^a-z.]/g, "");
  if (/^modal\s*v\.?$/.test(source) || /^modalv\.?$/.test(collapsed)) {
    return "modal v.";
  }
  const token = source.replace(/[^a-z]/g, "");
  if (!token) return "";
  const canonical = POS_ALIAS_MAP[token] || token;
  if (!POS_CANONICAL_SET.has(canonical)) return "";
  return `${canonical}.`;
};

const extractPosSequence = (rawPos) => {
  const text = String(rawPos || "");
  const regex = new RegExp(`\\b${POS_SEQUENCE_PATTERN}\\s*\\.?`, "gi");
  const found = [];
  const seen = new Set();
  let match = regex.exec(text);
  while (match) {
    const normalized = normalizePosToken(match[0]);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      found.push(normalized);
    }
    match = regex.exec(text);
  }
  return found;
};

const stripLeadingPosFromMeaning = (rawMeaning) => {
  const source = String(rawMeaning || "").replace(/（/g, "(").replace(/）/g, ")");
  if (!source.trim()) {
    return { posSequence: [], cleanedMeaning: "" };
  }

  // Only strip clear POS markers (n./v./adj./modal v.) to avoid
  // false positives on normal text like "no matter ...".
  const leadingPosRegex = new RegExp(`^\\s*(${POS_SEQUENCE_PATTERN})\\s*\\.`, "i");
  const nextPosRegex = new RegExp(`^\\s*(${POS_SEQUENCE_PATTERN})\\s*\\.`, "i");
  const posSequence = [];
  const seen = new Set();
  let consumed = 0;

  while (true) {
    const remaining = source.slice(consumed);
    const posMatch = remaining.match(leadingPosRegex);
    if (!posMatch) break;

    const normalized = normalizePosToken(posMatch[0]);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      posSequence.push(normalized);
    }
    consumed += posMatch[0].length;

    while (true) {
      const afterPos = source.slice(consumed);
      const connectorMatch = afterPos.match(
        /^\s*(?:&|\/|,|，|、|和|与|及|or|and)\s*/i,
      );
      if (!connectorMatch) break;
      consumed += connectorMatch[0].length;
    }

    const maybeNextPos = source.slice(consumed).match(nextPosRegex);
    if (maybeNextPos) continue;
    break;
  }

  const cleanedMeaning = source
    .slice(consumed)
    .replace(/^[\s,;；、。:：\-_/\\|&]+/, "")
    .trim();

  return { posSequence, cleanedMeaning };
};

const normalizeMeaningAndPos = (rawMeaning, rawPos) => {
  const originalMeaning = String(rawMeaning || "").trim();
  const originalPos = String(rawPos || "").trim();
  const existingPosSequence = extractPosSequence(originalPos);
  const { posSequence: extractedPos, cleanedMeaning: strippedMeaning } =
    stripLeadingPosFromMeaning(originalMeaning);

  const nextPosSequence =
    existingPosSequence.length > 0 ? existingPosSequence : extractedPos;
  const nextPos = nextPosSequence.join(" ");
  let nextMeaning = originalMeaning;
  if (extractedPos.length > 0 && strippedMeaning) {
    nextMeaning = strippedMeaning;
  }

  return {
    partOfSpeech: nextPos || originalPos,
    meaning: nextMeaning,
  };
};

const normalizeWordPosData = async () => {
  const rows = await dbAll("SELECT id, meaning, part_of_speech FROM words ORDER BY id");
  let updated = 0;
  let movedPos = 0;
  let cleanedMeaning = 0;

  for (const row of rows) {
    const originalMeaning = String(row?.meaning || "").trim();
    const originalPos = String(row?.part_of_speech || "").trim();
    const { partOfSpeech: nextPos, meaning: nextMeaning } = normalizeMeaningAndPos(
      originalMeaning,
      originalPos,
    );

    if (nextPos === originalPos && nextMeaning === originalMeaning) continue;

    await dbRun(
      "UPDATE words SET part_of_speech = ?, meaning = ? WHERE id = ?",
      [nextPos, nextMeaning, row.id],
    );
    updated += 1;
    if (!originalPos && nextPos) movedPos += 1;
    if (nextMeaning !== originalMeaning) cleanedMeaning += 1;
  }

  if (updated > 0) {
    console.log(
      `[Word POS migration] updated=${updated}, moved_pos=${movedPos}, cleaned_meaning=${cleanedMeaning}`,
    );
  }
};

const initDb = async () => {
  await dbRun(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    bio TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    birth_date TEXT DEFAULT '',
    grade TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    gender TEXT DEFAULT '',
    role TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  const userColumns = await dbAll("PRAGMA table_info(users)");
  const hasName = userColumns.some((col) => col.name === "name");
  if (!hasName) {
    await dbRun("ALTER TABLE users ADD COLUMN name TEXT");
    await dbRun("UPDATE users SET name = username WHERE name IS NULL");
  }

  // Migration: add active column
  const hasActive = userColumns.some((col) => col.name === "active");
  if (!hasActive) {
    await dbRun("ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1");
    await dbRun("UPDATE users SET active = 1 WHERE active IS NULL");
  }

  const hasAvatarUrl = userColumns.some((col) => col.name === "avatar_url");
  if (!hasAvatarUrl) {
    await dbRun('ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ""');
    await dbRun('UPDATE users SET avatar_url = "" WHERE avatar_url IS NULL');
  }

  const hasBio = userColumns.some((col) => col.name === "bio");
  if (!hasBio) {
    await dbRun('ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ""');
    await dbRun('UPDATE users SET bio = "" WHERE bio IS NULL');
  }

  const hasBirthDate = userColumns.some((col) => col.name === "birth_date");
  if (!hasBirthDate) {
    await dbRun('ALTER TABLE users ADD COLUMN birth_date TEXT DEFAULT ""');
    await dbRun('UPDATE users SET birth_date = "" WHERE birth_date IS NULL');
  }

  const hasGrade = userColumns.some((col) => col.name === "grade");
  if (!hasGrade) {
    await dbRun('ALTER TABLE users ADD COLUMN grade TEXT DEFAULT ""');
    await dbRun('UPDATE users SET grade = "" WHERE grade IS NULL');
  }

  const hasPhone = userColumns.some((col) => col.name === "phone");
  if (!hasPhone) {
    await dbRun('ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ""');
    await dbRun('UPDATE users SET phone = "" WHERE phone IS NULL');
  }

  const hasGender = userColumns.some((col) => col.name === "gender");
  if (!hasGender) {
    await dbRun('ALTER TABLE users ADD COLUMN gender TEXT DEFAULT ""');
    await dbRun('UPDATE users SET gender = "" WHERE gender IS NULL');
  }

  await dbRun(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS textbooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_base INTEGER DEFAULT 0
  )`);
  const textbookColumns = await dbAll("PRAGMA table_info(textbooks)");
  const hasIsBase = textbookColumns.some((col) => col.name === "is_base");
  if (!hasIsBase) {
    await dbRun("ALTER TABLE textbooks ADD COLUMN is_base INTEGER DEFAULT 0");
    await dbRun("UPDATE textbooks SET is_base = 0 WHERE is_base IS NULL");
  }

  await dbRun(`CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    textbook_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL,
    word TEXT NOT NULL,
    meaning TEXT NOT NULL,
    phonetic TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    entries TEXT DEFAULT '[]'
  )`);

  const wordColumns = await dbAll("PRAGMA table_info(words)");
  const hasPhonetic = wordColumns.some((col) => col.name === "phonetic");
  if (!hasPhonetic) {
    await dbRun('ALTER TABLE words ADD COLUMN phonetic TEXT DEFAULT \"\"');
  }
  const hasPartOfSpeech = wordColumns.some((col) => col.name === "part_of_speech");
  if (!hasPartOfSpeech) {
    await dbRun('ALTER TABLE words ADD COLUMN part_of_speech TEXT DEFAULT \"\"');
  }
  const hasTtsEngine = wordColumns.some((col) => col.name === "tts_engine");
  if (!hasTtsEngine) {
    await dbRun('ALTER TABLE words ADD COLUMN tts_engine TEXT DEFAULT \"\"');
    await dbRun('UPDATE words SET tts_engine = \"\" WHERE tts_engine IS NULL');
  }
  const hasEntries = wordColumns.some((col) => col.name === "entries");
  if (!hasEntries) {
    await dbRun('ALTER TABLE words ADD COLUMN entries TEXT DEFAULT \"[]\"');
  }

  await dbRun(`CREATE TABLE IF NOT EXISTS user_word_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    word_id INTEGER NOT NULL,
    wrongbook INTEGER DEFAULT 0,
    stage INTEGER DEFAULT 0,
    next_review_at TEXT,
    last_review_at TEXT,
    review_count INTEGER DEFAULT 0,
    mastered_at TEXT,
    mastered_stage INTEGER,
    created_at TEXT,
    UNIQUE(user_id, word_id)
  )`);
  const userWordStatsColumns = await dbAll("PRAGMA table_info(user_word_stats)");
  const hasMasteredStage = userWordStatsColumns.some((col) => col.name === "mastered_stage");
  if (!hasMasteredStage) {
    await dbRun("ALTER TABLE user_word_stats ADD COLUMN mastered_stage INTEGER");
    await dbRun(
      `UPDATE user_word_stats
       SET mastered_stage = CASE
         WHEN mastered_at IS NOT NULL THEN stage
         ELSE NULL
       END
       WHERE mastered_stage IS NULL`,
    );
  }
  const hasStatsCreatedAt = userWordStatsColumns.some((col) => col.name === "created_at");
  if (!hasStatsCreatedAt) {
    await dbRun("ALTER TABLE user_word_stats ADD COLUMN created_at TEXT");
    await dbRun(
      `UPDATE user_word_stats
       SET created_at = COALESCE(last_review_at, mastered_at, ?)
       WHERE created_at IS NULL OR created_at = ''`,
      [nowIso()],
    );
  }
  await dbRun("CREATE INDEX IF NOT EXISTS idx_user_word_stats_user_id ON user_word_stats(user_id)");
  await dbRun("CREATE INDEX IF NOT EXISTS idx_user_word_stats_next_review ON user_word_stats(user_id, next_review_at)");

  await dbRun(`CREATE TABLE IF NOT EXISTS user_word_memory_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    word_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    from_stage INTEGER,
    to_stage INTEGER,
    result TEXT DEFAULT '',
    source TEXT DEFAULT '',
    metadata TEXT DEFAULT '',
    created_at TEXT NOT NULL
  )`);
  await dbRun("CREATE INDEX IF NOT EXISTS idx_word_memory_events_user_word ON user_word_memory_events(user_id, word_id, created_at)");


  // User-textbook access permissions
  await dbRun(`CREATE TABLE IF NOT EXISTS user_textbook_access (
    user_id INTEGER NOT NULL,
    textbook_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, textbook_id)
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT DEFAULT '',
    role TEXT DEFAULT '',
    action TEXT NOT NULL,
    target_type TEXT DEFAULT '',
    target_id TEXT DEFAULT '',
    target_name TEXT DEFAULT '',
    metadata TEXT DEFAULT '',
    ip TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    created_at TEXT NOT NULL
  )`);
  await dbRun("CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC)");
  await dbRun("CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)");
  await dbRun("CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action)");

  // 学员单词报错表：学员在背诵/复习时若发现单词原始拼写或释义有误可上报，
  // 管理员在后台查看、修改单词并标记处理状态。
  await dbRun(`CREATE TABLE IF NOT EXISTS word_error_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    word_id INTEGER NOT NULL,
    lesson_id INTEGER,
    textbook_id INTEGER,
    word_text TEXT DEFAULT '',
    user_input TEXT DEFAULT '',
    expected_answer TEXT DEFAULT '',
    reason TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    admin_note TEXT DEFAULT '',
    is_correct BOOLEAN DEFAULT 0,
    created_at TEXT NOT NULL,
    resolved_at TEXT
  )`);
  await dbRun("CREATE INDEX IF NOT EXISTS idx_word_error_reports_status ON word_error_reports(status, created_at DESC)");
  await dbRun("CREATE INDEX IF NOT EXISTS idx_word_error_reports_word_id ON word_error_reports(word_id)");
  await dbRun("CREATE INDEX IF NOT EXISTS idx_word_error_reports_user_id ON word_error_reports(user_id)");

  const userCount = await dbGet("SELECT COUNT(*) as count FROM users");
  if (userCount?.count === 0) {
    const adminHash = await bcrypt.hash("admin123", 10);
    const userHash = await bcrypt.hash("student123", 10);

    await dbRun(
      "INSERT INTO users (username, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
      [
        "admin",
        adminHash,
        "Admin User",
        "admin",
        nowIso(),
        "student",
        userHash,
        "Student User",
        "user",
        nowIso(),
      ],
    );

    await seedData();
  }

  const baseCount = await dbGet("SELECT COUNT(*) as count FROM textbooks WHERE is_base = 1");
  if (!baseCount?.count) {
    await restoreBaseTextbooks();
  }

  await normalizeWordPosData();
};

const seedData = async () => {
  const textbooks = [
    {
      name: "PEP英语七下",
      is_base: 1,
      lessons: [
        {
          name: "Lesson 1",
          words: [
            { word: "repair", meaning: "v. 修理，修补", phonetic: "/rɪˈper/" },
            {
              word: "careful",
              meaning: "adj. 小心的；仔细的",
              phonetic: "/ˈkerfəl/",
            },
            {
              word: "engineer",
              meaning: "n. 工程师",
              phonetic: "/ˌendʒɪˈnɪr/",
            },
            { word: "bridge", meaning: "n. 桥", phonetic: "/brɪdʒ/" },
            { word: "tool", meaning: "n. 工具", phonetic: "/tuːl/" },
          ],
        },
        {
          name: "Lesson 2",
          words: [
            { word: "future", meaning: "n. 未来", phonetic: "/ˈfjuːtʃər/" },
            { word: "travel", meaning: "v. 旅行", phonetic: "/ˈtrævəl/" },
            { word: "planet", meaning: "n. 行星", phonetic: "/ˈplænɪt/" },
            { word: "rocket", meaning: "n. 火箭", phonetic: "/ˈrɑːkɪt/" },
            { word: "invent", meaning: "v. 发明", phonetic: "/ɪnˈvent/" },
          ],
        },
      ],
    },
    {
      name: "PEP英语八下",
      is_base: 1,
      lessons: [
        {
          name: "Lesson 1",
          words: [
            {
              word: "volunteer",
              meaning: "v. 志愿服务",
              phonetic: "/ˌvɑːlənˈtɪr/",
            },
            {
              word: "community",
              meaning: "n. 社区",
              phonetic: "/kəˈmjuːnəti/",
            },
            { word: "support", meaning: "v. 支持", phonetic: "/səˈpɔːrt/" },
            { word: "raise", meaning: "v. 筹集；举起", phonetic: "/reɪz/" },
            {
              word: "notice",
              meaning: "n. 通知；v. 注意到",
              phonetic: "/ˈnoʊtɪs/",
            },
          ],
        },
        {
          name: "Lesson 2",
          words: [
            { word: "decide", meaning: "v. 决定", phonetic: "/dɪˈsaɪd/" },
            { word: "pressure", meaning: "n. 压力", phonetic: "/ˈpreʃər/" },
            { word: "argue", meaning: "v. 争论", phonetic: "/ˈɑːrɡjuː/" },
            { word: "relation", meaning: "n. 关系", phonetic: "/rɪˈleɪʃən/" },
            { word: "skill", meaning: "n. 技能", phonetic: "/skɪl/" },
          ],
        },
      ],
    },
  ];

  for (const [tIndex, textbook] of textbooks.entries()) {
    const { lastID: textbookId } = await dbRun(
      "INSERT INTO textbooks (name, sort_order, is_base) VALUES (?, ?, ?)",
      [textbook.name, tIndex, Number(textbook.is_base || 0)],
    );

    for (const [lIndex, lesson] of textbook.lessons.entries()) {
      const { lastID: lessonId } = await dbRun(
        "INSERT INTO lessons (textbook_id, name, sort_order) VALUES (?, ?, ?)",
        [textbookId, lesson.name, lIndex],
      );

      for (const [wIndex, word] of lesson.words.entries()) {
        await dbRun(
          "INSERT INTO words (lesson_id, word, meaning, phonetic, sort_order) VALUES (?, ?, ?, ?, ?)",
          [lessonId, word.word, word.meaning, word.phonetic || "", wIndex],
        );
      }
    }
  }
};

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: "请输入账号和密码" });

  const user = await dbGet("SELECT * FROM users WHERE username = ?", [
    username,
  ]);
  if (!user) {
    await createActivityLog({
      req,
      username,
      action: "login_failed",
      metadata: { reason: "user_not_found" },
    });
    return res.status(401).json({ error: "账号或密码错误" });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    await createActivityLog({
      req,
      userId: user.id,
      username: user.username,
      role: user.role,
      action: "login_failed",
      metadata: { reason: "wrong_password" },
    });
    return res.status(401).json({ error: "账号或密码错误" });
  }

  const token = nanoid(32);
  const expiresAt = addMinutes(new Date(), 60 * 24 * 30).toISOString();
  await dbRun(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
    [token, user.id, expiresAt],
  );

  await createActivityLog({
    req,
    userId: user.id,
    username: user.username,
    role: user.role,
    action: "login",
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name || user.username,
      bio: user.bio || "",
      role: user.role,
      avatar_url: user.avatar_url || "",
      birth_date: user.birth_date || "",
      grade: user.grade || "",
      phone: user.phone || "",
      gender: user.gender || "",
    },
  });
});

app.post("/api/register", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const name = String(req.body?.name || "").trim();
  const birthDate = String(req.body?.birth_date ?? req.body?.birthDate ?? "").trim();
  const grade = String(req.body?.grade || "").trim();
  const phone = String(req.body?.phone || "").trim();
  const gender = String(req.body?.gender || "").trim();

  if (!username || !password || !birthDate || !grade || !phone || !gender) {
    return res.status(400).json({ error: "请完整填写注册信息" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "密码长度至少为6位" });
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(birthDate)) {
    return res.status(400).json({ error: "出生年月格式应为YYYY-MM" });
  }
  if (!["男", "女", "其他", "保密"].includes(gender)) {
    return res.status(400).json({ error: "性别字段无效" });
  }
  const normalizedPhone = normalizePhoneValue(phone);
  if (!/^\+?\d{6,20}$/.test(normalizedPhone)) {
    return res.status(400).json({ error: "手机号格式无效" });
  }
  const gradeLevel = parseGradeLevel(grade);
  if (!gradeLevel) {
    return res.status(400).json({ error: "在读年级无效，仅支持一年级至九年级、高一至高三" });
  }

  const existing = await dbGet("SELECT id FROM users WHERE username = ?", [username]);
  if (existing) return res.status(400).json({ error: "Username already exists" });

  const hash = await bcrypt.hash(password, 10);
  const displayName = name || username;
  const { lastID } = await dbRun(
    "INSERT INTO users (username, password_hash, name, role, created_at, birth_date, grade, phone, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [username, hash, displayName, "student", nowIso(), birthDate, grade, phone, gender],
  );

  await grantUserTextbookAccessByGrade(lastID, grade);

  const token = nanoid(32);
  const expiresAt = addMinutes(new Date(), 60 * 24 * 30).toISOString();
  await dbRun(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
    [token, lastID, expiresAt]
  );

  await createActivityLog({
    req,
    userId: lastID,
    username,
    role: "student",
    action: "register",
    metadata: { grade, gender },
  });

  res.json({
    token,
    user: {
      id: lastID,
      username,
      name: displayName,
      bio: "",
      role: "student",
      avatar_url: "",
      birth_date: birthDate,
      grade,
      phone,
      gender,
    }
  });
});

app.post("/api/logout", auth, async (req, res) => {
  await createActivityLog({
    req,
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: "logout",
  });
  await dbRun("DELETE FROM sessions WHERE token = ?", [req.token]);
  res.json({ ok: true });
});

app.get("/api/me", auth, async (req, res) => {
  const dueCount = await dbGet(
    "SELECT COUNT(*) as count FROM user_word_stats WHERE user_id = ? AND wrongbook = 1 AND mastered_at IS NULL AND next_review_at <= ?",
    [req.user.id, nowIso()],
  );
  const wrongCount = await dbGet(
    "SELECT COUNT(*) as count FROM user_word_stats WHERE user_id = ? AND wrongbook = 1 AND mastered_at IS NULL",
    [req.user.id],
  );
  res.json({
    user: {
      ...req.user,
      name: req.user.name || req.user.username,
      bio: req.user.bio || "",
      avatar_url: req.user.avatar_url || "",
      birth_date: req.user.birth_date || "",
      grade: req.user.grade || "",
      phone: req.user.phone || "",
      gender: req.user.gender || "",
    }, // Ensure name/avatar are present
    dueCount: dueCount?.count || 0,
    wrongCount: wrongCount?.count || 0,
  });
});

app.post("/api/activity/log", auth, async (req, res) => {
  const action = String(req.body?.action || "").trim().toLowerCase();
  if (!action) {
    return res.status(400).json({ error: "缺少行为标识 action" });
  }

  await createActivityLog({
    req,
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action,
    targetType: req.body?.targetType,
    targetId: req.body?.targetId,
    targetName: req.body?.targetName,
    metadata: req.body?.metadata,
  });

  res.json({ ok: true });
});

app.put("/api/me/profile", auth, async (req, res) => {
  const { name, bio, introduction, self_intro, avatar_url, avatarUrl } = req.body || {};
  const updates = [];
  const params = [];

  if (name !== undefined) {
    const nextName = String(name || "").trim();
    if (!nextName) {
      return res.status(400).json({ error: "姓名不能为空" });
    }
    updates.push("name = ?");
    params.push(nextName);
  }

  const incomingAvatar = avatar_url ?? avatarUrl;
  if (incomingAvatar !== undefined) {
    const nextAvatar = String(incomingAvatar || "").trim();
    if (nextAvatar) {
      const isDataImage = /^data:image\/(png|jpe?g|webp|gif|bmp);base64,[a-z0-9+/=]+$/i.test(
        nextAvatar,
      );
      if (!isDataImage) {
        return res.status(400).json({ error: "头像格式无效，仅支持图片 data URL" });
      }
      const maxChars = 2 * 1024 * 1024; // ~2MB encoded payload
      if (nextAvatar.length > maxChars) {
        return res.status(400).json({ error: "头像过大，请压缩后重试" });
      }
    }
    updates.push("avatar_url = ?");
    params.push(nextAvatar);
  }

  const incomingBio = bio ?? introduction ?? self_intro;
  if (incomingBio !== undefined) {
    const nextBio = String(incomingBio || "").trim();
    if (nextBio.length > 100) {
      return res.status(400).json({ error: "自我介绍最多100字" });
    }
    updates.push("bio = ?");
    params.push(nextBio);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "没有可更新的内容" });
  }

  params.push(req.user.id);
  await dbRun(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);

  const user = await dbGet(
    "SELECT id, username, name, bio, role, active, avatar_url, birth_date, grade, phone, gender FROM users WHERE id = ?",
    [req.user.id],
  );

  res.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name || user.username,
      bio: user.bio || "",
      role: user.role,
      avatar_url: user.avatar_url || "",
      birth_date: user.birth_date || "",
      grade: user.grade || "",
      phone: user.phone || "",
      gender: user.gender || "",
    },
  });
});

app.put("/api/me/password", auth, async (req, res) => {
  const currentPassword = String(req.body?.current_password ?? req.body?.currentPassword ?? "");
  const nextPassword = String(req.body?.new_password ?? req.body?.newPassword ?? "");

  if (!currentPassword || !nextPassword) {
    return res.status(400).json({ error: "请填写当前密码和新密码" });
  }
  if (nextPassword.length < 6) {
    return res.status(400).json({ error: "新密码长度至少为6位" });
  }
  if (currentPassword === nextPassword) {
    return res.status(400).json({ error: "新密码不能与当前密码相同" });
  }

  const user = await dbGet("SELECT id, password_hash FROM users WHERE id = ?", [req.user.id]);
  if (!user) {
    return res.status(404).json({ error: "用户不存在" });
  }

  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) {
    return res.status(400).json({ error: "当前密码错误" });
  }

  const hash = await bcrypt.hash(nextPassword, 10);
  await dbRun("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.user.id]);
  await dbRun("DELETE FROM sessions WHERE user_id = ? AND token != ?", [req.user.id, req.token]);

  res.json({ ok: true });
});

app.get("/api/me/stats", auth, async (req, res) => {
  const userId = req.user.id;

  // Total words in vocabulary (words user has ever interacted with or added to stats)
  // Actually, "Total Words" in the app context usually means total words in the user's vocabulary list/progress.
  // Let's count all records in user_word_stats for this user.
  const total = await dbGet(
    "SELECT COUNT(*) as count FROM user_word_stats WHERE user_id = ?",
    [userId],
  );

  // Mastered
  const mastered = await dbGet(
    "SELECT COUNT(*) as count FROM user_word_stats WHERE user_id = ? AND mastered_at IS NOT NULL",
    [userId],
  );

  // Learning: words currently in wrongbook and not mastered
  const learning = await dbGet(
    "SELECT COUNT(*) as count FROM user_word_stats WHERE user_id = ? AND wrongbook = 1 AND mastered_at IS NULL",
    [userId],
  );

  // To Review (wrongbook=1, not mastered, simple check for now, matching "wrongbook" logic or "due" logic?
  // usage in app.js suggests "learning" key matches Learning.
  // In the reference app:
  // - Total: vocabularyItems.length
  // - Mastered: status === 'mastered'
  // - Learning: status === 'learning'
  // - Review: reviewItems.length (which usually implies due items)

  // Let's refine "Learning": In the reference app, it seems to track words that are actively being learned.
  // Here, any word in user_word_stats that is NOT mastered is technically "learning".

  // Let's refine "Review": The reference app has a separate count for "To Review".
  // content of "Review" card is `reviewCount` which comes from `reviewItems.length`.
  // `reviewItems` usually means items due for review.
  const toReview = await dbGet(
    "SELECT COUNT(*) as count FROM user_word_stats WHERE user_id = ? AND wrongbook = 1 AND mastered_at IS NULL AND next_review_at <= ?",
    [userId, nowIso()],
  );

  res.json({
    total: total?.count || 0,
    mastered: mastered?.count || 0,
    learning: learning?.count || 0,
    review: toReview?.count || 0,
  });
});

app.get("/api/review/stages", auth, (req, res) => {
  res.json({ stages: REVIEW_STAGES });
});

app.get("/api/textbooks", auth, async (req, res) => {
  let textbooks;
  // Students only see textbooks they have access to
  if (req.user.role !== "admin") {
    const hasAnyAccess = await dbGet("SELECT COUNT(*) as count FROM user_textbook_access WHERE user_id = ?", [req.user.id]);
    if (hasAnyAccess?.count > 0) {
      textbooks = await dbAll(
        `SELECT t.* FROM textbooks t
         INNER JOIN user_textbook_access ua ON ua.textbook_id = t.id
         WHERE ua.user_id = ?
         ORDER BY t.is_base DESC, t.sort_order, t.id`,
        [req.user.id]
      );
    } else {
      // No access records = show all (backward compatible)
      textbooks = await dbAll("SELECT * FROM textbooks ORDER BY is_base DESC, sort_order, id");
    }
  } else {
    textbooks = await dbAll("SELECT * FROM textbooks ORDER BY is_base DESC, sort_order, id");
  }

  // 把用户"正在使用"的那册排到最前面
  const me = await dbGet("SELECT current_textbook_id FROM users WHERE id = ?", [req.user.id]).catch(() => null);
  let currentId = Number(me?.current_textbook_id || 0);
  // 老用户还没手动选过册时，用最近一次打开的课本兜底
  if (!currentId) {
    const lastLog = await dbGet(
      `SELECT metadata FROM activity_logs
       WHERE user_id = ? AND metadata LIKE '%textbookId%'
       ORDER BY id DESC LIMIT 1`,
      [req.user.id],
    ).catch(() => null);
    if (lastLog?.metadata) {
      try {
        const parsed = JSON.parse(lastLog.metadata);
        currentId = Number(parsed?.textbookId || 0);
      } catch {
        currentId = 0;
      }
    }
  }
  if (currentId) {
    const idx = textbooks.findIndex((t) => Number(t.id) === currentId);
    if (idx > 0) {
      const [picked] = textbooks.splice(idx, 1);
      textbooks.unshift(picked);
    }
  }

  // Enrich with lessons (including word_count) and metadata
  const enrichedTextbooks = await Promise.all(textbooks.map(async (tb) => {
    const lessons = await dbAll(
      `SELECT l.id, l.name, l.sort_order,
              (SELECT COUNT(*) FROM words WHERE lesson_id = l.id) as word_count,
              (SELECT COUNT(*) FROM sentences WHERE lesson_id = l.id) as sentence_count
       FROM lessons l WHERE l.textbook_id = ? ORDER BY l.sort_order, l.id`,
      [tb.id]
    );

    let grade = "七年级";
    if (tb.name.includes("八")) grade = "八年级";
    if (tb.name.includes("九")) grade = "九年级";

    return {
      ...tb,
      publisher: "人民教育出版社",
      grade,
      lessons,
      description: `${grade}英语教材`,
      coverImage: ""
    };
  }));

  res.json({ textbooks: enrichedTextbooks });
});

app.get("/api/textbooks/:id/lessons", auth, async (req, res) => {
  const textbook = await dbGet("SELECT id, name FROM textbooks WHERE id = ?", [req.params.id]);
  if (textbook) {
    await createActivityLog({
      req,
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: "click_textbook",
      targetType: "textbook",
      targetId: textbook.id,
      targetName: textbook.name,
    });
  }
  const rows = await dbAll(
    "SELECT * FROM lessons WHERE textbook_id = ? ORDER BY sort_order, id",
    [req.params.id],
  );
  res.json({ lessons: rows });
});

app.get("/api/lessons/:id", auth, async (req, res) => {
  const lesson = await dbGet("SELECT * FROM lessons WHERE id = ?", [req.params.id]);
  if (!lesson) return res.status(404).json({ error: "Lesson not found" });
  res.json({ lesson });
});

app.get("/api/lessons/:id/words", auth, async (req, res) => {
  const includeStatus = req.query.includeStatus === "1";
  const lessonForLog = await dbGet(
    `SELECT l.id, l.name, t.id AS textbook_id, t.name AS textbook_name
     FROM lessons l
     LEFT JOIN textbooks t ON t.id = l.textbook_id
     WHERE l.id = ?`,
    [req.params.id],
  );
  if (lessonForLog) {
    await createActivityLog({
      req,
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: includeStatus ? "open_lesson_words_with_status" : "click_lesson",
      targetType: "lesson",
      targetId: lessonForLog.id,
      targetName: lessonForLog.name,
      metadata: {
        textbookId: lessonForLog.textbook_id,
        textbookName: lessonForLog.textbook_name,
      },
    });
  }
  let rows = [];
  if (includeStatus) {
    rows = await dbAll(
      `SELECT w.id, w.word, w.meaning, w.phonetic, w.phonetic AS phone, w.part_of_speech, w.tts_engine, w.entries, w.lesson_id, w.sort_order,
              u.stage, u.wrongbook, u.mastered_at, u.next_review_at
       FROM words w
       LEFT JOIN user_word_stats u ON u.word_id = w.id AND u.user_id = ?
       WHERE w.lesson_id = ?
       ORDER BY w.sort_order, w.id`,
      [req.user.id, req.params.id],
    );
  } else {
    rows = await dbAll(
      "SELECT id, word, meaning, phonetic, phonetic AS phone, part_of_speech, tts_engine, entries, lesson_id, sort_order FROM words WHERE lesson_id = ? ORDER BY sort_order, id",
      [req.params.id],
    );
  }
  res.json({ words: rows });
});

// ===== 句子（常用语句）=====
// 句子记忆曲线：与单词一致的 9 档间隔（分钟）
const SENTENCE_STAGE_MINUTES = [5, 30, 1440, 4320, 10080, 20160, 43200, 86400, 129600];

// 待复习句子（跨册），供"复习本"使用
// 句子总览统计：口径严格对齐 /api/me/stats（单词侧）
//   total    = 用户「接触过」的句子数（user_sentence_stats 中有记录），不是全库句子数
//   mastered = 已掌握
//   learning = 练过但还没掌握
//   due      = 练过、未掌握、且记忆曲线上已到期（next_review_at 有值且 <= now）
//              —— 从未练过的句子没有记忆曲线，不算「待复习」
app.get("/api/sentences/stats", auth, async (req, res) => {
  const nowIso = new Date().toISOString();
  const total = Number(
    (await dbGet("SELECT COUNT(*) AS c FROM user_sentence_stats WHERE user_id = ?", [req.user.id]))?.c || 0,
  );
  const mastered = Number(
    (await dbGet("SELECT COUNT(*) AS c FROM user_sentence_stats WHERE user_id = ? AND mastered_at IS NOT NULL AND mastered_at != ''", [req.user.id]))?.c || 0,
  );
  const learning = Number(
    (await dbGet("SELECT COUNT(*) AS c FROM user_sentence_stats WHERE user_id = ? AND (mastered_at IS NULL OR mastered_at = '') AND review_count > 0", [req.user.id]))?.c || 0,
  );
  const due = Number(
    (await dbGet(
      `SELECT COUNT(*) AS c FROM user_sentence_stats st
       WHERE st.user_id = ?
         AND (st.mastered_at IS NULL OR st.mastered_at = '')
         AND st.next_review_at IS NOT NULL
         AND st.next_review_at <= ?`,
      [req.user.id, nowIso],
    ))?.c || 0,
  );
  // library：平台上线的句子总量（仅作参考，不参与学习进度统计）
  const library = Number((await dbGet("SELECT COUNT(*) AS c FROM sentences"))?.c || 0);
  res.json({ total, mastered, learning, due, library, untouched: Math.max(library - total, 0) });
});

app.get("/api/sentences/due", auth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const nowIso = new Date().toISOString();
  const rows = await dbAll(
    `SELECT s.id, s.lesson_id, s.en, s.zh, s.pattern, s.grammar_point, s.category, s.source,
            l.name AS lesson_name, t.name AS textbook_name,
            COALESCE(st.stage, 0) AS stage,
            COALESCE(st.review_count, 0) AS review_count,
            st.mastered_at AS mastered_at,
            st.next_review_at AS next_review_at
     FROM user_sentence_stats st
     JOIN sentences s ON s.id = st.sentence_id
     JOIN lessons l ON l.id = s.lesson_id
     JOIN textbooks t ON t.id = l.textbook_id
     WHERE st.user_id = ?
       AND (st.mastered_at IS NULL OR st.mastered_at = '')
       AND st.next_review_at IS NOT NULL
       AND st.next_review_at <= ?
     ORDER BY st.next_review_at ASC, s.lesson_id, s.sort_order
     LIMIT ?`,
    [req.user.id, nowIso, limit],
  );
  res.json({ sentences: rows, server_time: nowIso });
});

app.get("/api/lessons/:id/sentences", auth, async (req, res) => {
  const rows = await dbAll(
    `SELECT s.id, s.lesson_id, s.en, s.zh, s.pattern, s.grammar_point, s.category, s.source, s.sort_order,
            s.exam_point, COALESCE(s.is_review, 0) AS is_review,
            COALESCE(st.review_count, 0) AS review_count,
            COALESCE(st.correct_count, 0) AS correct_count,
            COALESCE(st.stage, 0) AS stage,
            COALESCE(st.first_try, 0) AS first_try,
            st.mastered_at AS mastered_at,
            st.next_review_at AS next_review_at
     FROM sentences s
     LEFT JOIN user_sentence_stats st ON st.sentence_id = s.id AND st.user_id = ?
     WHERE s.lesson_id = ?
     ORDER BY s.sort_order, s.id`,
    [req.user.id, req.params.id],
  );
  res.json({ sentences: rows });
});

// ===== 考点专练 =====
// 「已学范围」的口径：用户在某册里练到过的最远单元，该单元及之前的所有句子都算已学。
// 不按「单句练过才算」，否则刚起步的用户什么都练不了；
// 也不越过教材进度，否则会出现还没学到的单元。
const SCOPE_SQL = `
  LEFT JOIN (
    SELECT l2.textbook_id AS tb, MAX(l2.id) AS max_id
    FROM user_sentence_stats st2
    JOIN sentences s2 ON s2.id = st2.sentence_id
    JOIN lessons l2 ON l2.id = s2.lesson_id
    WHERE st2.user_id = ?
    GROUP BY l2.textbook_id
  ) p ON p.tb = l.textbook_id`;
const IN_SCOPE = `(p.max_id IS NOT NULL AND l.id <= p.max_id)`;

// 考点列表：每考点总句数 / 已学范围内句数 / 已掌握数 / 配套练习题数
app.get("/api/sentences/exam-points", auth, async (req, res) => {
  const rows = await dbAll(
    `SELECT s.exam_point AS exam_point,
            COUNT(*) AS total,
            SUM(CASE WHEN ${IN_SCOPE} THEN 1 ELSE 0 END) AS learned,
            SUM(CASE WHEN st.mastered_at IS NOT NULL AND st.mastered_at != '' THEN 1 ELSE 0 END) AS mastered,
            MIN(l.id) AS first_lesson_id
     FROM sentences s
     JOIN lessons l ON l.id = s.lesson_id
     LEFT JOIN user_sentence_stats st ON st.sentence_id = s.id AND st.user_id = ?
     ${SCOPE_SQL}
     WHERE s.exam_point IS NOT NULL AND s.exam_point != ''
     GROUP BY s.exam_point`,
    [req.user.id, req.user.id],
  );
  const drillRows = await dbAll(
    `SELECT exam_point, COUNT(*) AS c FROM sentence_drills GROUP BY exam_point`,
  );
  const drillMap = new Map(drillRows.map((r) => [r.exam_point, Number(r.c || 0)]));
  const unitRows = await dbAll(
    `SELECT s.exam_point AS exam_point, l.name AS unit
     FROM sentences s JOIN lessons l ON l.id = s.lesson_id
     WHERE s.exam_point IS NOT NULL AND s.exam_point != ''
     ORDER BY l.id, s.sort_order`,
  );
  const unitMap = new Map();
  unitRows.forEach((r) => {
    if (!unitMap.has(r.exam_point)) unitMap.set(r.exam_point, new Set());
    unitMap.get(r.exam_point).add(r.unit);
  });

  const points = rows
    .map((r) => ({
      exam_point: r.exam_point,
      total: Number(r.total || 0),
      learned: Number(r.learned || 0),
      mastered: Number(r.mastered || 0),
      drills: drillMap.get(r.exam_point) || 0,
      // 按教材单元顺序排（同册内 lesson id 递增即为单元顺序）
      first_lesson_id: Number(r.first_lesson_id || 0),
      units: Array.from(unitMap.get(r.exam_point) || []),
    }))
    .sort((a, b) => a.first_lesson_id - b.first_lesson_id || b.total - a.total);
  res.json({ points });
});

// 某考点的针对性练习：只取「已学单元范围内」的句子，避免提前出现未学单元的上下文
// 同时返回每句配套的挖空题（sentence_drills）
app.get("/api/sentences/drill", auth, async (req, res) => {
  const ep = String(req.query.exam_point || "").trim();
  if (!ep) return res.status(400).json({ error: "exam_point required" });
  const rows = await dbAll(
    `SELECT s.id, s.lesson_id, s.en, s.zh, s.pattern, s.grammar_point, s.category, s.source,
            s.exam_point, COALESCE(s.is_review, 0) AS is_review,
            l.name AS lesson_name, t.name AS textbook_name,
            COALESCE(st.stage, 0) AS stage,
            COALESCE(st.review_count, 0) AS review_count,
            st.mastered_at AS mastered_at,
            st.next_review_at AS next_review_at
     FROM sentences s
     JOIN lessons l ON l.id = s.lesson_id
     JOIN textbooks t ON t.id = l.textbook_id
     LEFT JOIN user_sentence_stats st ON st.sentence_id = s.id AND st.user_id = ?
     ${SCOPE_SQL}
     WHERE s.exam_point = ? AND ${IN_SCOPE}
     ORDER BY l.id, s.sort_order`,
    [req.user.id, req.user.id, ep],
  );
  const ids = rows.map((r) => r.id);
  let drills = [];
  if (ids.length) {
    const ph = ids.map(() => "?").join(",");
    drills = await dbAll(
      `SELECT id, sentence_id, exam_point, kind, prompt, answer, hint, sort_order
       FROM sentence_drills WHERE sentence_id IN (${ph}) ORDER BY sort_order`,
      ids,
    );
  }
  const drillMap = {};
  drills.forEach((d) => {
    if (!drillMap[d.sentence_id]) drillMap[d.sentence_id] = [];
    drillMap[d.sentence_id].push(d);
  });
  res.json({ sentences: rows, drills: drillMap });
});

app.post("/api/sentences/:id/review", auth, async (req, res) => {
  const sentenceId = Number(req.params.id);
  if (!Number.isFinite(sentenceId)) return res.status(400).json({ error: "invalid id" });
  const ok = req.body?.correct === true || req.body?.correct === 1;
  // fixed: 这一遍是"错词修补后"才对的，用于区分一次过
  const fixed = req.body?.fixed === true;
  const now = new Date();
  const nowIso = now.toISOString();

  const prev = await dbGet(
    "SELECT stage, review_count, correct_count, first_try FROM user_sentence_stats WHERE user_id = ? AND sentence_id = ?",
    [req.user.id, sentenceId],
  );
  const prevStage = Number(prev?.stage || 0);
  // 一次过才升档；修补通过只保档（至少 1）；答错回退一档
  let stage = prevStage;
  if (ok && !fixed) stage = Math.min(prevStage + 1, 8);
  else if (ok && fixed) stage = Math.max(prevStage, 1);
  else stage = Math.max(prevStage - 1, 0);

  const intervalMinutes = SENTENCE_STAGE_MINUTES[stage] ?? 5;
  const nextReview = new Date(now.getTime() + intervalMinutes * 60 * 1000).toISOString();
  const masteredAt = stage >= 8 ? (prev?.stage >= 8 ? undefined : nowIso) : null;
  const firstTry = ok && !fixed ? 1 : 0;

  await dbRun(
    `INSERT INTO user_sentence_stats (user_id, sentence_id, review_count, correct_count, last_review_at, stage, mastered_at, first_try, next_review_at)
     VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, sentence_id) DO UPDATE SET
       review_count = review_count + 1,
       correct_count = correct_count + excluded.correct_count,
       last_review_at = excluded.last_review_at,
       stage = excluded.stage,
       mastered_at = COALESCE(excluded.mastered_at, mastered_at),
       first_try = MAX(first_try, excluded.first_try),
       next_review_at = excluded.next_review_at`,
    [req.user.id, sentenceId, ok ? 1 : 0, nowIso, stage, masteredAt ?? null, firstTry, nextReview],
  );
  const stat = await dbGet(
    "SELECT review_count, correct_count, stage, mastered_at, first_try, next_review_at FROM user_sentence_stats WHERE user_id = ? AND sentence_id = ?",
    [req.user.id, sentenceId],
  );
  res.json({ ok: true, stat });
});

app.post("/api/me/current-textbook", auth, async (req, res) => {
  const textbookId = Number(req.body?.textbookId ?? req.body?.textbook_id ?? 0);
  await dbRun("UPDATE users SET current_textbook_id = ? WHERE id = ?", [textbookId || 0, req.user.id]);
  res.json({ ok: true, current_textbook_id: textbookId || 0 });
});

app.get("/api/lessons/:id/phonetics", auth, async (req, res) => {
  const rows = await dbAll(
    "SELECT id, phonetic, phonetic AS phone FROM words WHERE lesson_id = ? ORDER BY sort_order, id",
    [req.params.id],
  );
  res.json({ phonetics: rows });
});

app.post("/api/lessons/:id/review-anchor", auth, async (req, res) => {
  const lessonId = Number(req.params.id);
  if (!Number.isInteger(lessonId) || lessonId <= 0) {
    return res.status(400).json({ error: "无效课程ID" });
  }

  const lesson = await dbGet(
    `SELECT l.id, l.name, t.id AS textbook_id, t.name AS textbook_name
     FROM lessons l
     LEFT JOIN textbooks t ON t.id = l.textbook_id
     WHERE l.id = ?`,
    [lessonId],
  );
  if (!lesson) {
    return res.status(404).json({ error: "课程不存在" });
  }

  const onlyStageZero = req.body?.onlyStageZero !== false;
  const stageFilterSql = onlyStageZero ? "AND u.stage = 0" : "";
  const candidates = await dbAll(
    `SELECT u.id, u.stage
     FROM user_word_stats u
     WHERE u.user_id = ?
       AND u.wrongbook = 1
       AND u.mastered_at IS NULL
       AND u.word_id IN (SELECT id FROM words WHERE lesson_id = ?)
       ${stageFilterSql}`,
    [req.user.id, lessonId],
  );

  const baseTime = new Date();
  const now = nowIso();
  for (const row of candidates) {
    const stage = Number.isInteger(row.stage) ? row.stage : 0;
    await dbRun(
      "UPDATE user_word_stats SET next_review_at = ?, last_review_at = ? WHERE id = ?",
      [computeNextReviewFromBase(stage, baseTime), now, row.id],
    );
  }

  await createActivityLog({
    req,
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: "anchor_lesson_review_time",
    targetType: "lesson",
    targetId: lesson.id,
    targetName: lesson.name,
    metadata: {
      textbookId: lesson.textbook_id,
      textbookName: lesson.textbook_name,
      anchoredCount: candidates.length,
      onlyStageZero,
      baseTime: baseTime.toISOString(),
    },
  });

  res.json({
    ok: true,
    anchoredCount: candidates.length,
    lessonId: lesson.id,
    lessonName: lesson.name,
    baseTime: baseTime.toISOString(),
    onlyStageZero,
  });
});

app.post("/api/vocabulary/review-anchor", auth, async (req, res) => {
  const onlyStageZero = req.body?.onlyStageZero !== false;
  const stageFilterSql = onlyStageZero ? "AND u.stage = 0" : "";
  const candidates = await dbAll(
    `SELECT u.id, u.stage
     FROM user_word_stats u
     WHERE u.user_id = ?
       AND u.wrongbook = 1
       AND u.mastered_at IS NULL
       ${stageFilterSql}`,
    [req.user.id],
  );

  const baseTime = new Date();
  const now = nowIso();
  for (const row of candidates) {
    const stage = Number.isInteger(row.stage) ? row.stage : 0;
    await dbRun(
      "UPDATE user_word_stats SET next_review_at = ?, last_review_at = ? WHERE id = ?",
      [computeNextReviewFromBase(stage, baseTime), now, row.id],
    );
  }

  res.json({
    ok: true,
    anchoredCount: candidates.length,
    baseTime: baseTime.toISOString(),
    onlyStageZero,
  });
});

app.get("/api/vocabulary/items", auth, async (req, res) => {
  const rows = await dbAll(
    `SELECT
        w.id, w.lesson_id, w.word, w.meaning, w.phonetic, w.part_of_speech, w.tts_engine, w.entries,
        l.textbook_id, l.name AS lesson_name, t.name AS textbook_name,
        u.wrongbook, u.stage, u.next_review_at, u.last_review_at, u.review_count,
        u.mastered_at, u.mastered_stage, u.created_at,
        (SELECT e.result FROM user_word_memory_events e 
         WHERE e.user_id = u.user_id AND e.word_id = u.word_id 
         ORDER BY e.created_at DESC LIMIT 1) AS last_result
     FROM user_word_stats u
     JOIN words w ON w.id = u.word_id
     JOIN lessons l ON l.id = w.lesson_id
     JOIN textbooks t ON t.id = l.textbook_id
     WHERE u.user_id = ? AND (u.wrongbook = 1 OR u.mastered_at IS NOT NULL)
     ORDER BY
       CASE WHEN u.mastered_at IS NULL THEN 0 ELSE 1 END,
       CASE
         WHEN u.mastered_at IS NULL THEN COALESCE(u.next_review_at, u.last_review_at, u.created_at)
         ELSE COALESCE(u.mastered_at, u.last_review_at, u.created_at)
       END ASC,
       u.id ASC`,
    [req.user.id],
  );

  const now = Date.now();
  const words = rows.map((row) => {
    const isMastered = !!row.mastered_at;
    const nextReviewAt = row.next_review_at ? new Date(row.next_review_at).getTime() : NaN;
    const isDue = !isMastered && Number.isFinite(nextReviewAt) && nextReviewAt <= now;
    return {
      ...row,
      status: isMastered ? "mastered" : isDue ? "review" : "learning",
      due: isDue ? 1 : 0,
    };
  });

  res.json({ words });
});

app.get("/api/wrongbook", auth, async (req, res) => {
  const rows = await dbAll(
    `SELECT w.id, w.lesson_id, w.word, w.meaning, w.phonetic, w.part_of_speech, w.tts_engine, w.entries,
            l.textbook_id, l.name AS lesson_name, t.name AS textbook_name,
            u.stage, u.next_review_at, u.last_review_at, u.review_count, u.mastered_at, u.mastered_stage, u.created_at
     FROM user_word_stats u
     JOIN words w ON w.id = u.word_id
     JOIN lessons l ON l.id = w.lesson_id
     JOIN textbooks t ON t.id = l.textbook_id
     WHERE u.user_id = ? AND u.wrongbook = 1 AND u.mastered_at IS NULL
     ORDER BY u.next_review_at ASC`,
    [req.user.id],
  );
  res.json({ words: rows });
});

app.get("/api/wrongbook/due", auth, async (req, res) => {
  const rows = await dbAll(
    `SELECT w.id, w.lesson_id, w.word, w.meaning, w.phonetic, w.part_of_speech, w.tts_engine, w.entries,
            l.textbook_id, l.name AS lesson_name, t.name AS textbook_name,
            u.stage, u.next_review_at, u.last_review_at, u.review_count, u.mastered_at, u.mastered_stage, u.created_at
     FROM user_word_stats u
     JOIN words w ON w.id = u.word_id
     JOIN lessons l ON l.id = w.lesson_id
     JOIN textbooks t ON t.id = l.textbook_id
     WHERE u.user_id = ? AND u.wrongbook = 1 AND u.mastered_at IS NULL AND u.next_review_at <= ?
     ORDER BY u.next_review_at ASC`,
    [req.user.id, nowIso()],
  );
  res.json({ words: rows });
});

app.get("/api/vocabulary/words/:id/memory", auth, async (req, res) => {
  const wordId = Number(req.params.id);
  if (!Number.isInteger(wordId) || wordId <= 0) {
    return res.status(400).json({ error: "无效单词ID" });
  }

  const stat = await dbGet(
    `SELECT
        u.user_id, u.word_id, u.wrongbook, u.stage, u.next_review_at, u.last_review_at,
        u.review_count, u.mastered_at, u.mastered_stage, u.created_at,
        w.word, w.meaning, w.phonetic, w.part_of_speech, w.tts_engine, w.entries,
        l.name AS lesson_name, l.id AS lesson_id, t.name AS textbook_name, t.id AS textbook_id
     FROM user_word_stats u
     JOIN words w ON w.id = u.word_id
     JOIN lessons l ON l.id = w.lesson_id
     JOIN textbooks t ON t.id = l.textbook_id
     WHERE u.user_id = ? AND u.word_id = ?`,
    [req.user.id, wordId],
  );
  if (!stat) {
    return res.status(404).json({ error: "该单词暂无记忆数据" });
  }

  const events = await dbAll(
    `SELECT id, event_type, from_stage, to_stage, result, source, metadata, created_at
     FROM user_word_memory_events
     WHERE user_id = ? AND word_id = ?
     ORDER BY created_at ASC, id ASC`,
    [req.user.id, wordId],
  );

  res.json({
    word: stat,
    events: events || [],
  });
});

app.post("/api/word/:id/seen", auth, async (req, res) => {
  const wordId = Number(req.params.id);
  if (!Number.isInteger(wordId) || wordId <= 0) {
    return res.status(400).json({ error: "无效单词ID" });
  }

  const word = await dbGet("SELECT id FROM words WHERE id = ?", [wordId]);
  if (!word) {
    return res.status(404).json({ error: "单词不存在" });
  }

  const existing = await dbGet(
    "SELECT id, stage FROM user_word_stats WHERE user_id = ? AND word_id = ?",
    [req.user.id, wordId],
  );

  if (!existing) {
    const createdAt = nowIso();
    await dbRun(
      `INSERT INTO user_word_stats
       (user_id, word_id, wrongbook, stage, next_review_at, last_review_at, review_count, created_at)
       VALUES (?, ?, 0, 0, NULL, ?, 0, ?)`,
      [req.user.id, wordId, createdAt, createdAt],
    );
    await createWordMemoryEvent({
      userId: req.user.id,
      wordId,
      eventType: "seen",
      fromStage: 0,
      toStage: 0,
      result: "seen",
      source: "study",
    });
  } else {
    const currentStage = normalizeStageIndex(existing.stage);
    await dbRun(
      "UPDATE user_word_stats SET last_review_at = ? WHERE id = ?",
      [nowIso(), existing.id],
    );
    await createWordMemoryEvent({
      userId: req.user.id,
      wordId,
      eventType: "seen",
      fromStage: currentStage,
      toStage: currentStage,
      result: "seen",
      source: "study",
    });
  }

  res.json({ ok: true });
});

app.post("/api/word/:id/mastered", auth, async (req, res) => {
  const wordId = Number(req.params.id);
  const existing = await dbGet(
    "SELECT * FROM user_word_stats WHERE user_id = ? AND word_id = ?",
    [req.user.id, wordId],
  );
  const masteredAt = nowIso();
  const finalStage = REVIEW_STAGES.length - 1;
  const currentStage = normalizeStageIndex(existing?.stage ?? 0);
  if (!existing) {
    await dbRun(
      `INSERT INTO user_word_stats
       (user_id, word_id, wrongbook, stage, next_review_at, last_review_at, review_count, mastered_at, mastered_stage, created_at)
       VALUES (?, ?, 0, ?, NULL, ?, 0, ?, ?, ?)`,
      [req.user.id, wordId, finalStage, masteredAt, masteredAt, 0, masteredAt],
    );
  } else {
    await dbRun(
      `UPDATE user_word_stats
       SET wrongbook = 0, stage = ?, next_review_at = NULL, mastered_at = ?, mastered_stage = ?, last_review_at = ?
       WHERE id = ?`,
      [finalStage, masteredAt, currentStage, masteredAt, existing.id],
    );
  }
  await createWordMemoryEvent({
    userId: req.user.id,
    wordId,
    eventType: "mastered",
    fromStage: currentStage,
    toStage: finalStage,
    result: "manual",
    source: "manual",
    metadata: { currentStage, finalStage },
  });
  res.json({ ok: true });
});

app.post("/api/word/:id/reset-to-new", auth, async (req, res) => {
  const wordId = Number(req.params.id);
  if (!Number.isInteger(wordId) || wordId <= 0) {
    return res.status(400).json({ error: "无效单词ID" });
  }

  const stat = await dbGet(
    `SELECT
        u.id, u.word_id, u.user_id, u.stage, u.review_count, u.mastered_at,
        w.word,
        l.id AS lesson_id,
        l.name AS lesson_name,
        t.id AS textbook_id,
        t.name AS textbook_name
     FROM user_word_stats u
     JOIN words w ON w.id = u.word_id
     JOIN lessons l ON l.id = w.lesson_id
     JOIN textbooks t ON t.id = l.textbook_id
     WHERE u.user_id = ? AND u.word_id = ?`,
    [req.user.id, wordId],
  );

  if (!stat) {
    return res.status(404).json({ error: "该单词暂无生字本记录" });
  }

  const resetAt = nowIso();
  const currentStage = normalizeStageIndex(stat.stage ?? 0);
  await dbRun(
    "DELETE FROM user_word_memory_events WHERE user_id = ? AND word_id = ?",
    [req.user.id, wordId],
  );
  await dbRun(
    `UPDATE user_word_stats
     SET wrongbook = 1,
         stage = 0,
         next_review_at = ?,
         last_review_at = ?,
         review_count = 0,
         mastered_at = NULL,
         mastered_stage = NULL,
         created_at = ?
     WHERE user_id = ? AND word_id = ?`,
    [resetAt, resetAt, resetAt, req.user.id, wordId],
  );
  await createWordMemoryEvent({
    userId: req.user.id,
    wordId,
    eventType: "reset",
    fromStage: currentStage,
    toStage: 0,
    result: "reset",
    source: "manual",
    metadata: {
      resetAt,
      previousReviewCount: Number(stat.review_count || 0),
      wasMastered: !!stat.mastered_at,
    },
  });

  await createActivityLog({
    req,
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: "reset_word_to_new",
    targetType: "word",
    targetId: stat.word_id,
    targetName: stat.word,
    metadata: {
      lessonId: stat.lesson_id,
      lessonName: stat.lesson_name,
      textbookId: stat.textbook_id,
      textbookName: stat.textbook_name,
      fromStage: currentStage,
      toStage: 0,
      movedToReview: true,
    },
  });

  res.json({ ok: true });
});

// 放回生字本：已掌握的单词发现遗忘后重新回到学习中（保留记忆轨迹与复习次数）
app.post("/api/word/:id/put-back", auth, async (req, res) => {
  const wordId = Number(req.params.id);
  if (!Number.isInteger(wordId) || wordId <= 0) {
    return res.status(400).json({ error: "无效单词ID" });
  }

  const stat = await dbGet(
    `SELECT
        u.id, u.word_id, u.user_id, u.stage, u.review_count, u.mastered_at, u.mastered_stage,
        w.word,
        l.id AS lesson_id,
        l.name AS lesson_name,
        t.id AS textbook_id,
        t.name AS textbook_name
     FROM user_word_stats u
     JOIN words w ON w.id = u.word_id
     JOIN lessons l ON l.id = w.lesson_id
     JOIN textbooks t ON t.id = l.textbook_id
     WHERE u.user_id = ? AND u.word_id = ?`,
    [req.user.id, wordId],
  );

  if (!stat) {
    return res.status(404).json({ error: "该单词暂无生字本记录" });
  }
  if (!stat.mastered_at) {
    return res.status(400).json({ error: "该单词尚未标记为已掌握，无需放回" });
  }

  const putBackAt = nowIso();
  const fromStage = normalizeStageIndex(stat.stage ?? 0);
  await dbRun(
    `UPDATE user_word_stats
     SET wrongbook = 1,
         stage = 0,
         next_review_at = ?,
         last_review_at = ?,
         mastered_at = NULL,
         mastered_stage = NULL
     WHERE user_id = ? AND word_id = ?`,
    [putBackAt, putBackAt, req.user.id, wordId],
  );
  await createWordMemoryEvent({
    userId: req.user.id,
    wordId,
    eventType: "putback",
    fromStage,
    toStage: 0,
    result: "putback",
    source: "manual",
    metadata: {
      putBackAt,
      masteredAt: stat.mastered_at,
      previousMasteredStage: Number.isInteger(stat.mastered_stage) ? stat.mastered_stage : null,
    },
  });

  await createActivityLog({
    req,
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: "put_word_back_to_vocabulary",
    targetType: "word",
    targetId: stat.word_id,
    targetName: stat.word,
    metadata: {
      lessonId: stat.lesson_id,
      lessonName: stat.lesson_name,
      textbookId: stat.textbook_id,
      textbookName: stat.textbook_name,
      fromStage,
      toStage: 0,
    },
  });

  res.json({ ok: true });
});

app.post("/api/word/:id/correct", auth, async (req, res) => {
  const wordId = Number(req.params.id);
  const existing = await dbGet(
    "SELECT * FROM user_word_stats WHERE user_id = ? AND word_id = ?",
    [req.user.id, wordId],
  );
  if (!existing) {
    const createdAt = nowIso();
    await dbRun(
      `INSERT INTO user_word_stats
       (user_id, word_id, wrongbook, stage, next_review_at, last_review_at, review_count, mastered_stage, created_at)
       VALUES (?, ?, 1, 0, ?, ?, 0, NULL, ?)`,
      [req.user.id, wordId, computeNextReview(0), createdAt, createdAt],
    );
    await createWordMemoryEvent({
      userId: req.user.id,
      wordId,
      eventType: "review",
      fromStage: 0,
      toStage: 0,
      result: "correct",
      source: "study",
    });
  } else if (!existing.mastered_at) {
    const stage = normalizeStageIndex(existing.stage);
    const nextReview = existing.next_review_at || computeNextReview(stage);
    await dbRun(
      `UPDATE user_word_stats
       SET wrongbook = 1, stage = ?, next_review_at = ?, last_review_at = ?, mastered_stage = NULL
       WHERE id = ?`,
      [stage, nextReview, nowIso(), existing.id],
    );
    await createWordMemoryEvent({
      userId: req.user.id,
      wordId,
      eventType: "review",
      fromStage: stage,
      toStage: stage,
      result: "correct",
      source: "study",
    });
  }
  res.json({ ok: true });
});

app.post("/api/word/:id/wrong", auth, async (req, res) => {
  const wordId = Number(req.params.id);
  const existing = await dbGet(
    "SELECT * FROM user_word_stats WHERE user_id = ? AND word_id = ?",
    [req.user.id, wordId],
  );
  if (!existing) {
    const createdAt = nowIso();
    await dbRun(
      `INSERT INTO user_word_stats
       (user_id, word_id, wrongbook, stage, next_review_at, last_review_at, review_count, mastered_stage, created_at)
       VALUES (?, ?, 1, 0, ?, ?, 0, NULL, ?)`,
      [req.user.id, wordId, computeNextReview(0), createdAt, createdAt],
    );
    await createWordMemoryEvent({
      userId: req.user.id,
      wordId,
      eventType: "wrong",
      fromStage: 0,
      toStage: 0,
      result: "wrong",
      source: "study",
    });
  } else if (!existing.mastered_at) {
    const stage = normalizeStageIndex(existing.stage);
    const nextReview = existing.next_review_at || computeNextReview(stage);
    await dbRun(
      `UPDATE user_word_stats
       SET wrongbook = 1, stage = ?, next_review_at = ?, last_review_at = ?, mastered_stage = NULL
       WHERE id = ?`,
      [stage, nextReview, nowIso(), existing.id],
    );
    await createWordMemoryEvent({
      userId: req.user.id,
      wordId,
      eventType: "wrong",
      fromStage: stage,
      toStage: stage,
      result: "wrong",
      source: "study",
    });
  }
  res.json({ ok: true });
});

app.post("/api/word/:id/review", auth, async (req, res) => {
  const wordId = Number(req.params.id);
  const { result } = req.body || {};
  const isCorrect = result !== 'wrong';

  const existing = await dbGet(
    "SELECT * FROM user_word_stats WHERE user_id = ? AND word_id = ?",
    [req.user.id, wordId],
  );

  if (!existing) {
    // First time reviewing this word
    const stage = isCorrect ? 1 : 0;
    const createdAt = nowIso();
    await dbRun(
      `INSERT INTO user_word_stats
       (user_id, word_id, wrongbook, stage, next_review_at, last_review_at, review_count, mastered_stage, created_at)
       VALUES (?, ?, 1, ?, ?, ?, 1, NULL, ?)`,
      [req.user.id, wordId, stage, computeNextReview(stage), createdAt, createdAt],
    );
    await createWordMemoryEvent({
      userId: req.user.id,
      wordId,
      eventType: "review",
      fromStage: 0,
      toStage: stage,
      result: isCorrect ? "correct" : "wrong",
      source: "review",
      metadata: { firstReview: true },
    });
    return res.json({ ok: true, mastered: false });
  }

  if (existing.mastered_at) return res.json({ ok: true, mastered: true });

  const currentStage = normalizeStageIndex(existing.stage);

  if (isCorrect) {
    // Correct: advance to next stage
    const nextStage = Math.min(currentStage + 1, REVIEW_STAGES.length - 1);
    const isFinal = nextStage >= REVIEW_STAGES.length - 1;
    const nextReviewAt = isFinal ? null : computeNextReview(nextStage);
    const masteredAt = isFinal ? nowIso() : null;

    await dbRun(
      `UPDATE user_word_stats
       SET stage = ?, next_review_at = ?, last_review_at = ?, review_count = review_count + 1,
           mastered_at = ?, mastered_stage = ?, wrongbook = ?
       WHERE id = ?`,
      [
        nextStage,
        nextReviewAt,
        nowIso(),
        masteredAt,
        isFinal ? nextStage : null,
        isFinal ? 0 : 1,
        existing.id,
      ],
    );
    await createWordMemoryEvent({
      userId: req.user.id,
      wordId,
      eventType: "review",
      fromStage: currentStage,
      toStage: nextStage,
      result: isFinal ? "mastered" : "correct",
      source: "review",
    });
    res.json({ ok: true, mastered: isFinal });
  } else {
    // Wrong: reset stage back to 0 (restart Ebbinghaus curve)
    await dbRun(
      `UPDATE user_word_stats
       SET stage = 0, next_review_at = ?, last_review_at = ?, review_count = review_count + 1,
           wrongbook = 1, mastered_stage = NULL
       WHERE id = ?`,
      [computeNextReview(0), nowIso(), existing.id],
    );
    await createWordMemoryEvent({
      userId: req.user.id,
      wordId,
      eventType: "review",
      fromStage: currentStage,
      toStage: 0,
      result: "wrong",
      source: "review",
    });
    res.json({ ok: true, mastered: false });
  }
});

// ===== 学员报错：上报单词原始拼写/释义有误 =====
const ERROR_REPORT_REASON_MAX = 500;
const ERROR_REPORT_USER_INPUT_MAX = 200;
const ERROR_REPORT_STATUS_SET = new Set(["pending", "resolved", "dismissed"]);
const normalizeErrorReportStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return ERROR_REPORT_STATUS_SET.has(normalized) ? normalized : "pending";
};

app.post("/api/word/:id/error-report", auth, async (req, res) => {
  const wordId = Number(req.params.id);
  if (!Number.isInteger(wordId) || wordId <= 0) {
    return res.status(400).json({ error: "无效单词ID" });
  }

  const word = await dbGet(
    `SELECT w.id, w.word, w.lesson_id, w.part_of_speech, w.meaning,
            l.textbook_id
     FROM words w
     LEFT JOIN lessons l ON l.id = w.lesson_id
     WHERE w.id = ?`,
    [wordId],
  );
  if (!word) {
    return res.status(404).json({ error: "单词不存在" });
  }

  const userInput = String(req.body?.userInput ?? req.body?.user_input ?? "")
    .trim()
    .slice(0, ERROR_REPORT_USER_INPUT_MAX);
  const reasonRaw = String(req.body?.reason ?? "")
    .trim()
    .slice(0, ERROR_REPORT_REASON_MAX);
  // reason 改为可选：未填写时自动生成默认说明，方便学员一键上报
  const reason = reasonRaw || `学员标记单词有误（输入：${userInput || "（空）"}）`;
  const expectedAnswer = String(req.body?.expectedAnswer ?? req.body?.expected_answer ?? (word.word || ""))
    .trim()
    .slice(0, 200);
  const isCorrect = toSqlBool(req.body?.isCorrect, 0);

  // 防止同一学员对同一单词在短时间内重复刷屏：若已有 pending 记录，更新之
  const existing = await dbGet(
    "SELECT id FROM word_error_reports WHERE user_id = ? AND word_id = ? AND status = ? ORDER BY id DESC LIMIT 1",
    [req.user.id, wordId, "pending"],
  );

  const createdAt = nowIso();
  if (existing) {
    await dbRun(
      `UPDATE word_error_reports
       SET user_input = ?, expected_answer = ?, reason = ?, is_correct = ?, created_at = ?
       WHERE id = ?`,
      [userInput, expectedAnswer, reason, isCorrect, createdAt, existing.id],
    );
    await createActivityLog({
      req,
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: "word_error_report_update",
      targetType: "word",
      targetId: word.id,
      targetName: word.word,
      metadata: { reason: reason.slice(0, 200), reportId: existing.id },
    });
    return res.json({ ok: true, reportId: existing.id, updated: true });
  }

  const { lastID } = await dbRun(
    `INSERT INTO word_error_reports
      (user_id, word_id, lesson_id, textbook_id, word_text, user_input, expected_answer, reason, status, is_correct, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [
      req.user.id,
      wordId,
      word.lesson_id || null,
      word.textbook_id || null,
      String(word.word || ""),
      userInput,
      expectedAnswer,
      reason,
      isCorrect,
      createdAt,
    ],
  );

  await createActivityLog({
    req,
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: "word_error_report",
    targetType: "word",
    targetId: word.id,
    targetName: word.word,
    metadata: { reason: reason.slice(0, 200), reportId: lastID },
  });

  res.json({ ok: true, reportId: lastID });
});


// Admin APIs
app.get("/api/admin/users", auth, adminOnly, async (req, res) => {
  const rows = await dbAll(
    "SELECT id, username, name, role, active, created_at FROM users ORDER BY id",
  );
  res.json({ users: rows });
});

app.post("/api/admin/users", auth, adminOnly, async (req, res) => {
  const { username, password, name, role } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: "缺少用户名或密码" });
  const existing = await dbGet("SELECT id FROM users WHERE username = ?", [username]);
  if (existing) return res.status(400).json({ error: "用户名已存在" });
  const hash = await bcrypt.hash(password, 10);
  const { lastID } = await dbRun(
    "INSERT INTO users (username, password_hash, name, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
    [username, hash, name || username, role || "student", nowIso()],
  );
  res.json({ ok: true, id: lastID });
});

app.put("/api/admin/users/:id", auth, adminOnly, async (req, res) => {
  const { password, name, role, active } = req.body || {};
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await dbRun("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.params.id]);
  }
  if (name !== undefined) {
    await dbRun("UPDATE users SET name = ? WHERE id = ?", [name, req.params.id]);
  }
  if (role !== undefined) {
    await dbRun("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);
  }
  if (active !== undefined) {
    await dbRun("UPDATE users SET active = ? WHERE id = ?", [active ? 1 : 0, req.params.id]);
  }
  res.json({ ok: true });
});

app.delete("/api/admin/users/:id", auth, adminOnly, async (req, res) => {
  await dbRun("DELETE FROM user_textbook_access WHERE user_id = ?", [req.params.id]);
  await dbRun("DELETE FROM user_word_stats WHERE user_id = ?", [req.params.id]);
  await dbRun("DELETE FROM sessions WHERE user_id = ?", [req.params.id]);
  await dbRun("DELETE FROM users WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// User textbook permissions
app.get("/api/admin/users/:id/permissions", auth, adminOnly, async (req, res) => {
  const rows = await dbAll(
    "SELECT textbook_id FROM user_textbook_access WHERE user_id = ?",
    [req.params.id]
  );
  res.json({ textbook_ids: rows.map(r => r.textbook_id) });
});

app.put("/api/admin/users/:id/permissions", auth, adminOnly, async (req, res) => {
  const { textbook_ids } = req.body || {};
  if (!Array.isArray(textbook_ids)) return res.status(400).json({ error: "无效的权限数据" });

  await dbRun("DELETE FROM user_textbook_access WHERE user_id = ?", [req.params.id]);
  for (const tbId of textbook_ids) {
    await dbRun(
      "INSERT INTO user_textbook_access (user_id, textbook_id) VALUES (?, ?)",
      [req.params.id, tbId]
    );
  }
  res.json({ ok: true });
});

// Learning progress
app.get("/api/admin/progress", auth, adminOnly, async (req, res) => {
  const students = await dbAll(
    "SELECT id, username, name, active, created_at FROM users WHERE role != 'admin' ORDER BY id"
  );

  const progress = await Promise.all(students.map(async (s) => {
    const stats = await dbGet(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN mastered_at IS NOT NULL THEN 1 ELSE 0 END) as mastered,
        SUM(CASE WHEN wrongbook = 1 AND mastered_at IS NULL THEN 1 ELSE 0 END) as learning,
        MAX(last_review_at) as last_active
       FROM user_word_stats WHERE user_id = ?`,
      [s.id]
    );
    return {
      ...s,
      total: stats?.total || 0,
      mastered: stats?.mastered || 0,
      learning: stats?.learning || 0,
      lastActive: stats?.last_active || null,
    };
  }));

  res.json({ progress });
});

app.get("/api/admin/words/search", auth, adminOnly, async (req, res) => {
  const keyword = String(req.query?.keyword || "").trim();
  const limit = Math.min(200, Math.max(10, Number(req.query?.limit || 100)));
  const textbookId = Number(req.query?.textbook_id || req.query?.textbookId || 0);
  if (!keyword) {
    return res.json({ words: [], keyword: "", limit });
  }

  const like = `%${keyword}%`;
  const whereClauses = ["(w.word LIKE ? OR w.meaning LIKE ?)"];
  const params = [like, like];
  if (Number.isInteger(textbookId) && textbookId > 0) {
    whereClauses.push("l.textbook_id = ?");
    params.push(textbookId);
  }
  const rows = await dbAll(
    `SELECT
        w.id,
        w.word,
        w.meaning,
        w.phonetic,
        w.part_of_speech,
        w.tts_engine,
        w.entries,
        w.lesson_id,
        l.name AS lesson_name,
        l.sort_order AS lesson_sort_order,
        l.textbook_id,
        t.name AS textbook_name,
        t.sort_order AS textbook_sort_order
     FROM words w
     JOIN lessons l ON l.id = w.lesson_id
     JOIN textbooks t ON t.id = l.textbook_id
     WHERE ${whereClauses.join(" AND ")}
     ORDER BY
       t.is_base DESC,
       t.sort_order,
       t.id,
       l.sort_order,
       l.id,
       w.sort_order,
       w.id
     LIMIT ?`,
    [...params, limit],
  );

  res.json({ words: rows, keyword, limit, textbook_id: textbookId || null });
});

app.get("/api/admin/activity-logs", auth, adminOnly, async (req, res) => {
  const page = Math.max(1, Number(req.query?.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(req.query?.pageSize || 50)));
  const offset = (page - 1) * pageSize;
  const action = String(req.query?.action || "").trim().toLowerCase();
  const keyword = String(req.query?.keyword || "").trim();
  const userId = Number(req.query?.userId || 0);

  const where = [];
  const params = [];
  if (action) {
    where.push("action = ?");
    params.push(action);
  }
  if (Number.isInteger(userId) && userId > 0) {
    where.push("user_id = ?");
    params.push(userId);
  }
  if (keyword) {
    const like = `%${keyword}%`;
    where.push("(username LIKE ? OR action LIKE ? OR target_name LIKE ? OR metadata LIKE ?)");
    params.push(like, like, like, like);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const countRow = await dbGet(
    `SELECT COUNT(*) AS count FROM activity_logs ${whereSql}`,
    params,
  );
  const rows = await dbAll(
    `SELECT id, user_id, username, role, action, target_type, target_id, target_name, metadata, ip, user_agent, created_at
     FROM activity_logs
     ${whereSql}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  const logs = rows.map((row) => {
    let parsedMetadata = row.metadata || "";
    if (parsedMetadata) {
      try {
        parsedMetadata = JSON.parse(parsedMetadata);
      } catch {
        // keep raw string when parse fails
      }
    }
    return {
      ...row,
      metadata: parsedMetadata,
    };
  });

  res.json({
    logs,
    page,
    pageSize,
    total: Number(countRow?.count || 0),
  });
});

// ===== 管理员：单词报错列表与处理 =====
app.get("/api/admin/error-reports", auth, adminOnly, async (req, res) => {
  const page = Math.max(1, Number(req.query?.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(req.query?.pageSize || 50)));
  const offset = (page - 1) * pageSize;
  const status = normalizeErrorReportStatus(req.query?.status);
  const keyword = String(req.query?.keyword || "").trim();
  const wordId = Number(req.query?.wordId || req.query?.word_id || 0);
  const userId = Number(req.query?.userId || req.query?.user_id || 0);

  const where = [];
  const params = [];
  if (status) {
    where.push("r.status = ?");
    params.push(status);
  } else {
    // default: pending first then by created_at
  }
  if (Number.isInteger(wordId) && wordId > 0) {
    where.push("r.word_id = ?");
    params.push(wordId);
  }
  if (Number.isInteger(userId) && userId > 0) {
    where.push("r.user_id = ?");
    params.push(userId);
  }
  if (keyword) {
    const like = `%${keyword}%`;
    where.push("(r.word_text LIKE ? OR r.user_input LIKE ? OR r.reason LIKE ? OR r.expected_answer LIKE ? OR u.username LIKE ? OR u.name LIKE ?)");
    params.push(like, like, like, like, like, like);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const countRow = await dbGet(
    `SELECT COUNT(*) AS count FROM word_error_reports r
     LEFT JOIN users u ON u.id = r.user_id
     ${whereSql}`,
    params,
  );

  const rows = await dbAll(
    `SELECT
        r.id, r.user_id, r.word_id, r.lesson_id, r.textbook_id,
        r.word_text, r.user_input, r.expected_answer, r.reason,
        r.status, r.admin_note, r.is_correct, r.created_at, r.resolved_at,
        u.username AS user_username, u.name AS user_name,
        w.word AS current_word, w.meaning AS current_meaning,
        w.part_of_speech AS current_part_of_speech, w.phonetic AS current_phonetic,
        w.tts_engine AS current_tts_engine, w.entries AS current_entries,
        l.name AS lesson_name,
        t.name AS textbook_name
     FROM word_error_reports r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN words w ON w.id = r.word_id
     LEFT JOIN lessons l ON l.id = r.lesson_id
     LEFT JOIN textbooks t ON t.id = r.textbook_id
     ${whereSql}
     ORDER BY
       CASE r.status WHEN 'pending' THEN 0 WHEN 'resolved' THEN 1 ELSE 2 END,
       r.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  const reports = rows.map((row) => {
    let parsedEntries = [];
    try {
      const raw = typeof row.current_entries === "string" ? JSON.parse(row.current_entries) : row.current_entries;
      if (Array.isArray(raw)) {
        parsedEntries = raw.map((e) => ({
          partOfSpeech: String(e?.partOfSpeech || e?.part_of_speech || ""),
          meaning: String(e?.meaning || ""),
        }));
      }
    } catch {
      parsedEntries = [];
    }
    return {
      id: row.id,
      user_id: row.user_id,
      user_username: row.user_username || "",
      user_name: row.user_name || "",
      word_id: row.word_id,
      lesson_id: row.lesson_id,
      textbook_id: row.textbook_id,
      word_text: row.word_text || "",
      user_input: row.user_input || "",
      expected_answer: row.expected_answer || "",
      reason: row.reason || "",
      status: row.status || "pending",
      admin_note: row.admin_note || "",
      is_correct: Number(row.is_correct || 0) === 1,
      created_at: row.created_at,
      resolved_at: row.resolved_at,
      current_word: row.current_word || "",
      current_meaning: row.current_meaning || "",
      current_part_of_speech: row.current_part_of_speech || "",
      current_phonetic: row.current_phonetic || "",
      current_tts_engine: row.current_tts_engine || "",
      current_entries: parsedEntries,
      lesson_name: row.lesson_name || "",
      textbook_name: row.textbook_name || "",
    };
  });

  res.json({
    reports,
    page,
    pageSize,
    total: Number(countRow?.count || 0),
  });
});

app.put("/api/admin/error-reports/:id", auth, adminOnly, async (req, res) => {
  const reportId = Number(req.params.id);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return res.status(400).json({ error: "无效报错ID" });
  }

  const existing = await dbGet("SELECT id, status FROM word_error_reports WHERE id = ?", [reportId]);
  if (!existing) {
    return res.status(404).json({ error: "报错记录不存在" });
  }

  const incomingStatus = req.body?.status !== undefined
    ? normalizeErrorReportStatus(req.body.status)
    : null;
  const adminNote = req.body?.admin_note !== undefined
    ? String(req.body.admin_note).trim().slice(0, 500)
    : null;

  const updates = [];
  const params = [];
  if (incomingStatus && incomingStatus !== existing.status) {
    updates.push("status = ?");
    params.push(incomingStatus);
    if (incomingStatus !== "pending") {
      updates.push("resolved_at = ?");
      params.push(nowIso());
    } else {
      updates.push("resolved_at = NULL");
    }
  }
  if (adminNote !== null) {
    updates.push("admin_note = ?");
    params.push(adminNote);
  }

  if (updates.length === 0) {
    return res.json({ ok: true, updated: false });
  }

  params.push(reportId);
  await dbRun(`UPDATE word_error_reports SET ${updates.join(", ")} WHERE id = ?`, params);

  await createActivityLog({
    req,
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: "update_word_error_report",
    targetType: "word_error_report",
    targetId: reportId,
    metadata: {
      status: incomingStatus || existing.status,
      adminNote: adminNote !== null ? adminNote.slice(0, 200) : undefined,
    },
  });

  res.json({ ok: true, updated: true });
});

app.delete("/api/admin/error-reports/:id", auth, adminOnly, async (req, res) => {
  const reportId = Number(req.params.id);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return res.status(400).json({ error: "无效报错ID" });
  }

  const existing = await dbGet("SELECT id, word_id, word_text FROM word_error_reports WHERE id = ?", [reportId]);
  if (!existing) {
    return res.status(404).json({ error: "报错记录不存在" });
  }

  await dbRun("DELETE FROM word_error_reports WHERE id = ?", [reportId]);

  await createActivityLog({
    req,
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    action: "delete_word_error_report",
    targetType: "word_error_report",
    targetId: reportId,
    targetName: existing.word_text || "",
    metadata: { wordId: existing.word_id },
  });

  res.json({ ok: true });
});

// 报错统计：返回各状态计数（用于管理后台 Tab 红色徽标）
app.get("/api/admin/error-reports/stats", auth, adminOnly, async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT status, COUNT(*) AS count FROM word_error_reports GROUP BY status`
    );
    const stats = { pending: 0, resolved: 0, dismissed: 0 };
    for (const row of rows) {
      if (row.status === 'pending') stats.pending = row.count;
      else if (row.status === 'resolved') stats.resolved = row.count;
      else if (row.status === 'dismissed') stats.dismissed = row.count;
    }
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: "加载报错统计失败" });
  }
});

app.get("/api/tts/proxy", auth, async (req, res) => {
  const engine = String(req.query?.engine || "").trim().toLowerCase();
  const text = sanitizeTtsText(req.query?.text);

  if (!REMOTE_TTS_ENGINES.has(engine)) {
    return res.status(400).json({ error: "不支持的朗读引擎" });
  }
  if (!text) {
    return res.status(400).json({ error: "缺少朗读文本" });
  }
  if (text.length > 120) {
    return res.status(400).json({ error: "朗读文本过长（最多120字符）" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const upstreamUrl = buildRemoteTtsUrl(engine, text);

  try {
    const upstream = await fetch(upstreamUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (WordMaster TTS Proxy)",
        Accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.1",
        Referer: getRemoteTtsReferer(engine),
      },
    });

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => "");
      return res.status(502).json({
        error: `上游朗读服务失败: ${upstream.status}`,
        detail: body.slice(0, 180),
      });
    }

    const mimeType = upstream.headers.get("content-type") || "";
    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length <= 0) {
      return res.status(502).json({ error: "上游朗读服务返回空内容" });
    }

    if (/text\/html|application\/json|text\/plain/i.test(mimeType)) {
      const snippet = buffer.toString("utf8", 0, 180);
      return res.status(502).json({
        error: "上游朗读服务返回了非音频内容",
        detail: snippet,
      });
    }

    res.setHeader("Content-Type", mimeType || "audio/mpeg");
    res.setHeader("Content-Length", String(buffer.length));
    res.status(200).send(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(502).json({ error: "朗读代理请求失败", detail: message });
  } finally {
    clearTimeout(timeout);
  }
});

app.get("/api/admin/textbooks", auth, adminOnly, async (req, res) => {
  const rows = await dbAll("SELECT * FROM textbooks ORDER BY is_base DESC, sort_order, id");
  res.json({ textbooks: rows });
});

app.post("/api/admin/textbooks/restore-base", auth, adminOnly, async (_req, res) => {
  const result = await restoreBaseTextbooks();
  res.json({ ok: true, ...result });
});

const adminFetchImageHandler = async (req, res) => {
  const rawUrl = String(req.body?.url || "").trim();
  if (!/^https?:\/\//i.test(rawUrl)) {
    return res.status(400).json({ error: "无效图片URL" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const upstream = await fetch(rawUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (OCRImportProxy)",
        Accept: "image/*,*/*;q=0.8",
      },
    });

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => "");
      return res.status(502).json({
        error: `上游图片下载失败: ${upstream.status}`,
        detail: body.slice(0, 200),
      });
    }

    const mimeType = upstream.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const maxBytes = 12 * 1024 * 1024;
    if (buffer.length > maxBytes) {
      return res.status(413).json({ error: "图片过大，请压缩后重试（最大12MB）" });
    }

    let fileName = "image";
    try {
      const pathname = new URL(rawUrl).pathname;
      fileName = pathname.split("/").filter(Boolean).pop() || fileName;
    } catch {
      // ignore invalid url parsing details
    }

    res.json({
      ok: true,
      fileName,
      mimeType,
      dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(502).json({ error: "图片下载失败", detail: message });
  } finally {
    clearTimeout(timeout);
  }
};

const cleanProxyBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");

const adminNvidiaChatCompletionsHandler = async (req, res) => {
  const apiKey = String(req.body?.apiKey || "").trim();
  const apiBaseUrl = cleanProxyBaseUrl(req.body?.apiBaseUrl || "");
  const model = String(req.body?.model || "").trim();
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : null;
  const rawMaxTokens = Number(req.body?.max_tokens ?? req.body?.maxTokens);
  const maxTokens =
    Number.isFinite(rawMaxTokens) && rawMaxTokens > 0 ? Math.floor(rawMaxTokens) : null;

  if (!apiKey) {
    return res.status(400).json({ error: "缺少 NVIDIA API Key" });
  }
  if (!apiBaseUrl || !/^https?:\/\//i.test(apiBaseUrl)) {
    return res.status(400).json({ error: "缺少有效的 NVIDIA API Base URL" });
  }
  if (!model) {
    return res.status(400).json({ error: "缺少 Model ID" });
  }
  if (!messages) {
    return res.status(400).json({ error: "缺少 messages" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);

  try {
    const upstream = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
      }),
    });

    const responseText = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
    res.status(upstream.status);
    res.setHeader("Content-Type", contentType);
    return res.send(responseText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(502).json({
      error: "NVIDIA 上游请求失败",
      detail: message,
    });
  } finally {
    clearTimeout(timeout);
  }
};

app.post("/api/admin/utils/fetch-image", auth, adminOnly, adminFetchImageHandler);
app.post("/api/admin/fetch-image", auth, adminOnly, adminFetchImageHandler);
app.post("/api/utils/fetch-image", auth, adminOnly, adminFetchImageHandler);
app.post(
  "/api/admin/utils/nvidia-chat-completions",
  auth,
  adminOnly,
  adminNvidiaChatCompletionsHandler,
);
app.post(
  "/api/admin/nvidia-chat-completions",
  auth,
  adminOnly,
  adminNvidiaChatCompletionsHandler,
);

app.post("/api/admin/textbooks", auth, adminOnly, async (req, res) => {
  const { name, sort_order, is_base } = req.body || {};
  if (!name) return res.status(400).json({ error: "缺少教材名称" });
  const normalizedIsBase = toSqlBool(is_base, 0);
  const result = await dbRun("INSERT INTO textbooks (name, sort_order, is_base) VALUES (?, ?, ?)", [
    name,
    sort_order || 0,
    normalizedIsBase,
  ]);
  const textbook = await dbGet("SELECT * FROM textbooks WHERE id = ?", [result.lastID]);
  res.json({ ok: true, textbook });
});

app.put("/api/admin/textbooks/:id", auth, adminOnly, async (req, res) => {
  const { name, sort_order, is_base } = req.body || {};
  const normalizedIsBase = is_base === undefined ? null : toSqlBool(is_base, 0);
  await dbRun(
    "UPDATE textbooks SET name = COALESCE(?, name), sort_order = COALESCE(?, sort_order), is_base = COALESCE(?, is_base) WHERE id = ?",
    [name, sort_order, normalizedIsBase, req.params.id],
  );
  res.json({ ok: true });
});

app.delete("/api/admin/textbooks/:id", auth, adminOnly, async (req, res) => {
  const textbook = await dbGet("SELECT id, name, is_base FROM textbooks WHERE id = ?", [req.params.id]);
  if (!textbook) {
    return res.status(404).json({ error: "课本不存在" });
  }
  if (Number(textbook.is_base || 0) === 1) {
    return res.status(400).json({ error: "基础课本不允许删除。可先取消“基础课程”标记后再删除。" });
  }

  await dbRun(
    "DELETE FROM user_word_stats WHERE word_id IN (SELECT id FROM words WHERE lesson_id IN (SELECT id FROM lessons WHERE textbook_id = ?))",
    [req.params.id],
  );
  await dbRun(
    "DELETE FROM words WHERE lesson_id IN (SELECT id FROM lessons WHERE textbook_id = ?)",
    [req.params.id],
  );
  await dbRun("DELETE FROM textbooks WHERE id = ?", [req.params.id]);
  await dbRun("DELETE FROM lessons WHERE textbook_id = ?", [req.params.id]);
  res.json({ ok: true });
});

app.get(
  "/api/admin/textbooks/:id/lessons",
  auth,
  adminOnly,
  async (req, res) => {
    const rows = await dbAll(
      `SELECT l.*,
              (SELECT COUNT(*) FROM words w WHERE w.lesson_id = l.id) AS word_count
       FROM lessons l
       WHERE l.textbook_id = ?
       ORDER BY l.sort_order, l.id`,
      [req.params.id],
    );
    res.json({ lessons: rows });
  },
);

app.post(
  "/api/admin/textbooks/:id/lessons",
  auth,
  adminOnly,
  async (req, res) => {
    const { name, sort_order } = req.body || {};
    if (!name) return res.status(400).json({ error: "缺少课程名称" });
    const result = await dbRun(
      "INSERT INTO lessons (textbook_id, name, sort_order) VALUES (?, ?, ?)",
      [req.params.id, name, sort_order || 0],
    );
    const lesson = await dbGet("SELECT * FROM lessons WHERE id = ?", [result.lastID]);
    res.json({ ok: true, lesson });
  },
);

const adminReassignWordsByWordRangeHandler = async (req, res) => {
  const textbookId = Number(req.params.id);
  if (!Number.isInteger(textbookId) || textbookId <= 0) {
    return res.status(400).json({ error: "无效教材ID" });
  }

  const sourceLessonId = Number(req.body?.sourceLessonId || req.body?.source_lesson_id || 0);
  const sourceUnitName = String(req.body?.sourceUnitName || req.body?.source_unit_name || "").trim();
  const startWord = String(req.body?.startWord || req.body?.start_word || "").trim();
  const endWordRaw = String(req.body?.endWord || req.body?.end_word || "").trim();
  const targetUnitName = String(req.body?.toUnitName || req.body?.to_unit_name || "").trim();
  const createTargetIfMissing = Boolean(req.body?.createTargetIfMissing ?? req.body?.create_target_if_missing);
  const preview = Boolean(req.body?.preview);

  if (!startWord) {
    return res.status(400).json({ error: "缺少开始单词" });
  }
  if (!targetUnitName) {
    return res.status(400).json({ error: "缺少目标Unit名称" });
  }

  const textbook = await dbGet("SELECT id, name FROM textbooks WHERE id = ?", [textbookId]);
  if (!textbook) {
    return res.status(404).json({ error: "教材不存在" });
  }

  let sourceLesson = null;
  if (Number.isInteger(sourceLessonId) && sourceLessonId > 0) {
    sourceLesson = await dbGet(
      "SELECT id, textbook_id, name, sort_order FROM lessons WHERE id = ? AND textbook_id = ?",
      [sourceLessonId, textbookId],
    );
  }
  if (!sourceLesson && sourceUnitName) {
    sourceLesson = await dbGet(
      "SELECT id, textbook_id, name, sort_order FROM lessons WHERE textbook_id = ? AND lower(trim(name)) = lower(trim(?)) ORDER BY id LIMIT 1",
      [textbookId, sourceUnitName],
    );
  }
  if (!sourceLesson) {
    return res.status(404).json({ error: "来源Unit不存在" });
  }

  const sourceWords = await dbAll(
    "SELECT id, word, sort_order FROM words WHERE lesson_id = ? ORDER BY sort_order, id",
    [sourceLesson.id],
  );
  if (sourceWords.length === 0) {
    return res.json({
      ok: true,
      preview,
      matched_count: 0,
      moved_count: 0,
      source_lesson: sourceLesson,
      target_lesson: null,
      target_unit_name: targetUnitName,
      matched_words: [],
    });
  }

  const normalizedStart = normalizeWordForRangeMatch(startWord);
  const normalizedEnd = normalizeWordForRangeMatch(endWordRaw || startWord);

  const startIndex = sourceWords.findIndex(
    (row) => normalizeWordForRangeMatch(row.word) === normalizedStart,
  );
  if (startIndex < 0) {
    return res.status(404).json({ error: `未找到开始单词：${startWord}` });
  }

  let endIndex = -1;
  for (let i = startIndex; i < sourceWords.length; i += 1) {
    if (normalizeWordForRangeMatch(sourceWords[i].word) === normalizedEnd) {
      endIndex = i;
      break;
    }
  }
  if (endIndex < 0) {
    if (normalizedEnd !== normalizedStart) {
      return res.status(404).json({ error: `未找到结束单词：${endWordRaw || startWord}` });
    }
    endIndex = startIndex;
  }

  const matchedWords = sourceWords.slice(startIndex, endIndex + 1);
  const matchedCount = matchedWords.length;

  let targetLesson = await dbGet(
    "SELECT id, textbook_id, name, sort_order FROM lessons WHERE textbook_id = ? AND lower(trim(name)) = lower(trim(?)) ORDER BY id LIMIT 1",
    [textbookId, targetUnitName],
  );

  if (!targetLesson && createTargetIfMissing) {
    const maxSort = await dbGet(
      "SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM lessons WHERE textbook_id = ?",
      [textbookId],
    );
    const inferredOrder = extractUnitSortOrder(targetUnitName);
    const nextSortOrder = Number.isFinite(inferredOrder) && inferredOrder > 0
      ? inferredOrder
      : Number(maxSort?.max_sort || 0) + 1;
    const insert = await dbRun(
      "INSERT INTO lessons (textbook_id, name, sort_order) VALUES (?, ?, ?)",
      [textbookId, targetUnitName, nextSortOrder],
    );
    targetLesson = await dbGet(
      "SELECT id, textbook_id, name, sort_order FROM lessons WHERE id = ?",
      [insert.lastID],
    );
  }

  if (!targetLesson) {
    return res.status(404).json({ error: "目标Unit不存在，请先创建或勾选自动创建" });
  }

  if (preview) {
    return res.json({
      ok: true,
      preview: true,
      matched_count: matchedCount,
      moved_count: 0,
      source_lesson: sourceLesson,
      target_lesson: targetLesson,
      target_unit_name: targetUnitName,
      matched_words: matchedWords.map((row) => ({ id: row.id, word: row.word })),
    });
  }

  let movedCount = 0;
  if (Number(sourceLesson.id) !== Number(targetLesson.id)) {
    const maxSortWord = await dbGet(
      "SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM words WHERE lesson_id = ?",
      [targetLesson.id],
    );
    let nextSort = Number(maxSortWord?.max_sort ?? -1) + 1;
    for (const row of matchedWords) {
      await dbRun("UPDATE words SET lesson_id = ?, sort_order = ? WHERE id = ?", [
        targetLesson.id,
        nextSort,
        row.id,
      ]);
      movedCount += 1;
      nextSort += 1;
    }
  }

  return res.json({
    ok: true,
    preview: false,
    matched_count: matchedCount,
    moved_count: movedCount,
    source_lesson: sourceLesson,
    target_lesson: targetLesson,
    target_unit_name: targetUnitName,
    matched_words: matchedWords.map((row) => ({ id: row.id, word: row.word })),
  });
};

app.post(
  "/api/admin/textbooks/:id/reassign-words-by-word-range",
  auth,
  adminOnly,
  adminReassignWordsByWordRangeHandler,
);

app.post(
  "/api/admin/textbooks/:id/reassign-words-by-range",
  auth,
  adminOnly,
  adminReassignWordsByWordRangeHandler,
);

app.put("/api/admin/lessons/:id", auth, adminOnly, async (req, res) => {
  const { name, sort_order } = req.body || {};
  await dbRun(
    "UPDATE lessons SET name = COALESCE(?, name), sort_order = COALESCE(?, sort_order) WHERE id = ?",
    [name, sort_order, req.params.id],
  );
  res.json({ ok: true });
});

app.delete("/api/admin/lessons/:id", auth, adminOnly, async (req, res) => {
  await dbRun(
    "DELETE FROM user_word_stats WHERE word_id IN (SELECT id FROM words WHERE lesson_id = ?)",
    [req.params.id],
  );
  await dbRun("DELETE FROM lessons WHERE id = ?", [req.params.id]);
  await dbRun("DELETE FROM words WHERE lesson_id = ?", [req.params.id]);
  res.json({ ok: true });
});

app.get("/api/admin/lessons/:id/words", auth, adminOnly, async (req, res) => {
  const rows = await dbAll(
    "SELECT * FROM words WHERE lesson_id = ? ORDER BY sort_order, id",
    [req.params.id],
  );
  res.json({ words: rows });
});

app.post("/api/admin/lessons/:id/words", auth, adminOnly, async (req, res) => {
  const { word, meaning, phonetic, part_of_speech, partOfSpeech, tts_engine, ttsEngine, sort_order } = req.body || {};
  if (!word || !meaning)
    return res.status(400).json({ error: "缺少单词或释义" });
  const normalized = normalizeMeaningAndPos(
    String(meaning || ""),
    String(part_of_speech ?? partOfSpeech ?? ""),
  );
  const normalizedTtsEngine = normalizeWordTtsEngine(tts_engine ?? ttsEngine);
  const entriesJson = JSON.stringify([{ partOfSpeech: normalized.partOfSpeech, meaning: normalized.meaning }]);
  const result = await dbRun(
    "INSERT INTO words (lesson_id, word, meaning, phonetic, part_of_speech, tts_engine, sort_order, entries) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      req.params.id,
      word,
      normalized.meaning,
      phonetic || "",
      normalized.partOfSpeech,
      normalizedTtsEngine,
      sort_order || 0,
      entriesJson,
    ],
  );
  const savedWord = await dbGet("SELECT * FROM words WHERE id = ?", [result.lastID]);
  res.json({ ok: true, word: savedWord });
});

app.put("/api/admin/words/:id", auth, adminOnly, async (req, res) => {
  const { word, meaning, phonetic, part_of_speech, partOfSpeech, tts_engine, ttsEngine, sort_order, entries } = req.body || {};
  const current = await dbGet("SELECT meaning, part_of_speech FROM words WHERE id = ?", [
    req.params.id,
  ]);
  if (!current) {
    return res.status(404).json({ error: "单词不存在" });
  }

  const incomingPos = part_of_speech !== undefined ? part_of_speech : partOfSpeech;
  const shouldNormalize = incomingPos !== undefined || meaning !== undefined;
  const normalized = shouldNormalize
    ? normalizeMeaningAndPos(
      meaning !== undefined ? String(meaning || "") : String(current.meaning || ""),
      incomingPos !== undefined
        ? String(incomingPos || "")
        : String(current.part_of_speech || ""),
    )
    : null;

  const incomingTtsEngine = tts_engine !== undefined ? tts_engine : ttsEngine;
  const normalizedTtsEngine =
    incomingTtsEngine === undefined
      ? undefined
      : normalizeWordTtsEngine(incomingTtsEngine);

  // Handle entries: if provided directly, use them; otherwise auto-generate
  let entriesJson = undefined;
  if (Array.isArray(entries) && entries.length > 0) {
    // Entries provided directly from the admin form
    entriesJson = JSON.stringify(entries.map(e => ({
      partOfSpeech: String(e.partOfSpeech || e.part_of_speech || ''),
      meaning: String(e.meaning || ''),
    })));
  } else if (normalized) {
    const currentWord = await dbGet("SELECT entries FROM words WHERE id = ?", [req.params.id]);
    let existingEntries = [];
    try { existingEntries = JSON.parse(currentWord?.entries || "[]"); } catch { existingEntries = []; }
    if (!Array.isArray(existingEntries) || existingEntries.length <= 1) {
      // Single-entry word: just update the entries array to match the new meaning/pos
      entriesJson = JSON.stringify([{ partOfSpeech: normalized.partOfSpeech, meaning: normalized.meaning }]);
    } else {
      // Multi-entry word: update the first entry, keep the rest
      existingEntries[0] = { partOfSpeech: normalized.partOfSpeech, meaning: normalized.meaning };
      entriesJson = JSON.stringify(existingEntries);
    }
  }

  await dbRun(
    "UPDATE words SET word = COALESCE(?, word), meaning = COALESCE(?, meaning), phonetic = COALESCE(?, phonetic), part_of_speech = COALESCE(?, part_of_speech), tts_engine = COALESCE(?, tts_engine), sort_order = COALESCE(?, sort_order), entries = COALESCE(?, entries) WHERE id = ?",
    [
      word,
      normalized ? normalized.meaning : undefined,
      phonetic,
      normalized ? normalized.partOfSpeech : undefined,
      normalizedTtsEngine,
      sort_order,
      entriesJson,
      req.params.id,
    ],
  );
  res.json({ ok: true });
});

app.delete("/api/admin/words/:id", auth, adminOnly, async (req, res) => {
  await dbRun("DELETE FROM user_word_stats WHERE word_id = ?", [req.params.id]);
  await dbRun("DELETE FROM words WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "服务器错误", detail: err.message });
});

await initDb();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
