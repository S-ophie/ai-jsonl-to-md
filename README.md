# JSONL to Markdown Converter

将 Cursor Agent 会话记录 (JSONL) 转换为可读的 Markdown 格式。

## 功能特点

- **JSONL → Markdown** - 将 Cursor 会话记录转为可读格式
- **批量处理** - 支持目录递归批量转换
- **工具调用展示** - 可折叠展示工具调用，JSON 格式化
- **内容清理** - 移除 `<user_query>` 等标签和 `[REDACTED]` 标记
- **角色区分** - 👤 用户 / 🤖 助手 图标区分显示

## 安装

```bash
# 克隆项目
git clone <repository-url>
cd jsonl-to-md

# 或直接下载脚本
curl -O <script-url>/jsonl-to-md.js
chmod +x jsonl-to-md.js
```

## 使用方法

```bash
# 转换单个文件
node jsonl-to-md.js input.jsonl

# 指定输出目录
node jsonl-to-md.js input.jsonl ./output/

# 批量转换整个目录
node jsonl-to-md.js ./agent-transcripts/

# 输出到当前目录
node jsonl-to-md.js ./agent-transcripts/ .
```

## 输入格式

支持 Cursor Agent 导出的 JSONL 格式：

```jsonl
{"role":"user","message":{"content":[{"type":"text","text":"用户消息"}]}}
{"role":"assistant","message":{"content":[{"type":"text","text":"助手回复"},{"type":"tool_use","name":"ToolName","input":{}}]}}
```

## 输出示例

```markdown
# Cursor Agent 会话记录

> 转换时间: 2024/1/1 12:00:00
> 总消息数: 6
---

## 👤 用户

用户消息内容

---

## 🤖 助手

助手回复内容

<details>
<summary>🔧 工具调用: ToolName</summary>

```json
{...}
```
</details>
```

## 环境要求

- Node.js 18+
- 支持 ES Modules

## License

MIT
