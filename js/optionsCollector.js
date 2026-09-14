/**
 * js/optionsCollector.js
 *
 * DOM上の各種設定値・オプション入力の収集およびUIへの反映を行うモジュール。
 * main.js と preset.js の双方から呼び出され、DOM読み取りロジックを一元化します。
 */

import { setCheckboxChecked } from './utils.js';

/**
 * カスタムステータス行をDOMから収集する
 * @param {object} [options]
 * @param {boolean} [options.parseNumbers=false] - 数値としてパースするか
 * @param {boolean} [options.filterEmpty=false] - ラベルが空の行を除外するか
 * @returns {Array<{label: string, value: string|number, max: string|number}>}
 */
export function collectCustomStatuses({ parseNumbers = false, filterEmpty = false } = {}) {
  const rows = Array.from(document.querySelectorAll('.custom-status-row'));
  return rows
    .map(row => {
      const label = row.querySelector('.status-label')?.value || '';
      const rawVal = row.querySelector('.status-val')?.value || '0';
      const rawMax = row.querySelector('.status-max')?.value || '0';

      return {
        label,
        value: parseNumbers ? (parseInt(rawVal, 10) || 0) : rawVal,
        max: parseNumbers ? (parseInt(rawMax, 10) || 0) : rawMax,
      };
    })
    .filter(st => (filterEmpty ? st.label.trim() !== '' : true));
}

/**
 * カスタムパラメータ項目をDOMから収集する
 * @param {object} [options]
 * @param {boolean} [options.filterEmpty=false] - ラベルが空の項目を除外するか
 * @returns {Array<{label: string, value: string}>}
 */
export function collectCustomParams({ filterEmpty = false } = {}) {
  const items = Array.from(document.querySelectorAll('.custom-param-item'));
  return items
    .map(item => ({
      label: item.querySelector('.param-label')?.value || '',
      value: item.querySelector('.param-val')?.value || '0',
    }))
    .filter(p => (filterEmpty ? p.label.trim() !== '' : true));
}

/**
 * カスタム差分表情項目をDOMから収集する
 * @returns {Array<{name: string, iconUrl: string}>}
 */
export function collectCustomFaces() {
  const items = Array.from(document.querySelectorAll('.ccfolia-face-item'));
  return items.map(item => ({
    name: item.querySelector('.face-label')?.value || '',
    iconUrl: '',
  }));
}

/**
 * 特殊ロール（狂気・不定の狂気・アイデア等）のチェック状態をDOMから収集する
 * @returns {Record<string, boolean>}
 */
export function collectSpecialRolls() {
  const rolls = {};
  document.querySelectorAll('.opt-special-roll').forEach(el => {
    const roll = el.dataset.roll;
    if (roll) {
      rolls[roll] = el.checked;
    }
  });
  return rolls;
}

/**
 * 個別能力値×5のチェック状態をDOMから収集する
 * @returns {Record<string, boolean>}
 */
export function collectStatTimes5() {
  const stats = {};
  document.querySelectorAll('.opt-stat-times5').forEach(el => {
    const stat = el.dataset.stat;
    if (stat) {
      stats[stat] = el.checked;
    }
  });
  return stats;
}

/**
 * main.js が変換処理・プレビュー更新で必要とする完全なオプションオブジェクトをDOMから収集する
 * @returns {object}
 */
export function collectOptions() {
  const diceCommandEl = document.querySelector('input[name="diceCommand"]:checked');
  const diceCommand = diceCommandEl ? diceCommandEl.value : 'CCB';

  const showInitialSkills = document.getElementById('opt-show-initial-skills')?.checked ?? true;
  const showDodge = document.getElementById('opt-show-dodge')?.checked ?? true;
  const showPerceptionSkills = document.getElementById('opt-show-perception-skills')?.checked ?? true;
  const showCombatDamage = document.getElementById('opt-show-combat-damage')?.checked ?? true;

  const showSpecialRolls = collectSpecialRolls();
  const showStatTimes5All = document.getElementById('opt-show-stat-times5-all')?.checked ?? false;
  const showStatTimes5 = collectStatTimes5();

  const hideStatus = document.getElementById('preview-secret')?.checked ?? true;
  const invisible = document.getElementById('preview-invisible')?.checked ?? false;
  const hideStatusFromBoard = document.getElementById('preview-hide-status')?.checked ?? false;

  const tokenSize = parseFloat(document.getElementById('preview-size')?.value) || 4;
  const x = tokenSize * -12;
  const y = tokenSize * -12;

  const chatColorMode = document.querySelector('input[name="chatColorMode"]:checked')?.value || 'default';
  const useDefaultColor = chatColorMode === 'default';
  const chatColor = document.getElementById('opt-chat-color')?.value || '#A4C2F4';

  const customStatuses = collectCustomStatuses({ parseNumbers: false, filterEmpty: false });
  const customParams = collectCustomParams({ filterEmpty: false });
  const customFaces = collectCustomFaces();

  return {
    diceCommand,
    showInitialSkills,
    showDodge,
    showPerceptionSkills,
    showCombatDamage,
    showSpecialRolls,
    showStatTimes5All,
    showStatTimes5,
    hideStatus,
    invisible,
    hideStatusFromBoard,
    tokenSize,
    x,
    y,
    chatColorMode,
    useDefaultColor,
    chatColor,
    customStatuses,
    customParams,
    customFaces,
  };
}

/**
 * オプションオブジェクトをUI要素（チェックボックス・ラジオ・カラー等）に反映する
 * @param {object} opts
 */
export function applyOptionsToUI(opts = {}) {
  setCheckboxChecked('opt-show-initial-skills', opts.showInitialSkills ?? true);
  setCheckboxChecked('opt-show-dodge', opts.showDodge ?? true);
  setCheckboxChecked('opt-show-perception-skills', opts.showPerceptionSkills ?? true);
  setCheckboxChecked('opt-show-combat-damage', opts.showCombatDamage ?? true);

  if (opts.showSpecialRolls) {
    document.querySelectorAll('.opt-special-roll').forEach(el => {
      const roll = el.dataset.roll;
      if (roll && opts.showSpecialRolls[roll] !== undefined) {
        el.checked = !!opts.showSpecialRolls[roll];
      }
    });
  }

  const allStatTimes5 = opts.showStatTimes5All ?? false;
  setCheckboxChecked('opt-show-stat-times5-all', allStatTimes5);

  const individualStatTimes5 = document.querySelectorAll('.opt-stat-times5');
  individualStatTimes5.forEach(el => {
    const stat = el.dataset.stat;
    el.disabled = allStatTimes5;
    if (allStatTimes5) {
      el.checked = true;
    } else if (stat && opts.showStatTimes5 && opts.showStatTimes5[stat] !== undefined) {
      el.checked = !!opts.showStatTimes5[stat];
    }
  });

  const colorMode = opts.chatColorMode || (opts.useDefaultColor === false ? 'custom' : 'default');
  const radio = document.querySelector(`input[name="chatColorMode"][value="${colorMode}"]`);
  if (radio) radio.checked = true;

  const chatColorHex = (opts.chatColor || '#A4C2F4').toUpperCase();
  const colorInput = document.getElementById('opt-chat-color');
  if (colorInput) {
    colorInput.value = chatColorHex;
  }
  const swatchEl = document.getElementById('chat-color-swatch');
  if (swatchEl) {
    swatchEl.style.backgroundColor = chatColorHex;
  }
  const hexTextEl = document.getElementById('chat-color-hex');
  if (hexTextEl) {
    hexTextEl.textContent = chatColorHex;
  }

  // カラーピッカーインスタンス等に通知
  window.dispatchEvent(new CustomEvent('presetColorApplied', { detail: { color: chatColorHex } }));
}
