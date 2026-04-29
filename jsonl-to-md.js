#!/usr/bin/env node
/**
 * JSONL 转 Markdown 工具
 * 用途：将 Cursor agent 会话记录 (JSONL) 转换为可读的 Markdown 格式
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

/**
 * 解析 JSONL 文件
 */
function parseJsonl(content) {
  const lines = content.trim().split('\n').filter(line => line.trim());
  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch (e) {
      console.error(`解析行失败: ${e.message}`);
      return null;
    }
  }).filter(Boolean);
}

/**
 * 提取消息内容
 */
function extractContent(message) {
  if (!message || !message.content) return '';

  const parts = [];
  for (const block of message.content) {
    if (block.type === 'text' && block.text) {
      // 清理内容
      let text = block.text;

      // 移除 <user_query> 等标签
      text = text.replace(/<\/?user_query>/g, '');
      text = text.replace(/<\/?system_context>/g, '');
      text = text.replace(/<\/?instruction>/g, '');

      // 移除 [REDACTED] 标记
      text = text.replace(/\[REDACTED\]/g, '**[内容已编辑]**');

      parts.push(text.trim());
    } else if (block.type === 'tool_use') {
      const toolName = block.name || 'UnknownTool';
      let inputStr = '';

      if (block.input) {
        try {
          inputStr = JSON.stringify(block.input, null, 2);
        } catch (e) {
          inputStr = String(block.input);
        }
      }

      parts.push(`\n<details>
<summary>🔧 工具调用: ${toolName}</summary>

\`\`\`json
${inputStr}
\`\`\`
</details>\n`);
    } else if (block.type === 'tool_result') {
      const content = block.content || '';
      const isTruncated = block.is_error || content.length > 5000;
      const displayContent = isTruncated && content.length > 5000
        ? content.slice(0, 5000) + '\n\n... (内容已截断)'
        : content;

      parts.push(`\n<details>
<summary>📤 工具结果</summary>

\`\`\`
${displayContent}
\`\`\`
</details>\n`);
    } else if (block.type === 'image') {
      parts.push(`\n![图片](${block.url || 'image'})\n`);
    }
  }

  return parts.join('\n');
}

/**
 * 将单条记录转换为 Markdown
 */
function convertToMarkdown(record, index) {
  const role = record.role || 'unknown';
  const timestamp = record.timestamp ? new Date(record.timestamp).toLocaleString() : '';

  let roleIcon, roleName;
  switch (role) {
    case 'user':
      roleIcon = '👤';
      roleName = '用户';
      break;
    case 'assistant':
      roleIcon = '🤖';
      roleName = '助手';
      break;
    case 'system':
      roleIcon = '⚙️';
      roleName = '系统';
      break;
    default:
      roleIcon = '📝';
      roleName = role;
  }

  const content = extractContent(record.message);

  return `## ${roleIcon} ${roleName}${timestamp ? ` - ${timestamp}` : ''}

${content}
`;
}

/**
 * 转换单个文件
 */
function convertFile(inputPath, outputPath) {
  log(`📄 读取文件: ${inputPath}`, 'blue');

  const content = readFileSync(inputPath, 'utf-8');
  const records = parseJsonl(content);

  if (records.length === 0) {
    log(`⚠️  文件为空或无有效记录: ${inputPath}`, 'yellow');
    return false;
  }

  log(`   发现 ${records.length} 条记录`, 'green');

  // 生成 Markdown
  const mdParts = [`# Cursor Agent 会话记录\n`,
    `> 转换时间: ${new Date().toLocaleString()}\n`,
    `> 总消息数: ${records.length}\n`,
    `---\n`,
  ];

  records.forEach((record, index) => {
    mdParts.push(convertToMarkdown(record, index));
    mdParts.push('\n---\n\n');
  });

  const markdown = mdParts.join('');

  // 写入文件
  writeFileSync(outputPath, markdown, 'utf-8');
  log(`   ✅ 已保存: ${outputPath}`, 'green');

  return true;
}

/**
 * 递归处理目录
 */
function processDirectory(inputDir, outputDir) {
  if (!statSync(inputDir).isDirectory()) {
    // 单文件
    const baseName = basename(inputDir, '.jsonl');
    const outputPath = join(outputDir, `${baseName}.md`);
    return convertFile(inputDir, outputPath);
  }

  // 目录
  const files = readdirSync(inputDir);
  let count = 0;

  for (const file of files) {
    const fullPath = join(inputDir, file);

    if (statSync(fullPath).isDirectory()) {
      // 递归处理子目录
      const subOutputDir = join(outputDir, file);
      mkdirSync(subOutputDir, { recursive: true });
      processDirectory(fullPath, subOutputDir);
    } else if (file.endsWith('.jsonl')) {
      const baseName = file.replace('.jsonl', '');
      const outputPath = join(outputDir, `${baseName}.md`);
      if (convertFile(fullPath, outputPath)) count++;
    }
  }

  return count;
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
${colors.bright}JSONL → Markdown 转换工具${colors.reset}

${colors.green}用法:${colors.reset}
  node jsonl-to-md.js <输入文件或目录> [输出目录]

${colors.green}示例:${colors.reset}
  node jsonl-to-md.js ./transcript.jsonl
  node jsonl-to-md.js ./transcripts/ ./output/
  node jsonl-to-md.js ./transcripts/   # 输出到 transcripts 目录

${colors.green}说明:${colors.reset}
  - 输入为 .jsonl 文件时，输出同名的 .md 文件
  - 输入为目录时，递归处理所有 .jsonl 文件
  - 输出目录默认与输入文件相同位置
`);
    return;
  }

  const inputPath = args[0];
  const outputDir = args[1] || dirname(inputPath);

  // 检查输入是否存在
  try {
    statSync(inputPath);
  } catch (e) {
    log(`❌ 输入路径不存在: ${inputPath}`, 'red');
    process.exit(1);
  }

  // 确保输出目录存在
  mkdirSync(outputDir, { recursive: true });

  log(`\n${colors.bright}🚀 开始转换${colors.reset}\n`);
  log(`   输入: ${inputPath}`, 'blue');
  log(`   输出: ${outputDir}\n`, 'blue');

  const startTime = Date.now();

  if (statSync(inputPath).isDirectory()) {
    processDirectory(inputPath, outputDir);
  } else {
    const baseName = basename(inputPath, '.jsonl');
    const outputPath = join(outputDir, `${baseName}.md`);
    convertFile(inputPath, outputPath);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  log(`\n${colors.green}✨ 完成! 耗时 ${duration}s${colors.reset}\n`);
}

main().catch(console.error);
