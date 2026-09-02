/**
 * parsers/hokanjo.js — キャラクター保管所 JSONパーサー
 *
 * API URL: https://charasheet.vampire-blood.net/{id}.js
 * 入力URL: https://charasheet.vampire-blood.net/{id}
 * レスポンスは純粋なJSONオブジェクト。
 */

import { AppError } from '../constants.js';
import {
  safeInt, normalizeSkillName,
  createEmptyCharacterData, computeDerivedStats, buildSkillEntries,
} from './parser-utils.js';

/**
 * 各技能テーブルの定義
 * key:     JSONキー（合計値配列）
 * names:   技能名（インデックス順、固定）
 * subKeys: サブカテゴリ名が入るJSONキー（インデックス → JSONキー名）
 */
const SKILL_TABLE_DEFS = [
  {
    key: 'TBAP',
    nameKey: 'TBAName',
    category: 'combat',
    names: [
      '回避', 'キック', '組み付き', 'こぶし（パンチ）', '頭突き', '投擲',
      'マーシャルアーツ', '拳銃', 'サブマシンガン', 'ショットガン', 'マシンガン', 'ライフル',
    ],
  },
  {
    key: 'TFAP',
    nameKey: 'TFAName',
    category: 'search',
    names: [
      '応急手当', '鍵開け', '隠す', '隠れる', '聞き耳', '忍び歩き',
      '写真術', '精神分析', '追跡', '登攀', '図書館', '目星',
    ],
  },
  {
    key: 'TAAP',
    nameKey: 'TAAName',
    category: 'action',
    names: [
      '運転', '機械修理', '重機械操作', '乗馬', '水泳',
      '製作', '操縦', '跳躍', '電気修理', 'ナビゲート', '変装',
    ],
    subKeys: {
      0: 'unten_bunya',
      5: 'seisaku_bunya',
      6: 'main_souju_norimono',
    },
  },
  {
    key: 'TCAP',
    nameKey: 'TCAName',
    category: 'negotiate',
    names: ['言いくるめ', '信用', '説得', '値切り', '母国語'],
    subKeys: {
      4: 'mylang_name',
    },
  },
  {
    key: 'TKAP',
    nameKey: 'TKAName',
    category: 'knowledge',
    names: [
      '医学', 'オカルト', '化学', 'クトゥルフ神話', '芸術', '経理',
      '考古学', 'コンピューター', '心理学', '人類学', '生物学', '地質学',
      '電子工学', '天文学', '博物学', '物理学', '法律', '薬学', '歴史',
    ],
    subKeys: {
      4: 'geijutu_bunya',
    },
  },
];

/**
 * キャラクター保管所のJSONをパースしてCharacterDataを返す
 * @param {string} jsonText - 取得したJSON文字列
 * @param {string} id - キャラクターID
 * @returns {Promise<object>} CharacterData
 */
export async function parseHokanjo(jsonText, id) {
  let d;
  try {
    d = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
  } catch (e) {
    throw new AppError('PARSE_FAILED', `JSONパース失敗: ${e.message}`);
  }

  const sourceUrl = `https://charasheet.vampire-blood.net/${id}`;
  const charData = createEmptyCharacterData(sourceUrl, 'hokanjo');

  // ── キャラクター名 ──
  try {
    charData.name = (d.pc_name ?? '').trim() || '名無し';
  } catch (e) {
    charData.parseWarnings.push('キャラクター名の取得に失敗');
    charData.isPartial = true;
  }

  // ── 能力値（NP1〜NP8） ──
  const statMapping = [
    { name: 'STR', key: 'NP1' },
    { name: 'CON', key: 'NP2' },
    { name: 'POW', key: 'NP3' },
    { name: 'DEX', key: 'NP4' },
    { name: 'APP', key: 'NP5' },
    { name: 'SIZ', key: 'NP6' },
    { name: 'INT', key: 'NP7' },
    { name: 'EDU', key: 'NP8' },
  ];

  for (const { name, key } of statMapping) {
    try {
      const val = safeInt(d[key], 0);
      charData.stats[name] = val;
      if (val === 0) {
        charData.parseWarnings.push(`${name}の取得に失敗（値が0またはパースエラー）`);
        charData.isPartial = true;
      }
    } catch (e) {
      charData.parseWarnings.push(`${name}の取得に失敗: ${e.message}`);
      charData.isPartial = true;
    }
  }

  // ── HP / MP / SAN ──
  charData.stats.currentHP  = safeInt(d.NP9,      0);
  charData.stats.currentMP  = safeInt(d.NP10,     0);
  charData.stats.currentSAN = safeInt(d.SAN_Left, 0);

  // ── 派生ステータス計算 ──
  computeDerivedStats(charData);

  // ── 技能パース ──
  const parsedSkills = new Map();

  for (const tableDef of SKILL_TABLE_DEFS) {
    const values = d[tableDef.key];
    if (!Array.isArray(values)) continue;

    // 1. 基本固定技能
    for (let i = 0; i < tableDef.names.length; i++) {
      const value = safeInt(values[i], -1);
      if (value < 0) continue;

      let skillName = tableDef.names[i];

      // サブカテゴリが定義されている場合
      if (tableDef.subKeys && tableDef.subKeys[i] !== undefined) {
        const subKey = tableDef.subKeys[i];
        const subVal = (d[subKey] ?? '').trim();
        skillName = subVal ? `${skillName}(${subVal})` : `${skillName}()`;
      }

      const normalizedName = normalizeSkillName(skillName);
      parsedSkills.set(normalizedName, { value, displayName: skillName, category: tableDef.category });
    }

    // 2. ユーザー追加技能（「＋増やす」で行追加された自由記入技能）
    const customNames = d[tableDef.nameKey];
    if (Array.isArray(customNames)) {
      for (let j = 0; j < customNames.length; j++) {
        const customName = (customNames[j] ?? '').trim();
        if (!customName) continue;

        // 保管所では追加行の値は values の固定長以降に格納される
        let value = -1;
        if (values.length > tableDef.names.length + j) {
          value = safeInt(values[tableDef.names.length + j], -1);
        }

        if (value >= 0) {
          const normalizedName = normalizeSkillName(customName);
          // カテゴリを付与することでbuildSkillEntriesが正しい位置に挿入できる
          parsedSkills.set(normalizedName, { value, displayName: customName, category: tableDef.category });
        }
      }
    }
  }

  charData.skills = buildSkillEntries(parsedSkills, charData.stats);

  // 必須フィールドの最終チェック
  if (charData.name === '名無し' && charData.stats.STR === 0 && charData.stats.CON === 0) {
    throw new AppError('PARSE_FAILED', 'キャラクター保管所JSONから必須データを取得できませんでした');
  }

  return charData;
}
