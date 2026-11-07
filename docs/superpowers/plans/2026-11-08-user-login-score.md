# ユーザーID・ログイン・得点記録 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ニックネームでログインした複数人が、HTML練習問題に正解すると得点（正解した問題数）がサーバーに記録され、全員のランキングを見られるようにする。

**Architecture:** 既存の静的サイト（index.html/style.css/script.js/problems.js/highlight.js）はそのまま残し、クライアント側に正誤判定(checker.js)とログインUIを追加する。サーバー側はVercel Serverless Functions（`api/*.js`）を新設し、Vercel Marketplace経由で導入済みのUpstash for Redisにユーザーごとの解答状況・得点・ランキングを保存する。

**Tech Stack:** Node.js（Vercel Serverless Functions、CommonJS）、`@upstash/redis`、Node標準の`node:test`（テストランナー）、ブラウザ標準API（`DOMParser`, `localStorage`, `fetch`）

**Spec:** [docs/superpowers/specs/2026-11-07-user-login-score-design.md](../specs/2026-11-07-user-login-score-design.md)

## Global Constraints

- 正誤判定はクライアント側（ブラウザ）で行い、**正解と判定された時だけ**サーバーのAPIを呼ぶ（不正解では呼ばない）
- 得点＝正解した問題の重複なし件数（同じ問題に何度正解しても加点は1回のみ）
- ログインはニックネームのみ（パスワードなし）。前後の空白を除去し、空文字は拒否、長さの上限は20文字
- ニックネームを画面に表示する際は常にエスケープする（`innerHTML`ではなく`textContent`を使う。XSS対策）
- 同じニックネームを別の人が使った場合は意図的に同一アカウント（同じ得点）として扱う。対策はしない
- サーバー側はクライアントが送ってきた「正解した」という結果をそのまま信頼する（改ざん対策はしない）
- ログイン機能導入時、既存ユーザーは全員得点0・解いた問題0件からスタートする（移行処理は作らない）
- データストアはUpstash for Redis（Vercel Marketplace経由で導入済み。環境変数 `KV_REST_API_URL` / `KV_REST_API_TOKEN`）
- リーダーボードは全件表示。同点はニックネームの昇順（アルファベット順）でタイブレークする
- 既存の11問（`problems.js`）・`highlight.js`の構造は変更しない

## Review Focus

- 空文字・空白のみ・21文字以上のニックネームが送られたとき、保存されずに拒否されること
- 同じ問題に複数回「正解」が送られても、得点が1回分しか増えないこと（冪等性）
- 同じニックネームで別々の問題の正解が送られても、互いの記録を上書きせず両方反映されること（同一ニックネーム共有の挙動）
- まだ誰も得点を持たない状態でリーダーボードを取得してもエラーにならず、空のランキングが返ること
- ニックネームに`<b>`のようなHTMLタグ文字列が含まれていても、画面上はタグとして解釈されず文字そのまま表示されること（XSS対策）

---

## File Structure

- `package.json` — Node依存関係とテストスクリプト
- `api/_lib/nickname.js` — ニックネームの検証
- `api/_lib/redis.js` — Upstash for Redisクライアントの生成（薄いラッパー）
- `api/_lib/store.js` — 得点・解答状況・ランキングの読み書きロジック（Redisクライアントは引数で受け取る＝テスト時に偽クライアントを注入できる）
- `api/score.js` — `POST /api/score` ハンドラ
- `api/me.js` — `GET /api/me` ハンドラ
- `api/leaderboard.js` — `GET /api/leaderboard` ハンドラ
- `checker.js` — クライアント側の正誤判定（新規、`<script>`で読み込む）
- `index.html` / `style.css` / `script.js` — ログインUI・得点表示・ランキング表示・正誤判定との連携を追加
- `.claude/launch.json` — ローカルプレビューを `vercel dev` に切り替え（APIも一緒に動かすため）
- `test/nickname.test.js`, `test/store.test.js` — Node標準テストランナーのテスト

---

### Task 1: プロジェクト基盤（Node化・ニックネーム検証・ローカル開発をvercel devに切替）

**Files:**
- Create: `package.json`
- Create: `api/_lib/nickname.js`
- Test: `test/nickname.test.js`
- Modify: `.claude/launch.json`

**Interfaces:**
- Produces: `normalizeNickname(raw: string): string | null` — 前後の空白を除去し、結果が空文字なら `null`、20文字を超えるなら `null`、それ以外はトリム済みの文字列を返す（Task 2, 3, 5, 6が使う）

- [ ] **Step 1: 失敗するテストを書く（`test/nickname.test.js`）**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeNickname } = require("../api/_lib/nickname");

test("前後の空白を除去する", () => {
  assert.equal(normalizeNickname("  Taro  "), "Taro");
});

test("空文字・空白のみはnullを返す", () => {
  assert.equal(normalizeNickname(""), null);
  assert.equal(normalizeNickname("   "), null);
});

test("20文字ちょうどはそのまま通す", () => {
  const name20 = "a".repeat(20);
  assert.equal(normalizeNickname(name20), name20);
});

test("21文字以上はnullを返す", () => {
  assert.equal(normalizeNickname("a".repeat(21)), null);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `node --test test/nickname.test.js`
Expected: FAIL（`api/_lib/nickname` が見つからない）

- [ ] **Step 3: `package.json` を作成する**

`name: "html-rensyu"`, `private: true`, `"scripts": { "test": "node --test test/" }`。依存関係はまだ無し（Task 2で追加する）。

- [ ] **Step 4: `normalizeNickname(raw: string): string | null` を `api/_lib/nickname.js` に実装する**

`module.exports = { normalizeNickname }` の形でエクスポートする。

- [ ] **Step 5: テストを実行して成功を確認する**

Run: `node --test test/nickname.test.js`
Expected: PASS（4件とも）

- [ ] **Step 6: `.claude/launch.json` のローカルプレビューを `vercel dev` に切り替える**

`configurations[0]` の `runtimeExecutable` / `runtimeArgs` を、`vercel dev` をポート8420で起動する内容に変更する（`name` は `html-rensyu` のまま）。これにより、以降のタスクで `/api/*` も含めてブラウザプレビューで確認できる。

- [ ] **Step 7: 切り替えたプレビューで既存サイトが壊れていないことを手動確認する**

ブラウザプレビューを起動し、トップページ（既存の問題一覧・実行・ハイライト表示）がこれまで通り動作することを確認する。

- [ ] **Step 8: コミット**

```bash
git add package.json api/_lib/nickname.js test/nickname.test.js .claude/launch.json
git commit -m "feat: add nickname validation and switch local preview to vercel dev"
```

---

### Task 2: 得点記録（recordCorrectAnswer）と `POST /api/score`

**Files:**
- Create: `api/_lib/redis.js`
- Create: `api/_lib/store.js`
- Create: `api/score.js`
- Test: `test/store.test.js`

**Interfaces:**
- Consumes: `normalizeNickname` (Task 1, `api/_lib/nickname.js`)
- Produces (Task 3, 6が使う):
  - `api/_lib/redis.js`: `createRedisClient(): RedisLike`
    - `RedisLike = { sadd(key, member): Promise<number>, scard(key): Promise<number>, smembers(key): Promise<string[]>, zaddScore(key, score, member): Promise<void>, zrangeDesc(key): Promise<Array<{member: string, score: number}>>, hsetUpdatedAt(key, timestampMs): Promise<void> }`
    - `sadd` は新規追加されたら1、既存なら0を返す（Redisの`SADD`の戻り値をそのまま使う）
    - `smembers` はキー内の全メンバー（文字列配列）を返す（Task 3の`getUserInfo`が使う。Task 2では未使用だが、ここで一緒に定義する）
    - `zrangeDesc` はキー内の全メンバーをスコア降順で返す（同点の順序はRedis任せでよい。タイブレークは呼び出し側（store.js）で行う）
  - `api/_lib/store.js`:
    - `LEADERBOARD_KEY = "leaderboard"`
    - `userSolvedKey(nickname: string): string` → `` `user:${nickname}:solved` ``
    - `userMetaKey(nickname: string): string` → `` `user:${nickname}:meta` ``
    - `async recordCorrectAnswer(client: RedisLike, nickname: string, problemId: string): Promise<{ score: number, newlyCorrect: boolean }>`

- [ ] **Step 1: 失敗するテストを書く（`test/store.test.js`）— `recordCorrectAnswer`**

偽の `RedisLike` をメモリ上の `Map`/`Set` で実装してテストする。

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { recordCorrectAnswer, userSolvedKey } = require("../api/_lib/store");

function createFakeClient() {
  const sets = new Map();
  const sorted = new Map();
  return {
    async sadd(key, member) {
      const s = sets.get(key) ?? new Set();
      const added = s.has(member) ? 0 : 1;
      s.add(member);
      sets.set(key, s);
      return added;
    },
    async scard(key) {
      return (sets.get(key) ?? new Set()).size;
    },
    async smembers(key) {
      return [...(sets.get(key) ?? new Set())];
    },
    async zaddScore(key, score, member) {
      const m = sorted.get(key) ?? new Map();
      m.set(member, score);
      sorted.set(key, m);
    },
    async zrangeDesc(key) {
      const m = sorted.get(key) ?? new Map();
      return [...m.entries()]
        .map(([member, score]) => ({ member, score }))
        .sort((a, b) => b.score - a.score);
    },
    async hsetUpdatedAt() {},
    _sets: sets,
  };
}

test("初めて正解した問題は加点され newlyCorrect: true を返す", async () => {
  const client = createFakeClient();
  const result = await recordCorrectAnswer(client, "Taro", "h1-basic");
  assert.deepEqual(result, { score: 1, newlyCorrect: true });
});

test("同じ問題に2回正解しても得点は増えない（冪等性）", async () => {
  const client = createFakeClient();
  await recordCorrectAnswer(client, "Taro", "h1-basic");
  const second = await recordCorrectAnswer(client, "Taro", "h1-basic");
  assert.deepEqual(second, { score: 1, newlyCorrect: false });
});

test("異なる問題に正解すると得点が積み上がる", async () => {
  const client = createFakeClient();
  await recordCorrectAnswer(client, "Taro", "h1-basic");
  const result = await recordCorrectAnswer(client, "Taro", "p-basic");
  assert.deepEqual(result, { score: 2, newlyCorrect: true });
});

test("同じニックネームへの別問題の正解が互いの記録を消さない", async () => {
  const client = createFakeClient();
  await recordCorrectAnswer(client, "Taro", "h1-basic");
  await recordCorrectAnswer(client, "Taro", "p-basic");
  const solved = client._sets.get(userSolvedKey("Taro"));
  assert.deepEqual([...solved].sort(), ["h1-basic", "p-basic"]);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `node --test test/store.test.js`
Expected: FAIL（`api/_lib/store` が見つからない）

- [ ] **Step 3: `npm install @upstash/redis` を実行し、`package.json`/`package-lock.json` に反映する**

- [ ] **Step 4: `createRedisClient(): RedisLike` を `api/_lib/redis.js` に実装する**

`process.env.KV_REST_API_URL` / `process.env.KV_REST_API_TOKEN` から `@upstash/redis` の `Redis` インスタンスを作り、上記の `RedisLike` の5メソッドを持つオブジェクトを返す（`@upstash/redis` の現行APIに合わせて実装する。例: `sadd`→`redis.sadd(key, member)`、`scard`→`redis.scard(key)`、`smembers`→`redis.smembers(key)`、`zaddScore`→`redis.zadd(key, { score, member })`、`zrangeDesc`→`redis.zrange(key, 0, -1, { withScores: true, rev: true })` の結果を `{member, score}` の配列に整形、`hsetUpdatedAt`→`redis.hset(key, { updatedAt: timestampMs })`）。

- [ ] **Step 5: `recordCorrectAnswer` と鍵ヘルパーを `api/_lib/store.js` に実装する**

`sadd` の戻り値が1なら新規正解（`newlyCorrect: true`）。新規・既存どちらでも `scard` で現在の得点を求め、`zaddScore(LEADERBOARD_KEY, score, nickname)` と `hsetUpdatedAt(userMetaKey(nickname), Date.now())` を呼んでから `{ score, newlyCorrect }` を返す。

- [ ] **Step 6: テストを実行して成功を確認する**

Run: `node --test test/store.test.js`
Expected: PASS（4件とも）

- [ ] **Step 7: `POST /api/score` ハンドラを `api/score.js` に実装する**

リクエストボディ `{ nickname, problemId }` を読み、`normalizeNickname` で検証（無効なら400）。`problemId` は空文字でなく100文字以内の文字列であることだけ確認する（既知の問題IDリストとの照合はしない。無効なら400）。`createRedisClient()` と `recordCorrectAnswer` を使って結果を計算し、`{ score, newlyCorrect }` をJSONで返す（200）。`POST`以外のメソッドは405を返す。

- [ ] **Step 8: コミット**

```bash
git add package.json package-lock.json api/_lib/redis.js api/_lib/store.js api/score.js test/store.test.js
git commit -m "feat: record correct answers and add POST /api/score"
```

---

### Task 3: 得点照会（getUserInfo）とランキング（getLeaderboard）+ `GET /api/me` / `GET /api/leaderboard`

**Files:**
- Modify: `api/_lib/store.js`
- Create: `api/me.js`
- Create: `api/leaderboard.js`
- Test: `test/store.test.js`

**Interfaces:**
- Consumes: `RedisLike`、`userSolvedKey`、`LEADERBOARD_KEY`（Task 2, `api/_lib/store.js` / `api/_lib/redis.js`）
- Produces（Task 6が使う）:
  - `async getUserInfo(client: RedisLike, nickname: string): Promise<{ nickname: string, score: number, solvedProblems: string[] }>`
  - `async getLeaderboard(client: RedisLike): Promise<Array<{ nickname: string, score: number }>>` — スコア降順、同点はニックネームの昇順（アルファベット順）でタイブレーク

- [ ] **Step 1: 失敗するテストを書く（`test/store.test.js` に追記）**

```js
const { getUserInfo, getLeaderboard, recordCorrectAnswer } = require("../api/_lib/store");

test("得点のないユーザーは score:0, solvedProblems:[] を返す", async () => {
  const client = createFakeClient();
  const info = await getUserInfo(client, "Hanako");
  assert.deepEqual(info, { nickname: "Hanako", score: 0, solvedProblems: [] });
});

test("正解済みの問題がsolvedProblemsに含まれる", async () => {
  const client = createFakeClient();
  await recordCorrectAnswer(client, "Hanako", "h1-basic");
  await recordCorrectAnswer(client, "Hanako", "p-basic");
  const info = await getUserInfo(client, "Hanako");
  assert.equal(info.score, 2);
  assert.deepEqual([...info.solvedProblems].sort(), ["h1-basic", "p-basic"]);
});

test("誰も得点を持たない場合、ランキングは空配列", async () => {
  const client = createFakeClient();
  assert.deepEqual(await getLeaderboard(client), []);
});

test("スコア降順、同点はニックネーム昇順で並ぶ", async () => {
  const client = createFakeClient();
  await recordCorrectAnswer(client, "Bob", "h1-basic");
  await recordCorrectAnswer(client, "Alice", "h1-basic");
  await recordCorrectAnswer(client, "Alice", "p-basic");
  const board = await getLeaderboard(client);
  assert.deepEqual(board, [
    { nickname: "Alice", score: 2 },
    { nickname: "Bob", score: 1 },
  ]);
});

test("同点はニックネームのアルファベット順でタイブレークする", async () => {
  const client = createFakeClient();
  await recordCorrectAnswer(client, "Bob", "h1-basic");
  await recordCorrectAnswer(client, "Alice", "h1-basic");
  const board = await getLeaderboard(client);
  assert.deepEqual(board, [
    { nickname: "Alice", score: 1 },
    { nickname: "Bob", score: 1 },
  ]);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `node --test test/store.test.js`
Expected: FAIL（`getUserInfo`/`getLeaderboard` が未定義）

- [ ] **Step 3: `getUserInfo` を実装する**

`client.smembers(userSolvedKey(nickname))`（Task 2で定義済み）で解いた問題一覧を取得し、`score`はその配列の長さとする。

- [ ] **Step 4: `getLeaderboard` を実装する**

`client.zrangeDesc(LEADERBOARD_KEY)` の結果を `{ nickname: member, score }` に変換し、`score`降順・同点は`nickname`昇順でJS側ソートしてから返す（Redis任せにしない）。

- [ ] **Step 5: テストを実行して成功を確認する**

Run: `node --test test/store.test.js`
Expected: PASS（9件とも）

- [ ] **Step 6: `GET /api/me` ハンドラを `api/me.js` に実装する**

クエリパラメータ `nickname` を `normalizeNickname` で検証（無効なら400）。`createRedisClient()` と `getUserInfo` を使って結果をJSONで返す。`GET`以外は405。

- [ ] **Step 7: `GET /api/leaderboard` ハンドラを `api/leaderboard.js` に実装する**

パラメータなし。`createRedisClient()` と `getLeaderboard` の結果をJSON配列で返す。`GET`以外は405。

- [ ] **Step 8: コミット**

```bash
git add api/_lib/redis.js api/_lib/store.js api/me.js api/leaderboard.js test/store.test.js
git commit -m "feat: add user info and leaderboard queries, GET /api/me and /api/leaderboard"
```

---

### Task 4: クライアント側 正誤判定（`checker.js`）

**Files:**
- Create: `checker.js`
- Modify: `index.html`（`<script src="checker.js">` を `highlight.js` の後・`script.js` の前に追加）

**Interfaces:**
- Produces: `function checkAnswer(problemId: string, code: string): boolean`（グローバル関数。`highlight.js`の`highlightHtml`と同様、`<script>`で読み込まれるブラウザ用コード）

このタスクはNodeの`DOMParser`が無いため自動テストは書かない。ブラウザの開発者コンソールで直接 `checkAnswer(...)` を呼んで手動確認する。

**判定ルール（`code`を`new DOMParser().parseFromString(code, "text/html")`で解析し、以下を満たすか判定する）:**

- `h1-basic`: `<h1>`要素のいずれかの`textContent.trim()`が`"こんにちは"`と一致する
- `h-levels`: `<h1>`のいずれかが`"サイトタイトル"`、`<h2>`のいずれかが`"セクション見出し"`、`<h3>`のいずれかが`"小見出し"`と一致する（すべて満たす）
- `h-all`: `<h1>`〜`<h6>`それぞれについて、いずれかの要素が`"見出し1"`〜`"見出し6"`（対応する番号）と一致する（すべて満たす）
- `p-basic`: `<p>`要素のいずれかで`textContent.trim()`が空文字でない
- `p-multiple`: `textContent.trim()`が空文字でない`<p>`要素が2つ以上ある
- `br-basic`: `<br>`を子孫に持つ`<p>`要素が存在し、その`<p>`の子ノードを`<br>`で区切ったとき、トリムして空文字でないテキスト区間が2つ以上ある
- `a-basic`: `<a>`要素のいずれかで`href`属性が空文字でなく、かつ`textContent.trim()`も空文字でない
- `img-basic`: `<img>`要素のいずれかで`src`属性と`alt`属性がどちらも空文字でない
- `a-img-combo`: `<a>`要素のいずれかが、`href`属性が空文字でなく、かつその子孫に`src`属性が空文字でない`<img>`要素を持つ
- `table-basic`: `<table>`要素のいずれかが、2つ以上の`<td>`を持つ`<tr>`を1つ以上持つ
- `table-multi-row`: `<table>`要素のいずれかが、2つ以上の`<td>`を持つ`<tr>`を2つ以上持つ

- [ ] **Step 1: `checkAnswer(problemId, code)` を `checker.js` に実装する**

問題IDごとの判定関数を1つのオブジーェクト（例: `const VALIDATORS = { "h1-basic": (doc) => ..., ... }`）にまとめ、`checkAnswer`は`VALIDATORS[problemId]`が無ければ`false`を返し、あれば`new DOMParser().parseFromString(code, "text/html")`の結果を渡して呼び出す。

- [ ] **Step 2: `index.html` に `<script src="checker.js"></script>` を追加する**

`highlight.js`の次、`script.js`の前に置く。

- [ ] **Step 3: ブラウザのプレビューで手動確認する**

ブラウザの開発者コンソールで次を確認する:
- `checkAnswer("h1-basic", "<h1>こんにちは</h1>")` → `true`
- `checkAnswer("h1-basic", "<h1>こんばんは</h1>")` → `false`
- `checkAnswer("br-basic", "<p>1行目<br>2行目</p>")` → `true`
- `checkAnswer("br-basic", "<p>1行目だけ</p>")` → `false`
- `checkAnswer("img-basic", '<img src="x.jpg" alt="説明">')` → `true`
- `checkAnswer("img-basic", "<img>")` → `false`

- [ ] **Step 4: コミット**

```bash
git add checker.js index.html
git commit -m "feat: add client-side answer checking"
```

---

### Task 5: ログインUI（ニックネーム入力・保存・ヘッダー表示）

**Files:**
- Modify: `index.html`（ログインフォーム・ログイン中表示・ログアウトボタンのマークアップを追加）
- Modify: `style.css`（上記の見た目）
- Modify: `script.js`（ニックネームの保存・取得・表示切り替え）

**Interfaces:**
- Produces（Task 6が使う）:
  - `getSavedNickname(): string | null` — `localStorage`キー`"html-rensyu:nickname"`から読む
  - `saveNickname(name: string): void` — 同キーに保存する
  - `clearNickname(): void` — 同キーを削除する
  - DOM要素: `#login-form`（ニックネーム入力欄`#nickname-input`と送信ボタンを含む）、`#login-error`（エラーメッセージ表示）、`#current-user`（ログイン中の表示エリア。ニックネーム表示用の子要素と`#logout-btn`を含む）

- [ ] **Step 1: `index.html` にログインフォームとログイン中表示のマークアップを追加する**

ヘッダー内に、`#login-form`（未ログイン時に表示: ニックネーム入力`#nickname-input` + 送信ボタン + `#login-error`）と `#current-user`（ログイン時に表示: ニックネームを表示する要素 + `#logout-btn`）を両方置き、どちらか一方だけをJSで表示する。

- [ ] **Step 2: `style.css` に見た目を追加する**

既存の`.btn`等のトーンに合わせる。

- [ ] **Step 3: `script.js` に `getSavedNickname` / `saveNickname` / `clearNickname` を実装する**

既存の`storageKey`関数と同様に`try/catch`で`localStorage`アクセスを保護する（プライベートモード等での例外を無視する）。

- [ ] **Step 4: ログインフォームの送信・ログアウトボタンの動作を実装する**

送信時: 入力値を`normalizeNickname`と同じルール（前後空白除去・空文字/21文字以上は拒否）でクライアント側チェックし、無効なら`#login-error`にメッセージを表示して何もしない。有効なら`saveNickname`し、`#login-form`を隠して`#current-user`にニックネームを**`textContent`で**表示する（`innerHTML`は使わない。XSS対策）。ログアウトボタン: `clearNickname`して表示を`#login-form`に戻す。ページ読み込み時、`getSavedNickname()`があれば最初から`#current-user`表示にする。

- [ ] **Step 5: ブラウザのプレビューで手動確認する**

- 有効なニックネーム（例: `Taro`）を入力→ヘッダーに表示され、ページを再読み込みしても表示が保持される
- 空文字・21文字以上の入力→エラーメッセージが出て保存されない
- ニックネームに`<b>test</b>`を入力して送信→画面上は`<b>test</b>`という文字そのまま表示され、太字にならない（`textContent`が効いていることの確認）
- ログアウトボタンを押すと入力フォームに戻る

- [ ] **Step 6: コミット**

```bash
git add index.html style.css script.js
git commit -m "feat: add nickname login UI"
```

---

### Task 6: 実行時の正誤判定連携・得点同期・ランキング表示

**Files:**
- Modify: `script.js`
- Modify: `index.html`（得点表示・ランキング表示エリアのマークアップを追加）
- Modify: `style.css`

**Interfaces:**
- Consumes: `checkAnswer`（Task 4, `checker.js`）、`getSavedNickname`（Task 5, `script.js`）、`POST /api/score` / `GET /api/me` / `GET /api/leaderboard`（Task 2, 3）
- Produces: DOM要素 `#current-score`（現在の得点表示）、`#leaderboard-list`（ランキング表示）、サイドバーの各問題ボタンに正解済みを示すCSSクラス（例: `.problem-item.solved`）

- [ ] **Step 1: `index.html` に得点表示とランキング表示のマークアップを追加する**

`#current-user`の中に`#current-score`を追加。別セクションに`#leaderboard-list`（`<ul>`等）を追加。

- [ ] **Step 2: `fetch`ラッパー関数を`script.js`に実装する**

- `async function postScore(nickname, problemId)` — `POST /api/score`を呼び、`{score, newlyCorrect}`を返す
- `async function fetchMe(nickname)` — `GET /api/me?nickname=...`を呼び、`{nickname, score, solvedProblems}`を返す
- `async function fetchLeaderboard()` — `GET /api/leaderboard`を呼び、配列を返す

いずれも通信エラー時は`null`を返す（UIはエラー時、その部分の表示を更新しないだけにする。オフライン時に練習自体ができなくなることを避ける）。

- [ ] **Step 3: 実行ボタン押下時の正誤判定とスコア送信を既存の`runPreview`に組み込む**

`runPreview`実行後、ログイン中（`getSavedNickname()`が非null）かつ`checkAnswer(currentProblem.id, codeInput.value)`が`true`のとき、`postScore`を呼び、戻り値の`score`で`#current-score`を更新し、その問題のサイドバー項目に`.solved`クラスを付ける。

- [ ] **Step 4: ログイン時・ページ読み込み時に`fetchMe`で解答状況を反映する**

ニックネーム表示を行うタイミング（ログイン成功時・ページ読み込み時に保存済みニックネームがある場合）で`fetchMe`を呼び、結果の`score`を`#current-score`に、`solvedProblems`に含まれる問題のサイドバー項目に`.solved`クラスを付ける。

- [ ] **Step 5: ランキング表示を実装する**

ページ読み込み時に`fetchLeaderboard()`を呼び、`#leaderboard-list`の中身を空にしてから、各要素について`<li>`を作り、ニックネームは`document.createTextNode`または`textContent`で設定して追加する（`innerHTML`は使わない）。

- [ ] **Step 6: `style.css`に`.solved`マーカーとランキングリストの見た目を追加する**

- [ ] **Step 7: ブラウザのプレビュー（`vercel dev`）で手動確認する**

- ニックネーム`Taro`でログインし、`h1-basic`に正解するコードを実行→得点が1になり、サイドバーのその項目に正解マークが付く
- ページを再読み込み→得点と正解マークが保持される（`/api/me`から復元されている）
- 同じ問題をもう一度実行（正解のまま）→得点は1のまま増えない
- ログアウトして別のニックネーム`Hanako`でログインし、別の問題に正解→ランキングに`Taro`と`Hanako`の両方が正しい得点で表示される

- [ ] **Step 8: コミット**

```bash
git add index.html style.css script.js
git commit -m "feat: wire answer checking into score sync and leaderboard display"
```

---

### Task 7: 統合確認（自動テスト・ローカル統合・プレビューデプロイ）

**Files:** なし（新規コードは書かない。確認のみ）

**Interfaces:** なし

- [ ] **Step 1: 自動テストを全て実行する**

Run: `npm test`
Expected: PASS（Task 1〜3のテストが全て通る）

- [ ] **Step 2: `vercel dev` で全体を通しで手動確認する**

Task 6のStep 7のシナリオに加えて、既存機能（タグの色分け表示、解答を見るボタン、保存ボタン、存在しないタグ`<h7>`等が色付けされないこと）が壊れていないことを確認する。

- [ ] **Step 3: プレビューデプロイで確認する**

Run: `npx vercel deploy`（`--prod`は付けない。プレビューURLを発行する）
Expected: デプロイ成功し、発行されたプレビューURLでStep 2と同じシナリオが動作する（Upstash for Redisへの接続も含め、本番相当の環境で動くことを確認する）

- [ ] **Step 4: 人間のレビュー依頼**

ここまでの内容を依頼者に伝え、本番（`vercel deploy --prod`）への反映と`dev`ブランチのマージ方法を確認する（コードのコミット自体はTask 1〜6で完了している）。
