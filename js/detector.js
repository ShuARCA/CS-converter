/**
 * detector.js — URLサービス判別・ID抽出モジュール
 *
 * URLパターンから対応サービス種別とキャラクターIDを抽出する。
 */

const PATTERNS = [
  { service: 'iachara_redirect', regex: /^https?:\/\/iachara\.com\// },
  { service: 'hokanjo',          regex: /^https?:\/\/charasheet\.vampire-blood\.net\/(\d+)/ },
  { service: 'charaeno',         regex: /^https?:\/\/charaeno\.com\/6th\/([\w-]+)/        },
];

/**
 * URLからサービス種別とキャラクターIDを抽出する
 * @param {string} url - キャラクターシートのURL
 * @returns {{ service: string, id: string } | null} - 対応外URLの場合はnull
 */
export function detectService(url) {
  const trimmed = url.trim();
  for (const { service, regex } of PATTERNS) {
    const m = trimmed.match(regex);
    if (m) return { service, id: m[1] };
  }
  return null;
}
