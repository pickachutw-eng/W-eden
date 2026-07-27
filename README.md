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
4. 將 LIFF ID 寫入 [`app-config.js`](./app-config.js) 的 `liffId`。

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

第一次部署時，Firebase CLI 會要求提供 `LINE_CHANNEL_ID`；請填入 LINE Login Channel 的 Channel ID。此參數保存在 Firebase 環境，不會提交到 GitHub。

### 3. 註冊控制

後端首次配號會在 Realtime Database 建立：

```text
identityRegistry/config/registrationOpen = true
identityRegistry/config/maxGuests = 45
```

管理者可在 Firebase Console 修改這兩個值：

- `registrationOpen = false`：停止建立新身分，既有使用者仍可登入。
- `maxGuests`：流水號上限；預設 45。

## 本機檢查

```bash
cd functions
npm test
```
