/**
 * parsers/index.js — パーサー選択ファクトリ
 *
 * サービス種別に応じたパーサーを選択し、HTML文字列からCharacterDataを生成する。
 */

import { AppError } from '../constants.js';
import { parseHokanjo } from './hokanjo.js';
import { parseCharaeno } from './charaeno.js';
import { parseCcfoliaJson } from './ccfolia-json.js';

/**
 * サービス種別に応じたパーサーで データ → CharacterData に変換
 * @param {string} service - 'ccfolia_json' | 'hokanjo' | 'charaeno'
 * @param {string|object} data - 取得したHTML文字列、またはJSONオブジェクト
 * @param {string} id - キャラクターID（JSON入力の場合はnull）
 * @returns {Promise<object>} CharacterData
 */
export async function parse(service, data, id) {
  if (service === 'ccfolia_json') {
    return await parseCcfoliaJson(data);
  }

  const parsers = {
    hokanjo:     parseHokanjo,
    charaeno:    parseCharaeno,
  };

  const parserFn = parsers[service];
  if (!parserFn) {
    throw new AppError('URL_UNSUPPORTED', `未対応のサービス: ${service}`);
  }

  return await parserFn(data, id);
}
