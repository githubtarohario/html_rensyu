const NICKNAME_MAX_LENGTH = 20;

// 前後の空白を除去し、空または20文字を超える場合は null を返す。
// 文字数はコードポイント単位で数える（絵文字なども1文字として扱う）。
function normalizeNickname(raw) {
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;
  if ([...trimmed].length > NICKNAME_MAX_LENGTH) return null;
  return trimmed;
}

module.exports = { normalizeNickname };
