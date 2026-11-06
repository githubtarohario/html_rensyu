// 練習問題データ
// 新しいタグを追加するときは、この配列に問題を追加するだけでOK。
// category: サイドバーでグループ化される見出し名
// title: 問題一覧に表示される短いタイトル
// description: 問題の説明（HTMLで書いてOK。<br>などで改行できる）
// starter: エディタの初期コード（空文字でもよい）
// answer: 「解答を見る」ボタンで表示される模範解答

const PROBLEMS = [
  // ===== 見出しタグ h1〜h6 =====
  {
    id: "h1-basic",
    category: "見出し（h1〜h6）",
    title: "h1で見出しを作る",
    description:
      "&lt;h1&gt;〜&lt;/h1&gt; を使って「こんにちは」という見出しを表示してください。",
    starter: "",
    answer: "<h1>こんにちは</h1>",
  },
  {
    id: "h-levels",
    category: "見出し（h1〜h6）",
    title: "h1〜h3を使い分ける",
    description:
      "h1に「サイトタイトル」、h2に「セクション見出し」、h3に「小見出し」を表示してください。数字が大きいほど見出しは小さくなります。",
    starter: "",
    answer:
      "<h1>サイトタイトル</h1>\n<h2>セクション見出し</h2>\n<h3>小見出し</h3>",
  },
  {
    id: "h-all",
    category: "見出し（h1〜h6）",
    title: "h1〜h6を全部試す",
    description:
      "h1からh6まですべてのタグを使って、それぞれに「見出し1」〜「見出し6」のように文字を表示し、大きさの違いを確認してください。",
    starter: "",
    answer:
      "<h1>見出し1</h1>\n<h2>見出し2</h2>\n<h3>見出し3</h3>\n<h4>見出し4</h4>\n<h5>見出し5</h5>\n<h6>見出し6</h6>",
  },

  // ===== 段落 p・改行 br =====
  {
    id: "p-basic",
    category: "段落（p）・改行（br）",
    title: "pで段落を作る",
    description:
      "&lt;p&gt;〜&lt;/p&gt; を使って好きな文章を1つ表示してください。段落の上下には少し余白ができます。",
    starter: "",
    answer: "<p>今日は良い天気です。</p>",
  },
  {
    id: "p-multiple",
    category: "段落（p）・改行（br）",
    title: "複数の段落を作る",
    description:
      "&lt;p&gt;タグを2つ使って、別々の段落に分かれた文章を2つ表示してください。",
    starter: "",
    answer: "<p>1つ目の段落です。</p>\n<p>2つ目の段落です。</p>",
  },
  {
    id: "br-basic",
    category: "段落（p）・改行（br）",
    title: "brで改行する",
    description:
      "1つの&lt;p&gt;タグの中で、&lt;br&gt;を使って文章を2行に分けて表示してください。&lt;br&gt;には終了タグがありません。",
    starter: "<p>\n  1行目の文章\n  2行目の文章\n</p>",
    answer: "<p>\n  1行目の文章<br>\n  2行目の文章\n</p>",
  },

  // ===== リンク a・画像 img =====
  {
    id: "a-basic",
    category: "リンク（a）・画像（img）",
    title: "aでリンクを作る",
    description:
      '&lt;a href="URL"&gt;リンクの文字&lt;/a&gt; の形で、好きなサイトへのリンクを作ってください。例: https://www.google.com',
    starter: "",
    answer: '<a href="https://www.google.com">Googleへ</a>',
  },
  {
    id: "img-basic",
    category: "リンク（a）・画像（img）",
    title: "imgで画像を表示する",
    description:
      '&lt;img src="画像のURL" alt="画像の説明"&gt; の形で画像を表示してください。インターネット上の画像URL（例: https://placehold.co/150）を使うか、altの説明文だけでもOKです。&lt;img&gt;には終了タグがありません。',
    starter: "",
    answer: '<img src="https://placehold.co/150" alt="サンプル画像">',
  },
  {
    id: "a-img-combo",
    category: "リンク（a）・画像（img）",
    title: "画像をリンクにする",
    description:
      "&lt;a&gt;タグの中に&lt;img&gt;タグを入れると、画像自体がリンクになります。試してみましょう。",
    starter: "",
    answer:
      '<a href="https://www.google.com">\n  <img src="https://placehold.co/150" alt="サンプル画像">\n</a>',
  },

  // ===== テーブル table・tr・td =====
  {
    id: "table-basic",
    category: "テーブル（table・tr・td）",
    title: "表を1行作る",
    description:
      "&lt;table&gt;の中に&lt;tr&gt;（行）を1つ、その中に&lt;td&gt;（セル）を2つ作って、好きな文字を入れてください。",
    starter: "",
    answer: "<table>\n  <tr>\n    <td>セル1</td>\n    <td>セル2</td>\n  </tr>\n</table>",
  },
  {
    id: "table-multi-row",
    category: "テーブル（table・tr・td）",
    title: "複数行の表を作る",
    description:
      "&lt;tr&gt;を2行以上、それぞれに&lt;td&gt;を2〜3個入れて、簡単な表（例: 名前と点数の一覧）を作ってください。",
    starter: "",
    answer:
      "<table>\n  <tr>\n    <td>名前</td>\n    <td>点数</td>\n  </tr>\n  <tr>\n    <td>太郎</td>\n    <td>80</td>\n  </tr>\n  <tr>\n    <td>花子</td>\n    <td>95</td>\n  </tr>\n</table>",
  },
];
