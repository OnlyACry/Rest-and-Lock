# Rest & Lock (定时休息锁定)

这是一个简单的 Chrome / Chromium 扩展，用来在设定的工作时长后强制休息一定时间。休息开始时，扩展会把所有标签页跳转到扩展内的锁定页面；休息结束后尝试恢复每个标签之前的 URL（best-effort）。

主要文件：
- `manifest.json` - 扩展清单（MV3）
- `background.js` - 后台 service worker，负责定时与锁定逻辑
- `popup.html` / `popup.js` - 工具栏弹出窗口，快速设置与启停
- `options.html` / `options.js` - 扩展选项页面
- `locked.html` / `locked.js` - 锁定页面（倒计时）

使用方法（开发者加载）：
1. 在 Chrome/Edge 地址栏打开 chrome://extensions/ （或 edge://extensions/）
2. 打开右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择本仓库所在目录（包含 manifest.json 的文件夹）。
4. 点击扩展图标打开弹出面板进行设置，或打开扩展选项页精细设置。

注意与限制：
- 扩展不能阻止用户卸载扩展或强制禁用扩展。
- 恢复标签页为 best-effort：如果用户在休息期间关闭或导航了标签页，可能无法精确恢复。
- 有些浏览器快捷键或窗口级别操作无法被网页完全拦截。

