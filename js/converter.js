/**
 * converter.js — ココフォリアJSON変換モジュール
 *
 * CharacterData + Options + チャットパレット → ココフォリアJSONオブジェクト
 */

/**
 * ココフォリアJSON形式のオブジェクトを構築する
 * @param {object} charData - CharacterData
 * @param {object} options - Options
 * @param {string} chatPalette - チャットパレット文字列
 * @returns {object} ココフォリアJSONオブジェクト
 */
export function buildCocofoliaJson(charData, options, chatPalette) {
  const s = charData.stats;

  const data = {
    name: charData.name,
    initiative: charData.initiative !== undefined ? charData.initiative : s.DEX,
    memo: charData.memo || '',
    externalUrl: charData.externalUrl || '',
    width: options.tokenSize,
    height: options.tokenSize,
    x: options.x,
    y: options.y,
    secret: options.hideStatus,
    invisible: options.invisible,
    hideStatus: options.hideStatusFromBoard,
    status: [
      { label: 'HP', value: s.currentHP, max: s.maxHP },
      { label: 'MP', value: s.currentMP, max: s.maxMP },
      { label: 'SAN', value: s.currentSAN, max: s.initialSAN },
      ...(options.customStatuses || []).filter(st => st.label).map(st => ({
        label: st.label,
        value: parseInt(st.value) || 0,
        max: parseInt(st.max) || 0
      }))
    ],
    params: [
      { label: 'STR', value: String(s.STR) },
      { label: 'CON', value: String(s.CON) },
      { label: 'POW', value: String(s.POW) },
      { label: 'DEX', value: String(s.DEX) },
      { label: 'APP', value: String(s.APP) },
      { label: 'SIZ', value: String(s.SIZ) },
      { label: 'INT', value: String(s.INT) },
      { label: 'EDU', value: String(s.EDU) },
      { label: 'DB', value: String(s.DB) },
      ...(options.customParams || []).filter(p => p.label).map(p => ({
        label: p.label,
        value: String(p.value)
      }))
    ],
    faces: (options.customFaces || []).filter(f => f.name).map(f => ({
      iconUrl: f.iconUrl || "",
      name: f.name
    })),
    commands: chatPalette,
  };

  if (charData.iconUrl) {
    data.iconUrl = charData.iconUrl;
  }

  // color フィールド: chatColorMode === 'custom' (または useDefaultColor === false) の場合のみ追加
  // デフォルトの場合はキーごと省略する
  const isCustomColor = options.chatColorMode !== undefined ? options.chatColorMode === 'custom' : !options.useDefaultColor;
  if (isCustomColor && options.chatColor) {
    data.color = options.chatColor;
  }

  return {
    kind: 'character',
    data,
  };
}
