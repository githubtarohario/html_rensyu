// HTMLタグを色分け表示するための簡易シンタックスハイライト。
// <, >, タグ名, 属性名, 属性値をそれぞれ別の色のspanで囲んだHTML文字列を返す。
// 本格的なHTMLパーサーではないが、練習サイトで打つ程度のシンプルなタグなら十分対応できる。

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlightAttributes(attrText) {
  return attrText.replace(
    /([a-zA-Z_:][a-zA-Z0-9_:.-]*)(=)("[^"]*"|'[^']*')|([a-zA-Z_:][a-zA-Z0-9_:.-]*)/g,
    function (match, name, eq, value, boolName) {
      if (name) {
        return (
          '<span class="hl-attr-name">' + name + "</span>" +
          '<span class="hl-punct">' + eq + "</span>" +
          '<span class="hl-attr-value">' + value + "</span>"
        );
      }
      return '<span class="hl-attr-name">' + boolName + "</span>";
    }
  );
}

// このサイトで扱う正しいタグ名の一覧。
// problems.jsに新しいタグの問題を増やしたときは、ここにも追加する。
const KNOWN_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "a", "img", "table", "tr", "td",
];

function highlightHtml(code) {
  const escaped = escapeHtml(code);

  return escaped.replace(
    /&lt;(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^&]*?)&gt;/g,
    function (match, slash, tagName, rest) {
      // 知らないタグ名（打ち間違いなど）は色付け・太字にせず、そのまま表示する
      if (KNOWN_TAGS.indexOf(tagName.toLowerCase()) === -1) {
        return match;
      }

      let selfClose = "";
      let attrs = rest;

      const selfCloseMatch = rest.match(/\/\s*$/);
      if (selfCloseMatch) {
        selfClose = "/";
        attrs = rest.slice(0, selfCloseMatch.index);
      }

      return (
        '<span class="hl-punct">&lt;' + slash + "</span>" +
        '<span class="hl-tag">' + tagName + "</span>" +
        highlightAttributes(attrs) +
        '<span class="hl-punct">' + selfClose + "&gt;</span>"
      );
    }
  );
}
