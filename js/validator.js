/**
 * validator.js — バリデーションモジュール
 *
 * URL・tokenSize・chatColor の入力値を検証する。
 */

import { detectService } from './detector.js';
import { AppError } from './constants.js';

/**
 * URL バリデーション
 * @param {string} url
 * @returns {{ ok: true, service: string, id: string } | { ok: false, code: string }}
 */
export function validateUrl(url) {
  if (!url || url.trim() === '') {
    return { ok: false, code: 'INPUT_EMPTY' };
  }
  const result = detectService(url);
  if (!result) {
    return { ok: false, code: 'URL_UNSUPPORTED' };
  }
  if (result.service === 'iachara_redirect') {
    return { ok: false, code: 'IACHARA_REDIRECT' };
  }
  // ID部分が数字のみで構成されているかはregexで担保済み
  return { ok: true, ...result };
}

/**
 * ココフォリア駒JSON バリデーション
 * @param {string} jsonStr
 * @returns {{ ok: true, json: object } | { ok: false, code: string }}
 */
export function validateCcfoliaJson(jsonStr) {
  try {
    const json = JSON.parse(jsonStr);
    if (!json || typeof json !== 'object') {
      return { ok: false, code: 'JSON_PARSE_ERROR' };
    }
    if (json.kind !== 'character') {
      return { ok: false, code: 'JSON_NOT_CHARACTER' };
    }
    if (!json.data || typeof json.data !== 'object') {
      return { ok: false, code: 'JSON_MISSING_DATA' };
    }
    return { ok: true, json };
  } catch (e) {
    return { ok: false, code: 'JSON_PARSE_ERROR' };
  }
}

/**
 * 入力値を自動判別してバリデーション
 * @param {string} rawInput - ユーザー入力（URLまたはJSON文字列）
 * @returns {{ ok: true, type: 'url'|'json', ... } | { ok: false, code: string }}
 */
export function validateInput(rawInput) {
  const trimmed = rawInput.trim();
  if (!trimmed) return { ok: false, code: 'INPUT_EMPTY' };

  // JSONの自動判別（{ で始まる場合）
  if (trimmed.startsWith('{')) {
    const res = validateCcfoliaJson(trimmed);
    if (res.ok) {
      return { ok: true, type: 'json', json: res.json };
    }
    return res;
  }

  // URL判別（既存ロジック）
  const res = validateUrl(trimmed);
  if (res.ok) {
    return { ok: true, type: 'url', ...res };
  }
  return res;
}

/**
 * オプション値のサニタイズ（バリデーション失敗時はデフォルトに戻す）
 * @param {object} options - UIから収集した生のオプション
 * @returns {object} サニタイズ済みオプション
 */
export function sanitizeOptions(options) {
  const sanitized = { ...options };

  // tokenSize: 0.5〜10の範囲、小数点1桁まで
  const ts = parseFloat(sanitized.tokenSize);
  if (isNaN(ts) || ts < 0.5 || ts > 10) {
    sanitized.tokenSize = 4;
  } else {
    sanitized.tokenSize = Math.round(ts * 10) / 10;
  }

  // chatColor: #rrggbb 形式
  const colorPattern = /^#[0-9a-fA-F]{6}$/;
  if (!colorPattern.test(sanitized.chatColor)) {
    sanitized.chatColor = '#888888';
  }

  return sanitized;
}
