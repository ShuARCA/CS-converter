/**
 * parsers/charaeno.js — キャラエノ HTMLパーサー
 *
 * URL: https://charaeno.sakasin.net/6/{id}
 * 注意: セレクタは暫定値。実際のHTML構造を確認後に修正が必要。
 * 既知制限: 身長・体重は取得不可。括弧付き技能名が取得できない場合あり。
 */

import { AppError } from '../constants.js';
import {
  safeInt, safeText, normalizeSkillName, findSkillDef,
  createEmptyCharacterData, computeDerivedStats, buildSkillEntries,
} from './parser-utils.js';

/**
 * キャラエノのHTMLをパースしてCharacterDataを返す
 * @param {string} html - 取得したHTML文字列
 * @param {string} id - キャラクターID
 * @returns {Promise<object>} CharacterData
 */
export async function parseCharaeno(html, id) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const sourceUrl = `https://charaeno.sakasin.net/6/${id}`;
  const charData = createEmptyCharacterData(sourceUrl, 'charaeno');

  // ── キャラクター名 ──
  try {
    const nameEl = doc.querySelector('[data-field="name"]')
      || doc.querySelector('h1')
      || doc.querySelector('.character-name');
    if (nameEl && nameEl.textContent.trim()) {
      charData.name = nameEl.textContent.trim();
    } else {
      const title = doc.querySelector('title');
      if (title) {
        const parts = title.textContent.trim().split(/[-|–—]/);
        if (parts.length > 0 && parts[0].trim()) {
          charData.name = parts[0].trim();
        }
      }
    }
  } catch (e) {
    charData.parseWarnings.push('キャラクター名の取得に失敗');
    charData.isPartial = true;
  }

  // ── 能力値 ──
  const statNames = ['STR', 'CON', 'POW', 'DEX', 'APP', 'SIZ', 'INT', 'EDU'];
  for (const stat of statNames) {
    try {
      const selectors = [
        `[data-param="${stat}"]`,
        `[data-ability="${stat}"]`,
        `.param-${stat.toLowerCase()}`,
      ];
      let found = false;
      for (const sel of selectors) {
        const el = doc.querySelector(sel);
        if (el) {
          charData.stats[stat] = safeInt(el.textContent, 0);
          found = true;
          break;
        }
      }
      if (!found) {
        // テーブルセルからテキストベースで検索
        const allCells = doc.querySelectorAll('td, th, dt, dd, span, div');
        for (let i = 0; i < allCells.length; i++) {
          if (allCells[i].textContent.trim() === stat) {
            const next = allCells[i].nextElementSibling;
            if (next) {
              const val = safeInt(next.textContent, -1);
              if (val >= 0) {
                charData.stats[stat] = val;
                found = true;
                break;
              }
            }
          }
        }
      }
      if (!found) {
        charData.parseWarnings.push(`${stat}の取得に失敗`);
        charData.isPartial = true;
      }
    } catch (e) {
      charData.parseWarnings.push(`${stat}の取得に失敗: ${e.message}`);
      charData.isPartial = true;
    }
  }

  // ── HP/MP/SAN ──
  try {
    const hpEl = doc.querySelector('[data-param="hp"]') || doc.querySelector('[data-field="hp"]');
    if (hpEl) {
      charData.stats.currentHP = safeInt(hpEl.textContent, 0);
    }
  } catch { /* computeDerivedStatsで補完 */ }

  try {
    const sanEl = doc.querySelector('[data-param="san"]') || doc.querySelector('[data-field="san"]');
    if (sanEl) {
      charData.stats.currentSAN = safeInt(sanEl.textContent, 0);
    }
  } catch { /* computeDerivedStatsで補完 */ }

  // ── DB ──
  try {
    const dbEl = doc.querySelector('[data-param="db"]') || doc.querySelector('[data-field="db"]');
    if (dbEl) {
      const dbText = dbEl.textContent.trim();
      if (dbText) charData.stats.DB = dbText;
    }
  } catch { /* computeDerivedStatsで補完 */ }

  // ── 派生ステータス計算 ──
  computeDerivedStats(charData);

  // ── 技能パース ──
  const parsedSkills = new Map();
  try {
    // キャラエノの技能テーブル構造を複数パターンで試行
    const skillSelectors = [
      'table tr',
      '.skill-list .skill-item',
      '[data-skill-name]',
    ];

    for (const selector of skillSelectors) {
      const elements = doc.querySelectorAll(selector);
      if (elements.length === 0) continue;

      for (const el of elements) {
        try {
          // data属性ベース
          const dataName = el.getAttribute('data-skill-name');
          if (dataName) {
            const valueEl = el.querySelector('[data-skill-value]') || el.querySelector('.skill-value');
            const value = valueEl ? safeInt(valueEl.textContent, -1) : -1;
            if (value >= 0) {
              const normalizedName = normalizeSkillName(dataName);
              parsedSkills.set(normalizedName, { value, displayName: dataName });
            }
            continue;
          }

          // テーブル行ベース
          const cells = el.querySelectorAll('td');
          if (cells.length >= 2) {
            const rawName = cells[0].textContent.trim();
            const value = safeInt(cells[cells.length - 1].textContent, -1);
            if (rawName && value >= 0) {
              const normalizedName = normalizeSkillName(rawName);
              const displayName = rawName.includes('(') || rawName.includes('（')
                ? rawName.replace(/（/g, '(').replace(/）/g, ')')
                : normalizedName;
              parsedSkills.set(normalizedName, { value, displayName });
            }
          }
        } catch {
          // 個別行の失敗は無視
        }
      }

      if (parsedSkills.size > 0) break; // 技能が取得できたらループ終了
    }
  } catch (e) {
    charData.parseWarnings.push('技能テーブルの解析に失敗');
    charData.isPartial = true;
  }

  charData.skills = buildSkillEntries(parsedSkills, charData.stats);

  // 必須フィールドの最終チェック
  if (charData.name === '名無し' && charData.stats.STR === 0 && charData.stats.CON === 0) {
    throw new AppError('PARSE_FAILED', 'キャラエノHTMLから必須データを取得できませんでした');
  }

  return charData;
}
