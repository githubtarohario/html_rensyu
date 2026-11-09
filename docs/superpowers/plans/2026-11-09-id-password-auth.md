# ID・パスワード認証への変更 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 今のパスワードなしニックネームログインを、ID（=今のニックネーム）とパスワードによる本人確認に変更する。

**Architecture:** Node標準の`crypto.scrypt`でパスワードをハッシュ化して保存するユーティリティを追加し、`POST /api/login`で検証（未登録IDなら新規登録扱い）する。既存の得点記録・判定・リーダーボードAPIは変更しない。クライアント側はログインフォームにパスワード欄を追加し、送信時に`/api/login`を呼ぶ。

**Tech Stack:** Node.js (Vercel Serverless Functions), Node標準`crypto`モジュール（新規依存ライブラリなし）, Upstash for Redis (`@upstash/redis`), `node:test`

**Spec:** [docs/superpowers/specs/2026-11-09-id-password-auth-design.md](../specs/2026-11-09-id-password-auth-design.md)

## Global Constraints

- 新しい依存ライブラリは追加しない（パスワードハッシュ化はNode標準の`crypto.scrypt`を使う）
- パスワードは平文で保存・ログしない
- 既存の`POST /api/score`・`GET /api/me`・`GET /api/leaderboard`・既存のRedisキー設計（`user:{id}:solved`等）は変更しない
- ログイン失敗時、IDとパスワードのどちらが間違っているかを区別しないメッセージにする
- 既存の11問（problems.js）・highlight.js・正誤判定（checker.js）の構造は変更しない

## Review Focus

- 空文字パスワードでのログイン要求 → 400で拒否し、空パスワードでの新規登録を許可しない
- 極端に長いパスワード（例: 1000文字）→ 400で拒否し、scryptに巨大な入力を渡さない
- 登録済みIDに間違ったパスワード → 401、「IDまたはパスワードが違います」という、どちらが違うか区別しないメッセージ
- 想定外の形式で保存された`passwordHash`文字列の比較 → `verifyPassword`が例外を投げずfalseを返す
- `POST`以外のメソッドでの`/api/login`へのアクセス → 405（既存の`score.js`/`leaderboard.js`と同じ規約）

---

### Task 1: パスワードハッシュ化ユーティリティ

**Files:**
- Create: `api/_lib/password.js`
- Test: `test/password.test.js`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>` — ランダムな16byteソルトで`crypto.scrypt`ハッシュ化し、`"scrypt$<saltHex>$<hashHex>"`形式の文字列を返す
- Produces: `verifyPassword(plain: string, stored: string): Promise<boolean>` — `stored`を解析し、`plain`から同じソルトで計算したハッシュと比較する。`stored`が`null`・`undefined`・想定外の形式の場合は例外を投げず`false`を返す

- [ ] **Step 1: Write the failing tests**

```js
const { hashPassword, verifyPassword } = require("../api/_lib/password");

test("正しいパスワードで検証が成功する", async () => {
  const hash = await hashPassword("abc123");
  assert.equal(await verifyPassword("abc123", hash), true);
});

test("間違ったパスワードで検証が失敗する", async () => {
  const hash = await hashPassword("abc123");
  assert.equal(await verifyPassword("xyz999", hash), false);
});

test("同じパスワードでも毎回異なるハッシュになる（ソルトが異なる）", async () => {
  const hash1 = await hashPassword("abc123");
  const hash2 = await hashPassword("abc123");
  assert.notEqual(hash1, hash2);
});

test("stored が null/undefined/不正な形式なら例外を投げずfalseを返す", async () => {
  assert.equal(await verifyPassword("abc123", null), false);
  assert.equal(await verifyPassword("abc123", undefined), false);
  assert.equal(await verifyPassword("abc123", "not-a-valid-format"), false);
  assert.equal(await verifyPassword("abc123", "scrypt$onlyonepart"), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with "Cannot find module '../api/_lib/password'"

- [ ] **Step 3: Implement `hashPassword`/`verifyPassword` in `api/_lib/password.js`**

`crypto.scrypt`は`util.promisify`でPromise化する。ソルトは`crypto.randomBytes(16)`、鍵長は64byte固定とし、保存形式は`` `scrypt$${salt.toString("hex")}$${hash.toString("hex")}` ``。`verifyPassword`は`stored.split("$")`が3要素（先頭が`"scrypt"`）でなければ`false`を返し、ハッシュ比較は`crypto.timingSafeEqual`を使う（両辺とも固定64byteなので長さは一致する）。`hashPassword`/`verifyPassword`内で発生しうる例外（`stored`の16進デコード失敗など）は`verifyPassword`側でcatchして`false`に変換する。

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS（新規4件 + 既存の全テスト）

- [ ] **Step 5: Commit**

```bash
git add api/_lib/password.js test/password.test.js
git commit -m "feat: add scrypt-based password hashing utility"
```

---

### Task 2: パスワード保存用のRedis拡張と `POST /api/login`

**Files:**
- Modify: `api/_lib/redis.js` — クライアントに`get`/`set`（単純な文字列get/set）を追加
- Modify: `api/_lib/store.js` — `userPasswordKey`・`getPasswordHash`・`setPasswordHash`を追加
- Modify: `test/store.test.js` — `createFakeClient`に`get`/`set`のフェイクを追加し、新関数のテストを追加
- Create: `api/login.js`

**Interfaces:**
- Consumes: `hashPassword`/`verifyPassword` from Task 1 (`api/_lib/password.js`)
- Consumes: `normalizeNickname(raw: string): string|null` from `api/_lib/nickname.js`（既存、IDの検証にそのまま使う）
- Produces (redis.js): `client.get(key: string): Promise<string|null>`、`client.set(key: string, value: string): Promise<void>`
- Produces (store.js): `userPasswordKey(id: string): string`（`` `user:${id}:passwordHash` ``）、`getPasswordHash(client, id): Promise<string|null>`、`setPasswordHash(client, id, hash): Promise<void>`
- Produces (login.js): `POST /api/login`、body `{ id, password }`
  - 200 `{ id }` — 新規登録 または 既存IDでパスワード一致
  - 400 `{ error: "invalid id" }` — idが`normalizeNickname`でnullになる場合
  - 400 `{ error: "invalid password" }` — passwordが空文字・文字列以外・101文字以上の場合
  - 401 `{ error: "IDまたはパスワードが違います" }` — 既存IDでパスワード不一致
  - 405 — POST以外のメソッド

- [ ] **Step 1: Write the failing tests for store.js**

`test/store.test.js`の`createFakeClient`に以下を追加:

```js
async get(key) {
  return strings.get(key) ?? null;
},
async set(key, value) {
  strings.set(key, value);
},
```

（`strings`は`sets`/`sorted`と同様に`createFakeClient`内で`new Map()`として定義する）

```js
const { userPasswordKey, getPasswordHash, setPasswordHash } = require("../api/_lib/store");

test("パスワードハッシュが未設定のユーザーはnullを返す", async () => {
  const client = createFakeClient();
  assert.equal(await getPasswordHash(client, "Taro"), null);
});

test("setPasswordHashで保存した値がgetPasswordHashで取得できる", async () => {
  const client = createFakeClient();
  await setPasswordHash(client, "Taro", "scrypt$abcd$1234");
  assert.equal(await getPasswordHash(client, "Taro"), "scrypt$abcd$1234");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL（`getPasswordHash`等が存在しない）

- [ ] **Step 3: Implement `get`/`set` in `api/_lib/redis.js`, and `userPasswordKey`/`getPasswordHash`/`setPasswordHash` in `api/_lib/store.js`**

`redis.js`の`get`/`set`は`@upstash/redis`の`redis.get(key)`/`redis.set(key, value)`をそのまま呼ぶ薄いラッパーにする（既存の`sadd`等と同じスタイル）。`store.js`の3関数は`userSolvedKey`/`userMetaKey`と同じ書き方に揃える。

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/_lib/redis.js api/_lib/store.js test/store.test.js
git commit -m "feat: add password hash storage to redis client and store"
```

- [ ] **Step 6: Implement `api/login.js`**

`api/score.js`と同じ構造（メソッドチェック→入力検証→Redis呼び出し→レスポンス）に揃える。

```js
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const body = req.body ?? {};
  const id = normalizeNickname(body.id);
  const password = body.password;

  if (id === null) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  if (typeof password !== "string" || password.length === 0 || password.length > 100) {
    res.status(400).json({ error: "invalid password" });
    return;
  }

  const client = createRedisClient();
  const existingHash = await getPasswordHash(client, id);

  if (existingHash === null) {
    await setPasswordHash(client, id, await hashPassword(password));
    res.status(200).json({ id });
    return;
  }

  if (await verifyPassword(password, existingHash)) {
    res.status(200).json({ id });
    return;
  }

  res.status(401).json({ error: "IDまたはパスワードが違います" });
};
```

パスワードの長さ上限（101文字以上を拒否、つまり100文字まで許可）はTask 1で固定した鍵長とは無関係の入力検証で、`api/score.js`の`PROBLEM_ID_MAX_LENGTH`と同じ考え方（妥当な上限を決めるだけ）。

- [ ] **Step 7: Manually verify via a local Node script (no local dev server available — see note)**

`vercel dev`はこの環境では動作しないため、Task 6と同様に一時的なNodeスクリプト、または本番/プレビューへのデプロイ後に`vercel curl`で以下を確認する:
- 未登録IDで初回ログイン → 200、以後同じIDに別パスワードでログインすると401になる
- 登録済みIDに正しいパスワード → 200
- 登録済みIDに間違ったパスワード → 401、「IDまたはパスワードが違います」（IDとパスワードのどちらが違うか区別しないメッセージになっていること）
- 空文字パスワード → 400
- 極端に長いパスワード（101文字以上）→ 400
- `GET /api/login` → 405

- [ ] **Step 8: Commit**

```bash
git add api/login.js
git commit -m "feat: add POST /api/login endpoint"
```

---

### Task 3: ログインUIをID・パスワード対応に変更

**Files:**
- Modify: `index.html` — ログインフォームにパスワード入力欄を追加（`script.js:16-18`付近が参照するDOM構造）
- Modify: `script.js` — ログインフォームの送信処理（`script.js:340-349`）を`/api/login`呼び出しに変更

**Interfaces:**
- Consumes: `POST /api/login`（Task 2）のレスポンス形式（200 `{id}` / 400 `{error}` / 401 `{error}`）
- Consumes: 既存の`showLoggedInView(nickname)`・`showLoginError(message)`・`hideLoginError()`・`saveNickname(name)`（`script.js`内、変更なし）

このタスクではHTML要素の追加のみで、既存の`#login-form`・`#nickname-input`・`#login-error`・`#current-user`等のidは変更しない（Task 5のレビュー済みDOM構造を保つ）。

- [ ] **Step 1: `index.html` にパスワード入力欄を追加**

`<input type="text" id="nickname-input" ...>`の直後に以下を追加する:

```html
<input type="password" id="password-input" class="nickname-input" placeholder="パスワード">
```

- [ ] **Step 2: `script.js` にパスワード欄の参照を追加**

`script.js:17`付近、`nicknameInput`の定義の直後に追加:

```js
const passwordInput = document.getElementById("password-input");
```

- [ ] **Step 3: ログインフォームの送信処理を書き換える**

`script.js:340-349`の`loginForm.addEventListener("submit", ...)`を、`async`にして`/api/login`を呼ぶ形に変更する。おおまかな流れ:

1. `normalizeNickname(nicknameInput.value)`がnullなら`showLoginError("IDは1〜20文字で入力してください。")`で終了（既存の検証メッセージ文言は変更してよい）
2. `passwordInput.value`が空文字なら`showLoginError("パスワードを入力してください。")`で終了
3. `fetch("/api/login", { method: "POST", headers: {...}, body: JSON.stringify({ id: normalized, password: passwordInput.value }) })`を呼ぶ。通信エラー（`catch`）は`showLoginError("通信エラーが発生しました")`
4. レスポンスが401または400なら、本文の`error`をもとに`showLoginError(...)`で終了（401のメッセージはサーバーが返す文言をそのまま表示してよい）
5. 成功（200）なら、既存の`saveNickname(normalized)`→`showLoggedInView(normalized)`を呼ぶ（Task 2の`{id}`は`normalized`と同じ値なので、レスポンスの値を使わなくてよい）
6. 成功時は`passwordInput.value = ""`でパスワード欄をクリアする

- [ ] **Step 4: ログアウト時もパスワード欄をクリアする**

`script.js:351-354`の`logoutBtn`クリックハンドラに`passwordInput.value = "";`を追加する（既存の`showLoggedOutView()`内で`nicknameInput.value = ""`をしている箇所と同様の扱い。既存コードを確認し、同じ場所に揃える）。

- [ ] **Step 5: `npm test` で既存テストに影響がないことを確認**

Run: `npm test`
Expected: PASS（このタスクはDOM/UIのみの変更なので既存の全テストに影響しないはず）

- [ ] **Step 6: Commit**

```bash
git add index.html script.js
git commit -m "feat: require password on login, wire login form to POST /api/login"
```

- [ ] **Step 7: デプロイ後の手動確認（ブラウザ、プレビューデプロイ上で）**

Deployment Protectionがかかっている場合は人間が確認する。確認項目:
- 未登録IDとパスワードでログイン → ログイン成功、得点0から開始
- ログアウト→同じID・さっき登録したパスワードで再ログイン → 成功
- ログアウト→同じID・間違ったパスワードでログイン → エラー表示、ログインできない
- 空のID/空のパスワードで送信 → エラー表示（送信自体はできるが、サーバーに弾かれて失敗する）

**デプロイ前の運用作業（タスクではなくコントローラーが実行する）:** 本番Redisに残っているテストデータ（ID `"aaa"`、パスワード未設定）は新方式ではログインできないため、本番デプロイ前に削除する。
