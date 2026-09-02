/**
 * parsers/charaeno.js — キャラエノ JSONパーサー
 *
 * 入力URL: https://charaeno.com/6th/{id}
 * API URL:  https://charaeno.com/api/v1/6th/{id}/summary
 * レスポンスは純粋なJSONオブジェクト。
 */

import { AppError } from '../constants.js';
import {
  safeInt, normalizeSkillName,
  createEmptyCharacterData, computeDerivedStats, buildSkillEntries,
} from './parser-utils.js';

/**
 * キャラエノのJSONをパースしてCharacterDataを返す
 * @param {string} jsonText - 取得したJSON文字列
 * @param {string} id - キャラクターID
 * @returns {Promise<object>} CharacterData
 */
export async function parseCharaeno(jsonText, id) {
  let d;
  try {
    d = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
  } catch (e) {
    throw new AppError('PARSE_FAILED', `JSONパース失敗: ${e.message}`);
  }

  const sourceUrl = `https://charaeno.com/6th/${id}`;
  const charData = createEmptyCharacterData(sourceUrl, 'charaeno');

  // ── キャラクター名 ──
  try {
    charData.name = (d.name ?? '').trim() || '名無し';
  } catch (e) {
    charData.parseWarnings.push('キャラクター名の取得に失敗');
    charData.isPartial = true;
  }

  // ── 能力値 (characteristics) ──
  const statMapping = [
    { name: 'STR', key: 'str' },
    { name: 'CON', key: 'con' },
    { name: 'POW', key: 'pow' },
    { name: 'DEX', key: 'dex' },
    { name: 'APP', key: 'app' },
    { name: 'SIZ', key: 'siz' },
    { name: 'INT', key: 'int' },
    { name: 'EDU', key: 'edu' },
  ];

  const ch = d.characteristics ?? {};
  for (const { name, key } of statMapping) {
    try {
      const val = safeInt(ch[key], 0);
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

  // ── HP / MP / SAN (attribute) ──
  const attr = d.attribute ?? {};
  charData.stats.currentHP  = safeInt(attr.hp,  0);
  charData.stats.currentMP  = safeInt(attr.mp,  0);
  charData.stats.currentSAN = safeInt(attr.san?.value, 0);

  // ── 派生ステータス計算 ──
  computeDerivedStats(charData);

  // ── 技能パース (skills[]) ──
  const parsedSkills = new Map();

  if (Array.isArray(d.skills)) {
    for (const skill of d.skills) {
      try {
        const rawName = (skill.name ?? '').trim();
        if (!rawName) continue;

        const value = safeInt(skill.value, -1);
        if (value < 0) continue;

        // 全角括弧を半角に統一
        const displayName = rawName.replace(/（/g, '(').replace(/）/g, ')');
        const normalizedName = normalizeSkillName(displayName);
        parsedSkills.set(normalizedName, { value, displayName });
      } catch {
        // 個別スキルの失敗は無視
      }
    }
  } else {
    charData.parseWarnings.push('技能データ（skills）が見つかりません');
    charData.isPartial = true;
  }

  charData.skills = buildSkillEntries(parsedSkills, charData.stats);

  // 必須フィールドの最終チェック
  if (charData.name === '名無し' && charData.stats.STR === 0 && charData.stats.CON === 0) {
    throw new AppError('PARSE_FAILED', 'キャラエノJSONから必須データを取得できませんでした');
  }

  return charData;
}

