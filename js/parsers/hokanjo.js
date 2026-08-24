/**
 * parsers/hokanjo.js — キャラクター保管所 HTMLパーサー
 *
 * URL: https://charasheet.vampire-blood.net/{id}
 * HTMLフォームの input[name] 属性ベースで全60技能を取得する。
 */

import { AppError } from '../constants.js';
import {
  safeInt, safeInputValue, normalizeSkillName, findSkillDef,
  createEmptyCharacterData, computeDerivedStats, buildSkillEntries,
} from './parser-utils.js';

/**
 * キャラクター保管所のHTMLをパースしてCharacterDataを返す
 * @param {string} html - 取得したHTML文字列
 * @param {string} id - キャラクターID
 * @returns {Promise<object>} CharacterData
 */
export async function parseHokanjo(html, id) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const sourceUrl = `https://charasheet.vampire-blood.net/${id}`;
  const charData = createEmptyCharacterData(sourceUrl, 'hokanjo');

  // ── キャラクター名 ──
  try {
    const pcName = safeInputValue(doc, '[name="pc_name"]');
    charData.name = pcName || '名無し';
  } catch (e) {
    charData.parseWarnings.push('キャラクター名の取得に失敗');
    charData.isPartial = true;
  }

  // ── 能力値（NP1〜NP8） ──
  const statMapping = [
    { name: 'STR', input: 'NP1' },
    { name: 'CON', input: 'NP2' },
    { name: 'POW', input: 'NP3' },
    { name: 'DEX', input: 'NP4' },
    { name: 'APP', input: 'NP5' },
    { name: 'SIZ', input: 'NP6' },
    { name: 'INT', input: 'NP7' },
    { name: 'EDU', input: 'NP8' },
  ];

  for (const { name, input } of statMapping) {
    try {
      const val = safeInputValue(doc, `[name="${input}"]`);
      charData.stats[name] = safeInt(val, 0);
      if (charData.stats[name] === 0) {
        charData.parseWarnings.push(`${name}の取得に失敗（値が0またはパースエラー）`);
        charData.isPartial = true;
      }
    } catch (e) {
      charData.parseWarnings.push(`${name}の取得に失敗: ${e.message}`);
      charData.isPartial = true;
    }
  }

  // ── HP/MP/SAN ──
  try {
    charData.stats.currentHP = safeInt(safeInputValue(doc, '[name="NP9"]'), 0);
  } catch { /* computeDerivedStatsで補完 */ }

  try {
    charData.stats.currentMP = safeInt(safeInputValue(doc, '[name="NP10"]'), 0);
  } catch { /* computeDerivedStatsで補完 */ }

  try {
    charData.stats.currentSAN = safeInt(safeInputValue(doc, '[name="NP16"]'), 0);
  } catch { /* computeDerivedStatsで補完 */ }

  // ── DB（文字列のまま） ──
  try {
    const dbVal = safeInputValue(doc, '[name="NP18"]');
    if (dbVal) charData.stats.DB = dbVal;
  } catch { /* computeDerivedStatsで補完 */ }

  // ── 派生ステータス計算 ──
  computeDerivedStats(charData);

  // ── 技能パース（HTMLテーブル構造から動的に全技能をパース） ──
  const parsedSkills = new Map();

  const tableConfigs = [
    { selector: '#Table_battle_arts', valName: 'TBAP[]', nameInput: 'TBAName[]' },
    { selector: '#Table_find_arts', valName: 'TFAP[]', nameInput: 'TFAName[]' },
    { selector: '#Table_act_arts', valName: 'TAAP[]', nameInput: 'TAAName[]' },
    { selector: '#Table_commu_arts', valName: 'TCAP[]', nameInput: 'TCAName[]' },
    { selector: '#Table_know_arts', valName: 'TKAP[]', nameInput: 'TKAName[]' },
  ];

  for (const config of tableConfigs) {
    try {
      const table = doc.querySelector(config.selector);
      if (!table) continue;

      const rows = table.querySelectorAll('tr');
      for (const row of rows) {
        // 合計値のインプット要素を取得
        const valEl = row.querySelector(`input[name="${config.valName}"]`);
        if (!valEl) continue;

        const value = safeInt(valEl.value, -1);
        if (value < 0) continue;

        // 技能名を表す th 要素を取得
        const th = row.querySelector('th');
        if (!th) continue;

        let skillName = '';

        // カスタム技能名入力欄があるか
        const customNameEl = th.querySelector(`input[name="${config.nameInput}"]`);
        if (customNameEl) {
          skillName = (customNameEl.value ?? '').trim();
        } else {
          // th内にサブカテゴリ入力欄（例: unten_bunya, geijutu_bunya 等）があるか確認
          const subInput = th.querySelector('input');
          if (subInput) {
            const subVal = (subInput.value ?? '').trim();
            const thText = th.textContent.trim();
            // "運転(   )" などのテキストから括弧を取り除いて基本名を取得
            const baseName = thText.split('(')[0].trim();
            if (subVal) {
              skillName = `${baseName}(${subVal})`;
            } else {
              skillName = `${baseName}()`;
            }
          } else {
            skillName = th.textContent.trim();
          }
        }

        if (!skillName) continue;

        const normalizedName = normalizeSkillName(skillName);
        parsedSkills.set(normalizedName, { value, displayName: skillName });
      }
    } catch (e) {
      charData.parseWarnings.push(`テーブル (${config.selector}) の技能パースエラー: ${e.message}`);
      charData.isPartial = true;
    }
  }

  charData.skills = buildSkillEntries(parsedSkills, charData.stats);

  // 必須フィールドの最終チェック
  if (charData.name === '名無し' && charData.stats.STR === 0 && charData.stats.CON === 0) {
    throw new AppError('PARSE_FAILED', 'キャラクター保管所HTMLから必須データを取得できませんでした');
  }

  return charData;
}
