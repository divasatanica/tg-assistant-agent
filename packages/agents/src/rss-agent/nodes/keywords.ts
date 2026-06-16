import { logger, parseMessageContent } from '@krobert/utils';
import { AgentState, keywordModel } from '../global';

export const keywordsNode = async (state: typeof AgentState.State) => {
  const summaries = Object.values(state.articleSummaries ?? {}).flat();

  if (summaries.length === 0) {
    return { keywords: [] };
  }

  logger.info(`[RSSAgent] Extracting keywords from ${summaries.length} summaries...`);

  const allSummaries = summaries.map((s) => `- ${s.title}: ${s.summary}`).join('\n');

  const prompt = `从以下新闻摘要中提取关键词列表。要求：每个关键词不超过6个汉字，概括新闻发生的国家地区/关键人物/事件性质。返回 JSON 数组格式，如 ["关键词1","关键词2"]。\n\n${allSummaries.slice(0, 12000)}`;

  try {
    const res = await keywordModel.invoke([['user', prompt]]);
    const content = parseMessageContent(res.content);

    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      logger.warn('[RSSAgent] Could not parse keywords JSON from LLM response');
      return { keywords: [] };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    const keywords: string[] = Array.isArray(parsed)
      ? parsed.filter((k): k is string => typeof k === 'string' && k.length <= 4)
      : [];
    logger.info(`[RSSAgent] Keywords extracted: ${keywords.join(', ')}`);
    return { keywords };
  } catch (err) {
    logger.error('[RSSAgent] Keyword extraction failed', err);
    return { keywords: [] };
  }
};
