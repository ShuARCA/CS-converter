/**
 * parsers/parser-utils.js — パーサー共通ユーティリティ
 *
 * 全パーサーで共有する防衛的パース用ヘルパー。
 */

import { SKILLS, SKILL_NAME_NORMALIZE_MAP, calcDB, resolveInitial } from '../constants.js';

/**
 * 安全に数値を取得する
 * @param {string|null|undefined} val
 * @param {number} fallback
 * @returns {number}
 */
export function safeInt(val, fallback = 0) {
  if (val == null) return fallback;
  const n = parseInt(String(val).trim(), 10);
  return isNaN(n) ? fallback : n;
}

/**
 * 安全にテキストコンテンツを取得する
 * @param {Document} doc
 * @param {string} selector
 * @param {string} fallback
 * @returns {string}
 */
export function safeText(doc, selector, fallback = '') {
  try {
    const el = doc.querySelector(selector);
    return el ? el.textContent.trim() : fallback;
  } catch {
    return fallback;
  }
}

/**
 * 安全にinputのvalueを取得する
 * @param {Document} doc
 * @param {string} selector
 * @param {string} fallback
 * @returns {string}
 */
export function safeInputValue(doc, selector, fallback = '') {
  try {
    const el = doc.querySelector(selector);
    return el ? (el.value ?? el.getAttribute('value') ?? '').trim() : fallback;
  } catch {
    return fallback;
  }
}

/**
 * 技能名を正規化する
 * @param {string} rawName - サービスから取得した技能名
 * @returns {string} 正規化された技能名
 */
export function normalizeSkillName(rawName) {
  const trimmed = rawName.trim()
    // 全角括弧を半角に統一
    .replace(/（/g, '(').replace(/）/g, ')')
    // 全角英数字を半角に
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
    );

  // 括弧付き技能の基本名を抽出（例: "運転(自動車)" → "運転"）
  const baseName = trimmed.replace(/\(.*\)$/, '').trim();

  // 直接マッチ
  if (SKILL_NAME_NORMALIZE_MAP[trimmed]) return SKILL_NAME_NORMALIZE_MAP[trimmed];
  // 基本名でマッチ
  if (SKILL_NAME_NORMALIZE_MAP[baseName]) return SKILL_NAME_NORMALIZE_MAP[baseName];

  // SKILLS定義から直接検索
  const directMatch = SKILLS.find(s => s.name === trimmed);
  if (directMatch) return directMatch.name;

  // normNamesで検索
  const normMatch = SKILLS.find(s => s.normNames.includes(baseName) || s.normNames.includes(trimmed));
  if (normMatch) return normMatch.name;

  return trimmed;
}

/**
 * SKILLS定義から技能を検索する
 * @param {string} normalizedName
 * @returns {object|null}
 */
export function findSkillDef(normalizedName) {
  return SKILLS.find(s => s.name === normalizedName) || null;
}

/**
 * 空の CharacterData テンプレートを生成
 * @param {string} sourceUrl
 * @param {string} sourceType
 * @returns {object}
 */
export function createEmptyCharacterData(sourceUrl, sourceType) {
  return {
    name: '名無し',
    memo: '',
    stats: {
      STR: 0, CON: 0, POW: 0, DEX: 0, APP: 0, SIZ: 0, INT: 0, EDU: 0,
      currentHP: 0, maxHP: 0, currentMP: 0, maxMP: 0,
      initialSAN: 0, currentSAN: 0,
      idea: 0, luck: 0, know: 0,
      DB: '+0',
    },
    skills: [],
    isPartial: false,
    parseWarnings: [],
    sourceUrl,
    sourceType,
  };
}

/**
 * 能力値から派生ステータスを計算・補完する
 * @param {object} charData - CharacterData（stats が部分的に埋まった状態）
 */
export function computeDerivedStats(charData) {
  const s = charData.stats;

  // 最大HP
  if (!s.maxHP || s.maxHP === 0) {
    s.maxHP = Math.floor((s.CON + s.SIZ) / 2);
  }
  // 現在HP（未設定なら最大HP）
  if (!s.currentHP || s.currentHP === 0) {
    s.currentHP = s.maxHP;
  }
  // 最大MP = POW
  if (!s.maxMP || s.maxMP === 0) {
    s.maxMP = s.POW;
  }
  // 現在MP（未設定なら最大MP）
  if (!s.currentMP || s.currentMP === 0) {
    s.currentMP = s.maxMP;
  }
  // 初期SAN = POW × 5
  if (!s.initialSAN || s.initialSAN === 0) {
    s.initialSAN = s.POW * 5;
  }
  // 現在SAN（未設定なら初期SAN）
  if (!s.currentSAN || s.currentSAN === 0) {
    s.currentSAN = s.initialSAN;
  }
  // アイデア = INT × 5
  s.idea = s.INT * 5;
  // 幸運 = POW × 5
  s.luck = s.POW * 5;
  // 知識 = EDU × 5
  s.know = s.EDU * 5;
  // DB（未取得の場合のみ計算）
  if (!s.DB || s.DB === '+0') {
    s.DB = calcDB(s.STR, s.SIZ);
  }
}

/**
 * 全60技能分の SkillEntry 配列を構築する（既存の取得技能データと照合）
 * @param {Map<string, { value: number, displayName: string }>} parsedSkills - パース済み技能データ
 * @param {object} stats - 能力値
 * @returns {Array<object>} SkillEntry[]
 */
export function buildSkillEntries(parsedSkills, stats) {
  // 1. 標準技能の構築
  const standardSkills = SKILLS.map(skillDef => {
    const initial = resolveInitial(skillDef.initial, stats);
    const parsed = parsedSkills.get(skillDef.name);

    if (parsed) {
      // 処理した技能は Map から削除
      parsedSkills.delete(skillDef.name);
      const value = parsed.value;
      return {
        name: skillDef.name,
        displayName: parsed.displayName || skillDef.name,
        value,
        initial,
        isAcquired: value > initial,
      };
    }

    // 未取得: 初期値を使用
    return {
      name: skillDef.name,
      displayName: skillDef.name,
      value: initial,
      initial,
      isAcquired: false,
    };
  });

  // 2. カスタム技能（標準技能リストにないもの）の追加
  const customSkills = [];
  for (const [key, parsed] of parsedSkills.entries()) {
    // すでに standardSkills に存在する、または標準技能名/別名と重複するものは防衛的に除外
    const isStandard = SKILLS.some(s => s.name === key || (s.normNames && s.normNames.includes(key)));
    if (isStandard) continue;

    // カスタム技能の初期値は通常取得できないため、0 とする
    const initial = 0;
    customSkills.push({
      name: key,
      displayName: parsed.displayName || key,
      value: parsed.value,
      initial,
      isAcquired: parsed.value > initial,
    });
  }

  return [...standardSkills, ...customSkills];
}
