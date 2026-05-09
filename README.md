# 网络备忘录系统 (Memo System)

一个功能完善的 Web 备忘录管理应用，支持富文本编辑、Markdown、PDF导入导出、表格编辑等功能。

## 功能特性

- ✨ 富文本 + Markdown 双模式编辑器
- 📊 表格编辑功能
- 📄 PDF 导入导出
- 🔐 首个用户自动成为管理员
- 🏷️ 标签管理与分类
- 🔍 全文搜索
- 🌙 暗色模式
- 📱 响应式设计

## 快速部署

```bash
# 克隆代码
git clone https://github.com/huqinlon/memoo.git
cd memoo

# 配置环境变量
cp .env.example .env
# 编辑 .env 设置 JWT_SECRET

# 一键部署
./deploy-prod.sh
```

## 技术栈

- 前端：React + Vite + TailwindCSS + TipTap
- 后端：Express + SQLite (sql.js)
- 容器化：Docker

## 许可证

MIT
