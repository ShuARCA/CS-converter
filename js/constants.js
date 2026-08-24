/**
 * constants.js — 定数定義モジュール
 *
 * SKILLS定義・DB計算表・技能名正規化マップ・デフォルトオプション・エラー型定義
 * を一箇所に集約する。他の全モジュールがこのファイルに依存する。
 */

// ────────────────────────────────────────────
// 全60技能リスト（初期値・カテゴリ・ダメージ・正規化名）
// ────────────────────────────────────────────

/**
 * initial が文字列の場合は動的計算（'DEX*2' = DEX の2倍 / 'EDU*5' = EDU の5倍）
 * damage: showCombatDamage=true の場合に追加するダメージダイス。null はダメージ行なし
 * normNames: 各サービスから取得した技能名を正規化するためのエイリアスリスト
 */
export const SKILLS = [
  // ── 戦闘技能 ──
  { name: '回避',             initial: 'DEX*2', category: 'combat',    damage: null,  normNames: ['回避'] },
  { name: 'キック',           initial: 25,      category: 'combat',    damage: '1d6', normNames: ['キック'] },
  { name: '組み付き',         initial: 25,      category: 'combat',    damage: null,  normNames: ['組み付き', '組みつき'] },
  { name: 'こぶし（パンチ）', initial: 50,      category: 'combat',    damage: '1d3', normNames: ['こぶし', 'こぶし（パンチ）', 'パンチ'] },
  { name: '頭突き',           initial: 10,      category: 'combat',    damage: '1d4', normNames: ['頭突き', '頭つき'] },
  { name: '投擲',             initial: 25,      category: 'combat',    damage: null,  normNames: ['投擲'] },
  { name: 'マーシャルアーツ', initial: 1,       category: 'combat',    damage: null,  normNames: ['マーシャルアーツ', '武道'] },
  { name: '拳銃',             initial: 20,      category: 'combat',    damage: null,  normNames: ['拳銃'] },
  { name: 'サブマシンガン',   initial: 15,      category: 'combat',    damage: null,  normNames: ['サブマシンガン'] },
  { name: 'ショットガン',     initial: 30,      category: 'combat',    damage: null,  normNames: ['ショットガン'] },
  { name: 'マシンガン',       initial: 15,      category: 'combat',    damage: null,  normNames: ['マシンガン'] },
  { name: 'ライフル',         initial: 25,      category: 'combat',    damage: null,  normNames: ['ライフル'] },
  // ── 探索技能 ──
  { name: '応急手当',         initial: 30,      category: 'search',    damage: null,  normNames: ['応急手当'] },
  { name: '鍵開け',           initial: 1,       category: 'search',    damage: null,  normNames: ['鍵開け', '錠前'] },
  { name: '隠す',             initial: 15,      category: 'search',    damage: null,  normNames: ['隠す'] },
  { name: '隠れる',           initial: 10,      category: 'search',    damage: null,  normNames: ['隠れる'] },
  { name: '聞き耳',           initial: 25,      category: 'search',    damage: null,  normNames: ['聞き耳'] },
  { name: '忍び歩き',         initial: 10,      category: 'search',    damage: null,  normNames: ['忍び歩き', '忍びあるき'] },
  { name: '写真術',           initial: 10,      category: 'search',    damage: null,  normNames: ['写真術'] },
  { name: '精神分析',         initial: 1,       category: 'search',    damage: null,  normNames: ['精神分析'] },
  { name: '追跡',             initial: 10,      category: 'search',    damage: null,  normNames: ['追跡'] },
  { name: '登攀',             initial: 40,      category: 'search',    damage: null,  normNames: ['登攀', '登はん', 'クライミング'] },
  { name: '図書館',           initial: 25,      category: 'search',    damage: null,  normNames: ['図書館'] },
  { name: '目星',             initial: 25,      category: 'search',    damage: null,  normNames: ['目星'] },
  // ── 行動技能 ──
  { name: '運転()',           initial: 20,      category: 'action',    damage: null,  normNames: ['運転'] },
  { name: '機械修理',         initial: 20,      category: 'action',    damage: null,  normNames: ['機械修理'] },
  { name: '重機械操作',       initial: 1,       category: 'action',    damage: null,  normNames: ['重機械操作'] },
  { name: '乗馬',             initial: 5,       category: 'action',    damage: null,  normNames: ['乗馬'] },
  { name: '水泳',             initial: 25,      category: 'action',    damage: null,  normNames: ['水泳'] },
  { name: '製作()',           initial: 5,       category: 'action',    damage: null,  normNames: ['製作'] },
  { name: '操縦()',           initial: 1,       category: 'action',    damage: null,  normNames: ['操縦'] },
  { name: '跳躍',             initial: 25,      category: 'action',    damage: null,  normNames: ['跳躍'] },
  { name: '電気修理',         initial: 10,      category: 'action',    damage: null,  normNames: ['電気修理'] },
  { name: 'ナビゲート',       initial: 10,      category: 'action',    damage: null,  normNames: ['ナビゲート', 'ナビ'] },
  { name: '変装',             initial: 1,       category: 'action',    damage: null,  normNames: ['変装'] },
  // ── 交渉技能 ──
  { name: '言いくるめ',       initial: 5,       category: 'negotiate', damage: null,  normNames: ['言いくるめ'] },
  { name: '信用',             initial: 15,      category: 'negotiate', damage: null,  normNames: ['信用'] },
  { name: '説得',             initial: 15,      category: 'negotiate', damage: null,  normNames: ['説得'] },
  { name: '値切り',           initial: 5,       category: 'negotiate', damage: null,  normNames: ['値切り'] },
  { name: '母国語()',         initial: 'EDU*5', category: 'negotiate', damage: null,  normNames: ['母国語'] },
  // ── 知識技能 ──
  { name: '医学',             initial: 5,       category: 'knowledge', damage: null,  normNames: ['医学'] },
  { name: 'オカルト',         initial: 5,       category: 'knowledge', damage: null,  normNames: ['オカルト'] },
  { name: '化学',             initial: 1,       category: 'knowledge', damage: null,  normNames: ['化学'] },
  { name: 'クトゥルフ神話',   initial: 0,       category: 'knowledge', damage: null,  normNames: ['クトゥルフ神話', 'クトゥルー神話'] },
  { name: '芸術()',           initial: 5,       category: 'knowledge', damage: null,  normNames: ['芸術'] },
  { name: '経理',             initial: 10,      category: 'knowledge', damage: null,  normNames: ['経理'] },
  { name: '考古学',           initial: 1,       category: 'knowledge', damage: null,  normNames: ['考古学'] },
  { name: 'コンピューター',   initial: 1,       category: 'knowledge', damage: null,  normNames: ['コンピューター', 'PC'] },
  { name: '心理学',           initial: 5,       category: 'knowledge', damage: null,  normNames: ['心理学'] },
  { name: '人類学',           initial: 1,       category: 'knowledge', damage: null,  normNames: ['人類学'] },
  { name: '生物学',           initial: 1,       category: 'knowledge', damage: null,  normNames: ['生物学'] },
  { name: '地質学',           initial: 1,       category: 'knowledge', damage: null,  normNames: ['地質学'] },
  { name: '電子工学',         initial: 1,       category: 'knowledge', damage: null,  normNames: ['電子工学'] },
  { name: '天文学',           initial: 1,       category: 'knowledge', damage: null,  normNames: ['天文学'] },
  { name: '博物学',           initial: 10,      category: 'knowledge', damage: null,  normNames: ['博物学'] },
  { name: '物理学',           initial: 1,       category: 'knowledge', damage: null,  normNames: ['物理学'] },
  { name: '法律',             initial: 5,       category: 'knowledge', damage: null,  normNames: ['法律'] },
  { name: '薬学',             initial: 1,       category: 'knowledge', damage: null,  normNames: ['薬学'] },
  { name: '歴史',             initial: 20,      category: 'knowledge', damage: null,  normNames: ['歴史'] },
];

// ────────────────────────────────────────────
// 技能名正規化マップ
// ────────────────────────────────────────────

/**
 * key: サービスから取得した技能名（正規化前）
 * value: SKILLS[].name の正式名称
 */
export const SKILL_NAME_NORMALIZE_MAP = {
  'こぶし':          'こぶし（パンチ）',
  'パンチ':          'こぶし（パンチ）',
  '頭つき':          '頭突き',
  '組みつき':        '組み付き',
  '武道':            'マーシャルアーツ',
  '忍びあるき':      '忍び歩き',
  '登はん':          '登攀',
  'クライミング':    '登攀',
  'ナビ':            'ナビゲート',
  'PC':              'コンピューター',
  'クトゥルー神話':  'クトゥルフ神話',
  // 括弧付き技能の正規化（括弧内を除いた場合）
  '運転':            '運転()',
  '製作':            '製作()',
  '操縦':            '操縦()',
  '芸術':            '芸術()',
  '母国語':          '母国語()',
  '錠前':            '鍵開け',
};

// ────────────────────────────────────────────
// ダメージボーナス計算表
// ────────────────────────────────────────────

/**
 * STR + SIZ の合計値からダメージボーナスを計算
 * @param {number} STR
 * @param {number} SIZ
 * @returns {string} ダメージボーナス文字列（例: "+1d4", "-1d6", "+0"）
 */
export function calcDB(STR, SIZ) {
  const sum = STR + SIZ;
  if (sum <= 12)  return '-1d6';
  if (sum <= 16)  return '-1d4';
  if (sum <= 24)  return '+0';
  if (sum <= 32)  return '+1d4';
  if (sum <= 40)  return '+1d6';
  if (sum <= 56)  return '+2d6';
  if (sum <= 72)  return '+3d6';
  if (sum <= 88)  return '+4d6';
  return '+5d6';
}

// ────────────────────────────────────────────
// 技能初期値の動的計算ヘルパー
// ────────────────────────────────────────────

/**
 * SKILLS[].initial が文字列の場合に能力値から初期値を計算する
 * @param {string|number} initial - 初期値（数値またはDEX*2, EDU*5 等の計算式文字列）
 * @param {object} stats - 能力値オブジェクト { STR, CON, POW, DEX, APP, SIZ, INT, EDU }
 * @returns {number}
 */
export function resolveInitial(initial, stats) {
  if (typeof initial === 'number') return initial;
  // 'DEX*2' / 'EDU*5' の形式をパース
  const match = initial.match(/^([A-Z]+)\*(\d+)$/);
  if (match) {
    const statName = match[1];
    const multiplier = parseInt(match[2], 10);
    const statValue = stats[statName] ?? 0;
    return statValue * multiplier;
  }
  return 0;
}

// ────────────────────────────────────────────
// ユーザーオプション デフォルト値
// ────────────────────────────────────────────

export const DEFAULT_OPTIONS = {
  diceCommand:          'CCB',
  showInitialSkills:    true,
  showDodge:            true,
  showPerceptionSkills: true,
  showCombatDamage:     true,
  showStatTimes5All:    false,
  showStatTimes5: {
    STR: true, CON: true, POW: true, DEX: true,
    APP: true, SIZ: true, INT: true, EDU: true,
  },
  hideStatus:           true,
  invisible:            true,
  hideStatusFromBoard:  false,
  tokenSize:            4,
  useDefaultColor:      true,
  chatColor:            '#a4c2f4',
};

// ────────────────────────────────────────────
// エラー型定義
// ────────────────────────────────────────────

/**
 * AppErrorCode → 日本語メッセージ対応表
 */
export const ERROR_MESSAGES = {
  INPUT_EMPTY:        '入力欄にURLまたはJSONデータを入力してください。',
  JSON_PARSE_ERROR:   'JSONの形式が正しくありません。ココフォリア駒出力のJSONを正確に貼り付けてください。',
  JSON_NOT_CHARACTER: 'ココフォリアのキャラクター駒データではありません。「kind: "character"」を含むJSONを入力してください。',
  JSON_MISSING_DATA:  'JSONデータの構造が不正です。ココフォリア駒出力のJSONを正確に貼り付けてください。',
  IACHARA_REDIRECT:   'いあきゃらのURLには直接対応していません。いあきゃらのココフォリア駒出力機能でJSONを出力し、その内容をこの入力欄に貼り付けてください。',
  URL_UNSUPPORTED:    'キャラクター保管所・キャラエノのURL、またはココフォリア駒JSONを入力してください。',
  URL_INVALID_FORMAT: 'URLの形式が正しくありません。キャラクターIDが数字のURLを入力してください。',
  NETWORK_ERROR:      'ネットワークエラーが発生しました。接続状況を確認してください。',
  PROXY_ERROR:        'データ取得用のプロキシに接続できませんでした。時間をおいて再度お試しください。',
  HTTP_NOT_FOUND:     'キャラクターが見つかりませんでした。URLが正しいか確認してください。',
  HTTP_ERROR:         'データの取得に失敗しました。',
  PARSE_FAILED:       'データの解析に失敗しました。6版のキャラクターシートか確認してください。',
  TIMEOUT:            'タイムアウトしました（10秒）。時間をおいて再度お試しください。',
  CLIPBOARD_DENIED:   'クリップボードへのアクセスが拒否されました。手動でコピーしてください。',
};

/**
 * アプリケーション統一エラークラス
 */
export class AppError extends Error {
  /**
   * @param {string} code - AppErrorCode
   * @param {string} [detail] - デバッグ用の詳細（consoleのみ）
   */
  constructor(code, detail = '') {
    const userMessage = ERROR_MESSAGES[code] || 'エラーが発生しました。';
    super(userMessage);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage;
    this.detail = detail;
  }
}



// ────────────────────────────────────────────
// CORSプロキシ設定
// ────────────────────────────────────────────

export const FETCH_TIMEOUT_MS = 10_000;

export const CORS_PROXIES = [
  {
    name: 'allorigins',
    buildUrl: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    extractBody: async (res) => {
      const json = await res.json();
      if (json.status?.http_code === 404) {
        throw new AppError('HTTP_NOT_FOUND');
      }
      if (json.status?.http_code >= 400) {
        throw new AppError('HTTP_ERROR', `HTTP ${json.status.http_code}`);
      }
      return json.contents;
    },
  },
  {
    name: 'corsproxy',
    buildUrl: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    extractBody: async (res) => {
      if (res.status === 404) throw new AppError('HTTP_NOT_FOUND');
      if (!res.ok) throw new AppError('HTTP_ERROR', `HTTP ${res.status}`);
      return await res.text();
    },
  },
  {
    name: 'thingproxy',
    buildUrl: (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
    extractBody: async (res) => {
      if (res.status === 404) throw new AppError('HTTP_NOT_FOUND');
      if (!res.ok) throw new AppError('HTTP_ERROR', `HTTP ${res.status}`);
      return await res.text();
    },
  },
];
