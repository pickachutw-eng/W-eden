# W-EDEN

W-EDEN 活動網站以 GitHub Pages 提供前端，並以 LINE Login、LIFF、Firebase Authentication、Cloud Functions 與 Realtime Database 管理賓客身分。

## 登入與配號流程

1. 使用者在 LINE 或外部瀏覽器開啟 LIFF 網址。
2. 前端把 LINE ID Token 傳給 `lineLogin` Cloud Function 驗證。
3. 後端簽發 Firebase Custom Token。
4. 使用者填寫識別名稱、動物形態、Instagram 與能量光譜。
5. `saveIdentity` 以 Realtime Database transaction 配發 `WEDEN-260814001` 起的流水號。
6. 同一 LINE 帳號日後登入會取回原身分；流水號不重複、不回收。

## 首次部署設定

### 1. LINE Developers

1. 建立 LINE Login Channel。
2. 建立 LIFF App，Endpoint URL 設為 GitHub Pages 正式網址。
3. Scope 至少勾選 `openid` 與 `profile`。
4. 本專案的 LIFF ID 已寫入 [`app-config.js`](./app-config.js)：`2010878499-ibrTU601`。

LIFF ID 與 Channel ID 可以公開；Channel Secret 不可寫進倉庫。本實作驗證 ID Token 不需要 Channel Secret。

### 2. Firebase

Firebase 專案固定為 `w-eden`。Cloud Functions 需要 Blaze 方案與已啟用的 Firebase Authentication。

```bash
cd functions
npm install
cd ..
npm install -g firebase-tools
firebase login
firebase use w-eden
firebase deploy --only functions,database
```

LINE Login Channel ID `2010878499` 已設為 Functions 參數的非機密預設值，部署時不需再次輸入。Channel Secret 未使用，也不得提交到 GitHub。

### 3. 註冊控制

後端首次配號會在 Realtime Database 建立：

```text
identityRegistry/config/registrationOpen = true
```

管理者可在 Firebase Console 將 `registrationOpen` 設為 `false`，停止建立新身分；既有使用者仍可登入。註冊人數不設上限，流水號會依建立順序持續遞增。

## 本機檢查

```bash
cd functions
npm test
```
