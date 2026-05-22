/**
 * Markdown → 飞书消息格式转换器
 *
 * 将 Markdown 内容解析为段落数组，按类型分为：
 * - post: 富文本段落（飞书 post 消息）
 * - interactive: 表格（飞书互动卡片）
 */

// ─── 类型定义 ───────────────────────────────────────────

/** 飞书 post 富文本内容节点 */
interface PostNode {
  tag: 'text' | 'a' | 'at';
  text?: string;
  href?: string;
  user_id?: string;
  style?: string[];
}

/** 飞书 post 段落（一个 content 数组代表一行/一段） */
type PostLine = PostNode[];

/** 飞书 interactive 卡片的表格 */
interface CardTable {
  tag: 'table';
  columns: { name: string; width?: string }[];
  rows: string[][];
}

/** 解析后的段落 */
export type FeishuSegment =
  | { type: 'post'; title: string; lines: PostLine[] }
  | { type: 'interactive'; header: string; table: CardTable };

// ─── 常量 ───────────────────────────────────────────────

/** 飞书 post 单条消息最大字符数（保守估计） */
const POST_MAX_CHARS = 25000;

// ─── 导出函数 ───────────────────────────────────────────

/**
 * 将 Markdown 文本解析为飞书段落数组
 */
export function parseMarkdownToFeishu(markdown: string): FeishuSegment[] {
  const segments: FeishuSegment[] = [];
  const blocks = splitBlocks(markdown);

  let textBuffer: string[] = [];

  function flushTextBuffer() {
    if (textBuffer.length > 0) {
      const text = textBuffer.join('\n\n');
      textBuffer = [];
      const postSegment = textToPostSegment(text);
      if (postSegment) {
        segments.push(postSegment);
      }
    }
  }

  for (const block of blocks) {
    const tableResult = tryParseTable(block);
    if (tableResult) {
      flushTextBuffer();
      // 用最后一段文本作为表头
      const header = extractTableHeader(textBuffer.length > 0 ? segments : []);
      segments.push({
        type: 'interactive',
        header: header || '数据表格',
        table: tableResult,
      });
    } else {
      textBuffer.push(block);
    }
  }

  flushTextBuffer();
  return segments;
}

// ─── 块分割 ─────────────────────────────────────────────

function splitBlocks(markdown: string): string[] {
  // 按双换行分割为段落块
  const raw = markdown.split(/\n{2,}/);
  const blocks: string[] = [];
  let codeBuf: string[] = [];
  let inCode = false;

  for (const line of raw) {
    if (line.trimStart().startsWith('```')) {
      if (inCode) {
        codeBuf.push(line);
        blocks.push(codeBuf.join('\n'));
        codeBuf = [];
        inCode = false;
      } else {
        if (codeBuf.length > 0) {
          blocks.push(codeBuf.join('\n'));
          codeBuf = [];
        }
        codeBuf.push(line);
        inCode = true;
      }
    } else if (inCode) {
      codeBuf.push(line);
    } else {
      blocks.push(line);
    }
  }

  if (codeBuf.length > 0) {
    blocks.push(codeBuf.join('\n'));
  }

  return blocks.filter((b) => b.trim());
}

// ─── 表格解析 ───────────────────────────────────────────

function tryParseTable(block: string): CardTable | null {
  const lines = block.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return null;

  // 检查是否至少有两行以 | 开头或结尾
  const pipeLines = lines.filter((l) => /^\s*\|.*\|\s*$/.test(l));
  if (pipeLines.length < 2) return null;

  // 过滤分隔行（如 |---|---|）
  const dataLines = pipeLines.filter((l) => !/^\|[\s\-:|]+\|$/.test(l));
  if (dataLines.length < 2) return null;

  const headers = parseTableRow(dataLines[0]);
  if (headers.length === 0) return null;

  const rows = dataLines.slice(1).map(parseTableRow);

  return {
    tag: 'table',
    columns: headers.map((h) => ({ name: h })),
    rows,
  };
}

function parseTableRow(line: string): string[] {
  return line
    .split('|')
    .map((c) => c.trim())
    .filter((c, i, arr) => i > 0 && i < arr.length - 1); // 去掉首尾空串
}

// ─── 表格标题提取 ───────────────────────────────────────

function extractTableHeader(prevSegments: FeishuSegment[]): string {
  if (prevSegments.length === 0) return '数据表格';
  const last = prevSegments[prevSegments.length - 1];
  if (last.type !== 'post') return '数据表格';

  // 取最后一段 post 的最后一个非空行作为表格标题
  const lastLine = last.lines[last.lines.length - 1];
  if (!lastLine || lastLine.length === 0) return '数据表格';

  const text = lastLine.map((n) => n.text || '').join('');
  return text.slice(0, 50) || '数据表格';
}

// ─── 文本段 → post 段 ─────────────────────────────────

function textToPostSegment(text: string): FeishuSegment | null {
  const lines = text.split('\n').filter((l) => l.trim() || l === '');
  if (lines.length === 0) return null;

  const postLines: PostLine[] = [];
  let firstHeading = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      postLines.push([{ tag: 'text', text: '' }]);
      continue;
    }

    // 标题
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      if (!firstHeading) firstHeading = content;
      // 飞书 post 不支持 heading tag，用粗体 + 换行模拟
      postLines.push([{ tag: 'text', text: content, style: ['bold'] }]);
      if (level === 1) {
        postLines.push([{ tag: 'text', text: '' }]); // 空行分隔
      }
      continue;
    }

    // 水平线
    if (/^[-*_]{3,}$/.test(trimmed)) {
      postLines.push([{ tag: 'text', text: '───────────────' }]);
      continue;
    }

    // 无序列表
    const ulMatch = trimmed.match(/^[-*+]\s+(.+)/);
    if (ulMatch) {
      postLines.push(parseInline(`• ${ulMatch[1]}`));
      continue;
    }

    // 有序列表
    const olMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      postLines.push(parseInline(`${olMatch[0]}`));
      continue;
    }

    // 代码块内的内容
    if (trimmed.startsWith('```')) continue;

    // 普通段落
    postLines.push(parseInline(trimmed));
  }

  if (postLines.length === 0) return null;

  return {
    type: 'post',
    title: firstHeading || '',
    lines: postLines,
  };
}

// ─── 内联格式解析 ──────────────────────────────────────

function parseInline(text: string): PostLine {
  const nodes: PostNode[] = [];
  // 匹配: **bold**, *italic*, `code`, [link](url)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // 前面的纯文本
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      if (plain) nodes.push({ tag: 'text', text: plain });
    }

    if (match[2] !== undefined) {
      // **bold**
      nodes.push({ tag: 'text', text: match[2], style: ['bold'] });
    } else if (match[3] !== undefined) {
      // *italic*
      nodes.push({ tag: 'text', text: match[3], style: ['italic'] });
    } else if (match[4] !== undefined) {
      // `code` — 飞书 post 不支持行内代码样式，退化为普通文本
      nodes.push({ tag: 'text', text: match[4] });
    } else if (match[5] !== undefined && match[6] !== undefined) {
      // [text](url)
      nodes.push({ tag: 'a', text: match[5], href: match[6] });
    }

    lastIndex = regex.lastIndex;
  }

  // 剩余纯文本
  if (lastIndex < text.length) {
    const plain = text.slice(lastIndex);
    if (plain) nodes.push({ tag: 'text', text: plain });
  }

  // 如果没有任何节点，加入纯文本
  if (nodes.length === 0) {
    nodes.push({ tag: 'text', text });
  }

  return nodes;
}

// ─── 导出格式化工具 ─────────────────────────────────────

/**
 * 将 FeishuSegment 转换为飞书 SDK 发送消息所需的 data 参数
 */
export function segmentToFeishuData(segment: FeishuSegment): Record<string, unknown> {
  if (segment.type === 'interactive') {
    return {
      msg_type: 'interactive',
      content: JSON.stringify({
        config: { wide_screen_mode: true },
        header: {
          title: { tag: 'plain_text', content: segment.header.slice(0, 100) },
        },
        elements: [segment.table],
      }),
    };
  }

  // post 类型
  return {
    msg_type: 'post',
    content: JSON.stringify({
      zh_cn: {
        title: segment.title.slice(0, 100) || '',
        content: segment.lines,
      },
    }),
  };
}
