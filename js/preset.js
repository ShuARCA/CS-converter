/**
 * js/preset.js
 *
 * プリセットデータの構造定義、収集、適用、localStorage永続化を担当するモジュール。
 * ロバスト性と拡張性を備え、データバージョニングに対応。
 */

import { serializePaletteBlocks, setPaletteBlocks, DEFAULT_PALETTE_BLOCKS } from './paletteConfig.js';
import { DEFAULT_OPTIONS } from './constants.js';

export const STORAGE_KEY_PRESETS = 'ccfolia_cs_converter_presets_v1';
export const STORAGE_KEY_LAST_INDEX = 'ccfolia_cs_converter_last_preset_idx';
export const MAX_PRESET_SLOTS = 5;
export const CURRENT_PRESET_VERSION = 1;

/**
 * デフォルトのプリセットデータ構造を生成
 * @returns {object} PresetData
 */
export function getDefaultPresetData() {
  return {
    version: CURRENT_PRESET_VERSION,
    memo: '',
    customStatuses: [],
    customParams: [],
    tokenSize: 4,
    hideStatus: true,
    invisible: true,
    hideStatusFromBoard: false,
    diceCommand: 'CCB',
    options: {
      showInitialSkills: DEFAULT_OPTIONS.showInitialSkills,
      showDodge: DEFAULT_OPTIONS.showDodge,
      showPerceptionSkills: DEFAULT_OPTIONS.showPerceptionSkills,
      showCombatDamage: DEFAULT_OPTIONS.showCombatDamage,
      showSpecialRolls: {
        san_check: true,
        indefinite_reset: true,
        idea: true,
        luck: true,
        knowledge: true,
      },
      showStatTimes5All: DEFAULT_OPTIONS.showStatTimes5All,
      showStatTimes5: { ...DEFAULT_OPTIONS.showStatTimes5 },
      useDefaultColor: DEFAULT_OPTIONS.useDefaultColor,
      chatColorMode: DEFAULT_OPTIONS.chatColorMode,
      chatColor: DEFAULT_OPTIONS.chatColor,
    },
    paletteBlocks: JSON.parse(JSON.stringify(DEFAULT_PALETTE_BLOCKS)),
  };
}

/**
 * 現在のUI上の入力状態からプリセットデータを収集する
 * @returns {object} PresetData
 */
export function collectPresetData() {
  // メモ
  const memoEl = document.getElementById('preview-memo');
  const memo = memoEl ? memoEl.value : '';

  // カスタムステータス
  const customStatuses = Array.from(document.querySelectorAll('.custom-status-row')).map(row => ({
    label: row.querySelector('.status-label')?.value || '',
    value: parseInt(row.querySelector('.status-val')?.value, 10) || 0,
    max: parseInt(row.querySelector('.status-max')?.value, 10) || 0,
  })).filter(st => st.label.trim() !== '');

  // カスタムパラメータ
  const customParams = Array.from(document.querySelectorAll('.custom-param-item')).map(item => ({
    label: item.querySelector('.param-label')?.value || '',
    value: item.querySelector('.param-val')?.value || '0',
  })).filter(p => p.label.trim() !== '');

  // 駒サイズ・トグル
  const tokenSize = parseFloat(document.getElementById('preview-size')?.value) || 4;
  const hideStatus = document.getElementById('preview-secret')?.checked ?? true;
  const invisible = document.getElementById('preview-invisible')?.checked ?? true;
  const hideStatusFromBoard = document.getElementById('preview-hide-status')?.checked ?? false;

  // ダイスコマンド
  const diceCommandEl = document.querySelector('input[name="diceCommand"]:checked');
  const diceCommand = diceCommandEl ? diceCommandEl.value : 'CCB';

  // チェックボックス群
  const showInitialSkills = document.getElementById('opt-show-initial-skills')?.checked ?? true;
  const showDodge = document.getElementById('opt-show-dodge')?.checked ?? true;
  const showPerceptionSkills = document.getElementById('opt-show-perception-skills')?.checked ?? true;
  const showCombatDamage = document.getElementById('opt-show-combat-damage')?.checked ?? true;

  // 特殊ロール
  const showSpecialRolls = {};
  document.querySelectorAll('.opt-special-roll').forEach(el => {
    const roll = el.dataset.roll;
    if (roll) {
      showSpecialRolls[roll] = el.checked;
    }
  });

  const showStatTimes5All = document.getElementById('opt-show-stat-times5-all')?.checked ?? false;

  const showStatTimes5 = {};
  document.querySelectorAll('.opt-stat-times5').forEach(el => {
    const stat = el.dataset.stat;
    if (stat) {
      showStatTimes5[stat] = el.checked;
    }
  });

  const chatColorMode = document.querySelector('input[name="chatColorMode"]:checked')?.value || 'default';
  const chatColor = document.getElementById('opt-chat-color')?.value || '#A4C2F4';

  // チャットパレット構成
  const paletteBlocks = serializePaletteBlocks();

  return {
    version: CURRENT_PRESET_VERSION,
    memo,
    customStatuses,
    customParams,
    tokenSize,
    hideStatus,
    invisible,
    hideStatusFromBoard,
    diceCommand,
    options: {
      showInitialSkills,
      showDodge,
      showPerceptionSkills,
      showCombatDamage,
      showSpecialRolls,
      showStatTimes5All,
      showStatTimes5,
      chatColorMode,
      useDefaultColor: chatColorMode === 'default',
      chatColor,
    },
    paletteBlocks,
  };
}

/**
 * プリセットデータをUIに適用する
 * @param {object} presetData - 適用するプリセットデータ
 * @param {Function} [bindDynamicRowListeners] - 動的追加行のイベントバインド関数
 */
export function applyPresetDataToUI(presetData, bindDynamicRowListeners) {
  if (!presetData || typeof presetData !== 'object') return;

  const data = migratePresetData(presetData);

  // 1. メモ
  const memoEl = document.getElementById('preview-memo');
  if (memoEl) {
    memoEl.value = data.memo ?? '';
  }

  // 2. 駒サイズ・座標
  const sizeEl = document.getElementById('preview-size');
  const previewX = document.getElementById('preview-x');
  const previewY = document.getElementById('preview-y');
  if (sizeEl) {
    sizeEl.value = data.tokenSize ?? 4;
    const offset = (data.tokenSize ?? 4) * -12;
    if (previewX) previewX.value = offset;
    if (previewY) previewY.value = offset;
  }

  // 3. トグル
  const secretEl = document.getElementById('preview-secret');
  if (secretEl) secretEl.checked = data.hideStatus ?? true;

  const invisibleEl = document.getElementById('preview-invisible');
  if (invisibleEl) invisibleEl.checked = data.invisible ?? true;

  const hideStatusBoardEl = document.getElementById('preview-hide-status');
  if (hideStatusBoardEl) hideStatusBoardEl.checked = data.hideStatusFromBoard ?? false;

  // 4. カスタムステータス再構築
  const statusContainer = document.getElementById('preview-status-custom');
  if (statusContainer) {
    statusContainer.innerHTML = '';
    if (Array.isArray(data.customStatuses)) {
      data.customStatuses.forEach(st => {
        const div = document.createElement('div');
        div.className = 'ccfolia-status-row custom-status-row mt-1';
        div.innerHTML = `
          <input type="text" class="status-label editable-field" placeholder="ラベル" value="${escapeHtml(st.label || '')}">
          <input type="number" class="status-val editable-field" value="${st.value ?? 0}">
          <input type="number" class="status-max editable-field" value="${st.max ?? 0}">
          <button type="button" class="ccfolia-btn-icon ccfolia-btn-icon--remove" title="削除">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        `;
        if (bindDynamicRowListeners) {
          bindDynamicRowListeners(div);
        }
        statusContainer.appendChild(div);
      });
    }
  }

  // 5. カスタムパラメータ再構築
  const paramsContainer = document.getElementById('preview-params-custom');
  if (paramsContainer) {
    paramsContainer.innerHTML = '';
    if (Array.isArray(data.customParams)) {
      data.customParams.forEach(p => {
        const div = document.createElement('div');
        div.className = 'ccfolia-param-item custom-param-item';
        div.innerHTML = `
          <input type="text" class="param-label editable-field" placeholder="ラベル" value="${escapeHtml(p.label || '')}">
          <input type="text" class="param-val editable-field" value="${escapeHtml(String(p.value ?? '0'))}">
          <button type="button" class="ccfolia-btn-icon ccfolia-btn-icon--remove" title="削除">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        `;
        if (bindDynamicRowListeners) {
          bindDynamicRowListeners(div);
        }
        paramsContainer.appendChild(div);
      });
    }
  }

  // 6. ダイスコマンド
  if (data.diceCommand) {
    const radio = document.querySelector(`input[name="diceCommand"][value="${data.diceCommand}"]`);
    if (radio) radio.checked = true;
  }

  // 7. 各種オプション
  const opts = data.options || {};
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
  // カスタムイベントでカラーピッカーインスタンスに通知可能にする
  window.dispatchEvent(new CustomEvent('presetColorApplied', { detail: { color: chatColorHex } }));

  // 8. チャットパレット構成
  if (Array.isArray(data.paletteBlocks) && data.paletteBlocks.length > 0) {
    setPaletteBlocks(data.paletteBlocks);
  }
}

/**
 * バージョンマイグレーションおよびプロパティ補完
 * @param {object} raw
 * @returns {object}
 */
export function migratePresetData(raw) {
  const defaults = getDefaultPresetData();
  if (!raw || typeof raw !== 'object') return defaults;

  const version = raw.version || 1;
  const migrated = { ...defaults, ...raw };

  if (version < 1) {
    // 将来のバージョンアップ時のマイグレーションロジック
  }

  const rawOpts = raw.options || {};
  const chatColorMode = rawOpts.chatColorMode || (rawOpts.useDefaultColor === false ? 'custom' : 'default');

  migrated.options = {
    ...defaults.options,
    ...rawOpts,
    chatColorMode,
    useDefaultColor: chatColorMode === 'default',
    chatColor: rawOpts.chatColor || defaults.options.chatColor,
    showSpecialRolls: {
      ...defaults.options.showSpecialRolls,
      ...(rawOpts.showSpecialRolls || {}),
    },
    showStatTimes5: {
      ...defaults.options.showStatTimes5,
      ...(rawOpts.showStatTimes5 || {}),
    },
  };

  migrated.version = CURRENT_PRESET_VERSION;
  return migrated;
}

// ────────────────────────────────────────────
// localStorage スロット操作
// ────────────────────────────────────────────

/**
 * 全スロットデータを取得
 * @returns {Array<object|null>}
 */
export function getAllPresetSlots() {
  try {
    const jsonStr = localStorage.getItem(STORAGE_KEY_PRESETS);
    if (!jsonStr) {
      return Array(MAX_PRESET_SLOTS).fill(null);
    }
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.slots)) {
      const slots = parsed.slots.slice(0, MAX_PRESET_SLOTS);
      while (slots.length < MAX_PRESET_SLOTS) {
        slots.push(null);
      }
      return slots;
    }
    return Array(MAX_PRESET_SLOTS).fill(null);
  } catch (e) {
    console.warn('[preset] Failed to read presets from localStorage:', e);
    return Array(MAX_PRESET_SLOTS).fill(null);
  }
}

/**
 * 全スロットの概要情報を取得（UIリスト表示用）
 * @returns {Array<{ name: string, savedAt: string } | null>}
 */
export function getSlotSummaries() {
  const slots = getAllPresetSlots();
  return slots.map(slot => {
    if (!slot) return null;
    return {
      name: slot.name || '名称未設定',
      savedAt: slot.savedAt || '',
    };
  });
}

/**
 * 指定スロットに保存
 * @param {number} slotIndex - 0 〜 4
 * @param {string} [name] - プリセット名（省略時は既存名またはデフォルト名）
 * @param {object} [presetData] - 保存するデータ（省略時は現在のUIから収集）
 * @returns {boolean} 成功したかどうか
 */
export function savePresetToSlot(slotIndex, name = null, presetData = null) {
  if (slotIndex < 0 || slotIndex >= MAX_PRESET_SLOTS) {
    throw new Error(`Invalid slot index: ${slotIndex}`);
  }

  const dataToSave = presetData || collectPresetData();
  const slots = getAllPresetSlots();
  const existingSlot = slots[slotIndex];

  const finalName = (name || existingSlot?.name || `プリセット ${slotIndex + 1}`).trim();

  slots[slotIndex] = {
    name: finalName,
    savedAt: new Date().toISOString(),
    data: dataToSave,
  };

  try {
    const payload = {
      version: CURRENT_PRESET_VERSION,
      slots,
    };
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(payload));
    setLastPresetIndex(slotIndex);
    return true;
  } catch (e) {
    console.error('[preset] Failed to save preset to localStorage:', e);
    throw e;
  }
}

/**
 * 指定スロットのプリセット名称のみを変更
 * @param {number} slotIndex - 0 〜 4
 * @param {string} newName - 新しいプリセット名
 * @returns {boolean}
 */
export function renamePresetSlot(slotIndex, newName) {
  if (slotIndex < 0 || slotIndex >= MAX_PRESET_SLOTS) return false;
  const slots = getAllPresetSlots();
  const slot = slots[slotIndex];
  if (!slot) return false;

  const validName = (newName || '').trim() || `プリセット ${slotIndex + 1}`;
  slot.name = validName;

  try {
    const payload = {
      version: CURRENT_PRESET_VERSION,
      slots,
    };
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.error('[preset] Failed to rename preset slot:', e);
    return false;
  }
}

/**
 * 指定スロットから読み込み
 * @param {number} slotIndex - 0 〜 4
 * @returns {object|null} PresetData
 */
export function loadPresetFromSlot(slotIndex) {
  if (slotIndex < 0 || slotIndex >= MAX_PRESET_SLOTS) return null;
  const slots = getAllPresetSlots();
  const slot = slots[slotIndex];
  if (!slot || !slot.data) return null;
  return slot.data;
}

/**
 * 指定スロットを削除
 * @param {number} slotIndex - 0 〜 4
 * @returns {boolean}
 */
export function deletePresetSlot(slotIndex) {
  if (slotIndex < 0 || slotIndex >= MAX_PRESET_SLOTS) return false;
  const slots = getAllPresetSlots();
  slots[slotIndex] = null;

  try {
    const payload = {
      version: CURRENT_PRESET_VERSION,
      slots,
    };
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(payload));

    // 前回使用インデックスが削除対象だった場合はクリア
    if (getLastPresetIndex() === slotIndex) {
      clearLastPresetIndex();
    }
    return true;
  } catch (e) {
    console.error('[preset] Failed to delete preset slot:', e);
    return false;
  }
}

/**
 * 前回使用したプリセットのスロット番号を取得
 * @returns {number|null}
 */
export function getLastPresetIndex() {
  try {
    const val = localStorage.getItem(STORAGE_KEY_LAST_INDEX);
    if (val === null || val === undefined) return null;
    const num = parseInt(val, 10);
    return isNaN(num) || num < 0 || num >= MAX_PRESET_SLOTS ? null : num;
  } catch (e) {
    return null;
  }
}

/**
 * 前回使用したプリセットのスロット番号を記録
 * @param {number} slotIndex
 */
export function setLastPresetIndex(slotIndex) {
  try {
    if (slotIndex >= 0 && slotIndex < MAX_PRESET_SLOTS) {
      localStorage.setItem(STORAGE_KEY_LAST_INDEX, String(slotIndex));
    }
  } catch (e) {
    console.warn('[preset] Failed to store last preset index:', e);
  }
}

/**
 * 前回使用プリセットの記録をクリア
 */
export function clearLastPresetIndex() {
  try {
    localStorage.removeItem(STORAGE_KEY_LAST_INDEX);
  } catch (e) {
    console.warn('[preset] Failed to clear last preset index:', e);
  }
}

// ────────────────────────────────────────────
// ヘルパー
// ────────────────────────────────────────────

function setCheckboxChecked(id, checked) {
  const el = document.getElementById(id);
  if (el && el.type === 'checkbox') {
    el.checked = !!checked;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
