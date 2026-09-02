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
  if (!rawName) return '';
  const trimmed = rawName.trim()
    // 全角括弧を半角に統一
    .replace(/（/g, '(').replace(/）/g, ')')
    // 全角英数字を半角に
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
    );

  // 1. こぶし（パンチ）の完全一致またはエイリアス（括弧を含む標準技能のため最優先）
  if (['こぶし', 'パンチ', 'こぶし(パンチ)'].includes(trimmed)) {
    return 'こぶし（パンチ）';
  }

  // 2. SKILL_NAME_NORMALIZE_MAP への直接完全マッチ
  if (SKILL_NAME_NORMALIZE_MAP[trimmed]) return SKILL_NAME_NORMALIZE_MAP[trimmed];

  // 3. SKILLS定義（標準60技能）への直接完全マッチ
  const directMatch = SKILLS.find(s => s.name.replace(/（/g, '(').replace(/）/g, ')') === trimmed);
  if (directMatch) return directMatch.name;

  // 4. 括弧の中に具体的なサブカテゴリがあるかチェック（例: "芸術(演技)", "運転(自動車)"）
  const subMatch = trimmed.match(/^(.+?)\((.+?)\)$/);
  if (subMatch) {
    const mainPart = subMatch[1].trim();
    const subPart = subMatch[2].trim();

    // メイン部分の正規化（エイリアスがあれば適用）
    let normMain = mainPart;
    if (SKILL_NAME_NORMALIZE_MAP[mainPart]) {
      normMain = SKILL_NAME_NORMALIZE_MAP[mainPart].replace(/\(\)$/, '');
    } else {
      const matchDef = SKILLS.find(s => s.name.replace(/\(\)$/, '') === mainPart || (s.normNames && s.normNames.includes(mainPart)));
      if (matchDef) {
        normMain = matchDef.name.replace(/\(\)$/, '');
      }
    }
    // サブカテゴリを保持したまま返す
    return `${normMain}(${subPart})`;
  }

  // 5. 括弧なし、または空括弧 "運転()" の場合
  const baseName = trimmed.replace(/\(\)$/, '').trim();

  // 基本名でマッチ
  if (SKILL_NAME_NORMALIZE_MAP[baseName]) return SKILL_NAME_NORMALIZE_MAP[baseName];

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
  // DB は各サービスごとに表記ゆれがあるため、常に STR + SIZ から計算して統一する
  s.DB = calcDB(s.STR, s.SIZ);
}

const CATEGORY_ORDER = ['combat', 'search', 'action', 'negotiate', 'knowledge'];

/**
 * 全技能分の SkillEntry 配列を構築する（標準60技能 + 各カテゴリの追加技能）
 * @param {Map<string, { value: number, displayName: string, category?: string }>} parsedSkills - パース済み技能データ
 * @param {object} stats - 能力値
 * @returns {Array<object>} SkillEntry[]
 */
export function buildSkillEntries(parsedSkills, stats) {
  const resultSkills = [];
  const handledKeys = new Set();

  for (const category of CATEGORY_ORDER) {
    const categorySkills = SKILLS.filter(s => s.category === category);

    // 1. このカテゴリに属する標準技能の登録
    for (const skillDef of categorySkills) {
      const initial = resolveInitial(skillDef.initial, stats);

      // 完全一致で検索（例: "目星", "回避"）
      let matched = false;
      if (parsedSkills.has(skillDef.name)) {
        const parsed = parsedSkills.get(skillDef.name);
        handledKeys.add(skillDef.name);
        resultSkills.push({
          name: skillDef.name,
          displayName: parsed.displayName || skillDef.name,
          value: parsed.value,
          initial,
          category: skillDef.category,
          isAcquired: parsed.value > initial,
        });
        matched = true;
      }

      // 括弧付き標準技能（"運転()", "芸術()", "製作()", "操縦()", "母国語()"）の場合：
      // パース結果にある具体的なサブカテゴリ付き技能（例: "芸術(演技)", "芸術(ボウリング)"）をこの位置に追加
      if (skillDef.name.endsWith('()')) {
        const prefix = skillDef.name.slice(0, -2);
        for (const [key, parsed] of parsedSkills.entries()) {
          if (key.startsWith(prefix + '(') && key !== skillDef.name && !handledKeys.has(key)) {
            handledKeys.add(key);
            resultSkills.push({
              name: key,
              displayName: parsed.displayName || key,
              value: parsed.value,
              initial,
              category: skillDef.category,
              isAcquired: parsed.value > initial,
            });
            matched = true;
          }
        }
      }

      // パース結果に該当する技能が1つも無かった場合は、初期値エントリーを追加
      if (!matched) {
        resultSkills.push({
          name: skillDef.name,
          displayName: skillDef.name,
          value: initial,
          initial,
          category: skillDef.category,
          isAcquired: false,
        });
      }
    }

    // 2. このカテゴリに追加されたカスタム技能（自由記入技能）の登録
    for (const [key, parsed] of parsedSkills.entries()) {
      if (handledKeys.has(key)) continue;

      // このカテゴリと一致する場合に追加
      if (parsed.category === category) {
        handledKeys.add(key);
        const initial = 0;
        resultSkills.push({
          name: key,
          displayName: parsed.displayName || key,
          value: parsed.value,
          initial,
          category,
          isAcquired: parsed.value > initial || parsed.value > 0,
        });
      }
    }
  }

  // 3. カテゴリ未指定、または未知のカテゴリのカスタム技能（末尾に追加）
  for (const [key, parsed] of parsedSkills.entries()) {
    if (handledKeys.has(key)) continue;

    const initial = 0;
    const cat = parsed.category || 'other';
    resultSkills.push({
      name: key,
      displayName: parsed.displayName || key,
      value: parsed.value,
      initial,
      category: cat,
      isAcquired: parsed.value > initial || parsed.value > 0,
    });
  }

  return resultSkills;
}


