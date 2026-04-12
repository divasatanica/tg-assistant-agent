export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 提取 LangChain 消息内容的字符串。
 * content 可能是一个 string，也可能是一个 content block 数组。
 */
export function parseMessageContent(content: any): string {
  let finalResponse = '';

  if (typeof content === 'string') {
    finalResponse = content;
  } else if (Array.isArray(content)) {
    // 关键过滤逻辑：只保留 text 类型的 block，过滤掉 thought 或 call 类型的 block
    finalResponse = content
      .filter((part) => part.type === 'text' && !part.thought)
      .map((part) => part.text)
      .join('');
  }
  return finalResponse;
}
