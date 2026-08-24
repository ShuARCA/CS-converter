/**
 * parsers/ccfolia-json.js — ココフォリアJSON入力パーサー
 *
 * ココフォリア駒データ（JSON）を入力として受け取り、CharacterDataに変換する。
 */

import { AppError } from '../constants.js';
import {
  createEmptyCharacterData,
  computeDerivedStats,
  normalizeSkillName,
  findSkillDef,
  buildSkillEntries
} from './parser-utils.js';

const COMMAND_PATTERN = /^(?:CCB|CC|1d100)<=(\d+)\s+【(.+?)】/;

/**
 * ココフォリア駒JSONオブジェクトから CharacterData に変換
 * @param {object} json - パース済みJSONオブジェクト ({ kind: "character", data: {...} })
 * @returns {Promise<object>} CharacterData
 */
export async function parseCcfoliaJson(json) {
  if (!json || json.kind !== 'character' || !json.data) {
    throw new AppError('JSON_NOT_CHARACTER');
  }

  const d = json.data;
  const charData = createEmptyCharacterData('json_input', 'ccfolia_json');

  charData.name = d.name || '名無し';
  charData.memo = d.memo || '';
  
  // JSON固有のフィールドを保持（プレビューや出力時に利用する）
  charData.iconUrl = d.iconUrl || '';
  charData.externalUrl = d.externalUrl || '';
  charData.originalColor = d.color || '';

  // パラメータ(STR, CON等)の抽出
  if (Array.isArray(d.params)) {
    for (const p of d.params) {
      if (p.label === 'DB') {
        charData.stats.DB = p.value;
      } else if (p.label in charData.stats) {
        charData.stats[p.label] = parseInt(p.value, 10) || 0;
      }
    }
  }

  // ステータス(HP/MP/SAN)の抽出
  if (Array.isArray(d.status)) {
    for (const s of d.status) {
      if (s.label === 'HP') {
        charData.stats.currentHP = s.value;
        charData.stats.maxHP = s.max;
      } else if (s.label === 'MP') {
        charData.stats.currentMP = s.value;
        charData.stats.maxMP = s.max;
      } else if (s.label === 'SAN') {
        charData.stats.currentSAN = s.value;
        charData.stats.initialSAN = s.max;
      }
    }
  }

  // 派生ステータスの補完（DBなどが欠損している場合に備えて）
  computeDerivedStats(charData);

  // チャットパレット（commands）から技能値を逆パース
  if (typeof d.commands === 'string') {
    const lines = d.commands.split('\n');
    const parsedSkills = new Map();

    for (const line of lines) {
      const match = line.match(COMMAND_PATTERN);
      if (match) {
        const valueStr = match[1];
        const displayName = match[2];

        // 「アイデア」「幸運」「知識」などはステータスや定数計算であり技能ではないため除外
        if (['アイデア', '幸運', '知識', 'SAN値チェック', '正気度ロール'].includes(displayName)) {
          continue;
        }

        const value = parseInt(valueStr, 10) || 0;
        const normalizedName = normalizeSkillName(displayName);

        // すでに登録済みの場合はスキップ（上書きしない）
        if (!parsedSkills.has(normalizedName)) {
          parsedSkills.set(normalizedName, { value, displayName });
        }
      }
    }

    // buildSkillEntries と同じロジックで skill 配列を構築
    // ただし json 入力では全60技能の初期値を網羅する必要はないため、取得できた技能のみでリストアップする
    // (オプションで「初期値技能」を出力したくない場合もあるため)
    // 今回の仕様では、既存と同じく全技能を含める(isAcquired 判定のため)
    
    charData.skills = buildSkillEntries(parsedSkills, charData.stats);
  }

  return charData;
}
