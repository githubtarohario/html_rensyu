// 入力されたHTMLが問題の正解条件を満たしているかを判定する。
// 判定は問題IDごとのルール（VALIDATORS）で行い、code文字列をDOMParserで解析したDocumentを受け取る。
// problems.jsに新しい問題を増やしたときは、ここにもルールを追加する。

function textOf(el) {
  return el.textContent.trim();
}

function hasTextEqual(doc, selector, expected) {
  return Array.prototype.some.call(doc.querySelectorAll(selector), function (el) {
    return textOf(el) === expected;
  });
}

// <p>の子ノードを<br>で区切ったとき、トリムして空文字でない区間が2つ以上あるか
function hasTwoOrMoreLineSegments(p) {
  let segments = [];
  let current = "";
  Array.prototype.forEach.call(p.childNodes, function (node) {
    if (node.nodeName === "BR") {
      segments.push(current);
      current = "";
    } else {
      current += node.textContent;
    }
  });
  segments.push(current);

  const nonEmpty = segments.filter(function (s) {
    return s.trim() !== "";
  });
  return nonEmpty.length >= 2;
}

const VALIDATORS = {
  "h1-basic": function (doc) {
    return hasTextEqual(doc, "h1", "こんにちは");
  },

  "h-levels": function (doc) {
    return (
      hasTextEqual(doc, "h1", "サイトタイトル") &&
      hasTextEqual(doc, "h2", "セクション見出し") &&
      hasTextEqual(doc, "h3", "小見出し")
    );
  },

  "h-all": function (doc) {
    for (let n = 1; n <= 6; n++) {
      if (!hasTextEqual(doc, "h" + n, "見出し" + n)) {
        return false;
      }
    }
    return true;
  },

  "p-basic": function (doc) {
    return Array.prototype.some.call(doc.querySelectorAll("p"), function (p) {
      return textOf(p) !== "";
    });
  },

  "p-multiple": function (doc) {
    const count = Array.prototype.filter.call(doc.querySelectorAll("p"), function (p) {
      return textOf(p) !== "";
    }).length;
    return count >= 2;
  },

  "br-basic": function (doc) {
    return Array.prototype.some.call(doc.querySelectorAll("p"), function (p) {
      return p.querySelector("br") !== null && hasTwoOrMoreLineSegments(p);
    });
  },

  "a-basic": function (doc) {
    return Array.prototype.some.call(doc.querySelectorAll("a"), function (a) {
      return a.getAttribute("href") !== null && a.getAttribute("href") !== "" && textOf(a) !== "";
    });
  },

  "img-basic": function (doc) {
    return Array.prototype.some.call(doc.querySelectorAll("img"), function (img) {
      const src = img.getAttribute("src");
      const alt = img.getAttribute("alt");
      return src !== null && src !== "" && alt !== null && alt !== "";
    });
  },

  "a-img-combo": function (doc) {
    return Array.prototype.some.call(doc.querySelectorAll("a"), function (a) {
      const href = a.getAttribute("href");
      if (href === null || href === "") {
        return false;
      }
      return Array.prototype.some.call(a.querySelectorAll("img"), function (img) {
        const src = img.getAttribute("src");
        return src !== null && src !== "";
      });
    });
  },

  "table-basic": function (doc) {
    return Array.prototype.some.call(doc.querySelectorAll("table"), function (table) {
      return Array.prototype.some.call(table.querySelectorAll("tr"), function (tr) {
        return tr.querySelectorAll("td").length >= 2;
      });
    });
  },

  "table-multi-row": function (doc) {
    return Array.prototype.some.call(doc.querySelectorAll("table"), function (table) {
      const rows = Array.prototype.filter.call(table.querySelectorAll("tr"), function (tr) {
        return tr.querySelectorAll("td").length >= 2;
      });
      return rows.length >= 2;
    });
  },
};

function checkAnswer(problemId, code) {
  if (!Object.prototype.hasOwnProperty.call(VALIDATORS, problemId)) {
    return false;
  }
  const doc = new DOMParser().parseFromString(code, "text/html");
  return VALIDATORS[problemId](doc) === true;
}
