# 🍈 榴莲成本核算器 / เครื่องคำนวณต้นทุนทุเรียน Durian Cost Calculator

一个单文件、免安装的榴莲进口成本核算网页：调整汇率、级别数据、泰国/中国费用，自动算出每个级别的出厂单件成本、出厂净果价和实际净果价，支持打印和导出 CSV。

A single-file, zero-install web tool for durian import cost calculation (THB → CNY). Supports printing and CSV export.

## 在线使用 / Online

启用 GitHub Pages 后访问：

```
https://<你的用户名>.github.io/<仓库名>/
```

## 功能 / Features

- 💱 汇率 THB → CNY，所有泰铢费用自动折算人民币
- 📦 多级别（AB / C / D …）件数、单件净重、收果价 → 出厂单件成本、净果价
- ⚖️ 国内实际净重 → 实际净果价
- 💰 泰国费用（按重量、按件数、失水 5%、手动）、中国费用（增值税 9% 自动计算）
- 📊 导出 CSV（Excel 可直接打开）、🖨️ 打印

## 本地打开

直接浏览器打开 `index.html` 即可，无需服务器。

## 部署到 GitHub Pages

1. 新建仓库（如 `durian-cost`），把本目录所有文件上传到仓库根目录。
2. 仓库 → Settings → Pages → Source 选 **Deploy from a branch**，分支 `main`，目录 `/ (root)` → Save。
3. 约 1 分钟后访问 `https://<用户名>.github.io/<仓库名>/`。

> 也可以把 `index.html` 复制到 `docs/` 目录，Pages 目录选 `/docs`。

## 说明

所有数据只保存在当前页面内存中，刷新即恢复默认，不上传任何服务器。
