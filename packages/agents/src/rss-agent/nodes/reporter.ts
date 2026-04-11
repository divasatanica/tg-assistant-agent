import { sendMarkdownMessage, sendRawMessage } from '@krobert/channel/telegram/message';
import { AgentState } from '../global';
import { bot } from '@krobert/channel/telegram/telegraf';
import { TELEGRAM_PERSONAL_CHAT_ID } from '@krobert/utils/config';
import { sleep } from '@krobert/utils/common';

function formatNewList(rssData: Record<string, any[]>) {
  const output = {} as Record<string, string>;

  Object.keys(rssData).forEach((key) => {
    output[key] = `## ${key}\n`;
    rssData[key].forEach((rss: any) => {
      rss.items.forEach((item: any) => {
        output[key] += `- [${item.title}](${item.link})\n`;
      });

      output[key] = output[key].slice(0, 4000);
    });
  });

  return output;
}

// 定义 Reporter 节点：它只管把 state 里的最新信息发出去
export const reporterNode = async (state: typeof AgentState.State) => {
  if (state.finalReport) {
    const result = await sendMarkdownMessage(
      bot,
      TELEGRAM_PERSONAL_CHAT_ID,
      state.finalReport,
      Number(process.env.TG_NEWS_REPORT_THREAD_ID),
    );

    console.log('Send RSS report result', result);
    return {};
  }

  console.log('rssdata', state.rssData);

  const messageSummary = formatNewList(state.rssData);

  await Object.keys(messageSummary).reduce((acc: Promise<any>, category) => {
    return acc
      .then(() => sleep(1000))
      .then(() => {
        return sendRawMessage(
          bot,
          TELEGRAM_PERSONAL_CHAT_ID,
          messageSummary[category],
          Number(process.env.TG_NEWS_REPORT_THREAD_ID),
        );
      })
      .then((res) => console.log('Send RSS report result for category', category, res));
  }, Promise.resolve());

  return {}; // 只是输出，不修改状态
};
