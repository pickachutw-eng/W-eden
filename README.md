# W-EDEN

W-EDEN 活動網站以 GitHub Pages 提供前端，並以 LINE Login、LIFF、Firebase Authentication、Cloud Functions 與 Realtime Database 管理賓客身分。

## 登入與配號流程

1. 使用者在 LINE 或外部瀏覽器開啟 LIFF 網址。
2. 前端把 LINE ID Token 傳給 `lineLogin` Cloud Function 驗證。
3. 後端簽發 Firebase Custom Token。
4. 使用者填寫識別名稱、動物形態、Instagram 與能量光譜。
5. `saveIdentity` 以 Realtime Database transaction 配發 `WEDEN-260814001` 起的流水號。
6. 同一 LINE 帳號日後登入會取回原身分；流水號不重複、不回收。
7. 新身分與尚未選擇區域的既有身分，登入後預設進駐「伊甸花園」。

## 最佳服裝投票

- 投票期間固定為 2026/8/14 20:30–22:00（Asia/Taipei），22:00 截止後立即開票，由 Cloud Functions 的伺服器時間判定。
- 每個 W-EDEN 身分只有一張有效票，可改票、不可投自己。
- 原始票存於 `costumeVoting/votesByVoter`，Realtime Database 規則不允許前端直接讀寫。
- `getCostumeVotingState` 僅回傳本人目前選擇、已投總人數，以及前五名的公開身分與得票比例。
- `castCostumeVote` 驗證 Firebase 登入身分、候選人與投票時段，再覆寫投票者唯一的一筆票。
- 前五名以全部有效票為分母；同票顯示相同名次，截止後同一畫面鎖定為開票結果。

## 迷幻沼澤解鎖

- 迷幻沼澤固定於 2026/8/14 22:00（Asia/Taipei）解鎖，前端以 Firebase Realtime Database 的伺服器時間偏移判定，Database Rules 也會在解鎖前阻止進駐寫入。
- 解鎖前地圖按鈕顯示 `????`；點擊只會顯示掃描中說明，不能查看或進駐該區域。
- 解鎖後，已登入的使用者會收到一次開放通知；已讀狀態存於 `swampUnlockNotices/{guestId}`，跨裝置不重複顯示。
- 此功能不需部署 Cloud Functions；合併至 `main` 後，專用 GitHub Actions 工作流會自動部署 Database Rules。

## 登陸許可測驗

- 完成 LINE 登入與身分建立後，系統會從三題壽星趣味題中隨機抽出一題。
- 無論回答正確或錯誤，都會顯示趣味情報、統一通關密語與大廳接引方式。
- 完成狀態存於 `landingClearances/{guestId}`，只允許該 LINE 身分首次寫入與本人讀取；之後登入會直接顯示登陸許可。
- 前端測試可使用 `?previewClearance=quiz` 模擬答題，或使用 `?previewClearance=permit` 模擬已完成畫面，不會寫入資料庫。

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
