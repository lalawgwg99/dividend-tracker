# 股息記錄器 Pro (Dividend Tracker)

台灣存股族導向的配息追蹤工具，主打「真的會每天打開看」的功能：

- 股數 + 買入成本 + 殖利率自動計算（`>5%` 綠色提示）
- 二代健保補充保費提醒（單筆配息 `> 20,000`，自動試算 `2.11%`）
- 年度彙總對比（今年 vs 去年）
- 持股回本進度（累積配息 / 累積投入）
- 配息預告行事曆（iCal / Google Calendar CSV 匯出）
- 雲端備份流程（JSON 匯出/還原 + 手機分享到 Google Drive / iCloud）
- PWA 離線支援（Service Worker + Manifest）

## 專案架構

```text
.
├─ index.html               # UI 結構
├─ manifest.webmanifest     # PWA 設定
├─ sw.js                    # 離線快取
├─ icon.svg                 # App icon
├─ src/
│  ├─ main.js               # 事件綁定、畫面渲染、匯入匯出流程
│  ├─ calculations.js       # 殖利率/保費等核心計算
│  ├─ storage.js            # localStorage 讀寫與遷移
│  ├─ charts.js             # Chart.js 初始化
│  ├─ utils.js              # 日期/金額/CSV/iCal 工具
│  ├─ config.js             # 常數設定
│  └─ styles.css            # 視覺樣式
├─ stock-cost-calculator.js # 既有 CLI 計算器（保留）
└─ stock-cost-calculator.test.js
```

## 本機啟動（建議）

> PWA / Service Worker 需要在 `http://` 或 `https://` 下執行，不能直接雙擊 `index.html`。

### 方式 1：Python

```bash
python3 -m http.server 5173
```

開啟：<http://localhost:5173>

### 方式 2：Node（若你有 npx）

```bash
npx serve .
```

## 主要資料欄位

### 配息紀錄

- `stockName`
- `divDate`
- `divAmount`
- `shares`
- `buyCost`
- `yieldPct`（自動）
- `premium`（自動，> 20,000 才計算）
- `netAmount`（自動）

### 預告紀錄

- `stockName`
- `payDate`
- `amount`
- `notes`

## 備份與還原

1. 點選「匯出備份 JSON」下載完整資料
2. 上傳到 Google Drive 或 iCloud Drive
3. 新裝置點「還原備份 JSON」即可復原

## 既有 CLI 測試（保留）

```bash
node stock-cost-calculator.test.js
```

## License

MIT
