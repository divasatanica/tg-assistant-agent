import { sendMarkdownMessage, sendRawMessage } from "@/channel/telegram/message";
import { AgentState } from "../global";
import { bot } from "@/channel/telegram/telegraf";
import { TELEGRAM_PERSONAL_CHAT_ID } from "@/utils/config";

function formatNewList(rssData: Record<string, any[]>) {
  let output = '';

  Object.keys(rssData).forEach(key => {
    output += `## ${key}\n`;
    rssData[key].forEach((rss: any) => {
      rss.items.forEach((item: any) => {
        output += `- [${item.title}](${item.link})\n`;
      });
    });
  });

  return output;
}

// 定义 Reporter 节点：它只管把 state 里的最新信息发出去
export const reporterNode = async (state: typeof AgentState.State) => {
  if (state.finalReport) {
    const result = await sendMarkdownMessage(bot, TELEGRAM_PERSONAL_CHAT_ID, state.finalReport, Number(process.env.TG_NEWS_REPORT_THREAD_ID));

    console.log('Send RSS report result', result);
    return {};
  }

  console.log('rssdata', state.rssData);

  const message = formatNewList(state.rssData);

  await sendRawMessage(bot, TELEGRAM_PERSONAL_CHAT_ID, message, Number(process.env.TG_NEWS_REPORT_THREAD_ID)); // 调用你的 Telegram Bot API
  return {}; // 只是输出，不修改状态
};