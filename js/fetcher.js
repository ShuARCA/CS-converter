/**
 * fetcher.js — データ取得モジュール
 *
 * CORSプロキシ経由でのfetch、3段階フォールバック、タイムアウト制御。
 */

import { AppError, CORS_PROXIES, FETCH_TIMEOUT_MS } from './constants.js';

/**
 * タイムアウト付きfetch
 * @param {string} url
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new AppError('TIMEOUT');
    }
    throw new AppError('NETWORK_ERROR', e.message);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * CORSプロキシ経由でHTMLを取得する（3段階フォールバック）
 * @param {string} targetUrl - 取得対象の元URL
 * @returns {Promise<string>} HTML文字列
 * @throws {AppError} 全プロキシ失敗時は PROXY_ERROR
 */
export async function fetchWithProxy(targetUrl) {
  /** @type {AppError|null} 最後に発生した HTTP 系エラー（404等）を保持 */
  let lastHttpError = null;

  for (const proxy of CORS_PROXIES) {
    const proxyUrl = proxy.buildUrl(targetUrl);
    try {
      const res = await fetchWithTimeout(proxyUrl);
      const html = await proxy.extractBody(res);
      return html;
    } catch (e) {
      // HTTP_NOT_FOUND はプロキシ問題ではないため即座に throw
      if (e instanceof AppError && e.code === 'HTTP_NOT_FOUND') {
        throw e;
      }
      // HTTP_ERROR もプロキシ問題ではないため保持し、全プロキシ試行後に throw
      if (e instanceof AppError && e.code === 'HTTP_ERROR') {
        lastHttpError = e;
      }
      // TIMEOUT はプロキシの応答遅延の可能性があるため次へ
      console.warn(`[fetcher] ${proxy.name} failed:`, e.detail || e.message);
      continue;
    }
  }

  // 全プロキシ失敗
  if (lastHttpError) throw lastHttpError;
  throw new AppError('PROXY_ERROR', 'すべてのCORSプロキシへの接続に失敗しました');
}
