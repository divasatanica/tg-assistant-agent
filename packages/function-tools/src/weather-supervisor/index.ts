import { getMetar } from '@krobert/utils/weather';
import { bot } from '@krobert/channel/telegram/telegraf';
import { sendMarkdownMessage } from '@krobert/channel/telegram/message';
import { formatTime } from '@krobert/utils/format';

const SHENZHEN_ICAO = 'ZGSZ';
const SHANGHAI_ICAO = 'ZSSS';

export const ICAO_LIST = [
  {
    code: SHENZHEN_ICAO,
    timezone: 'Asia/Shanghai',
  },
  {
    code: SHANGHAI_ICAO,
    timezone: 'Asia/Shanghai',
  },
];

export async function runWeatherTask(
  icao: string,
  {
    isHighFrequencyZone = false,
    timezone = '',
  }: { isHighFrequencyZone: boolean; timezone?: string },
) {
  console.log(`[Cron] [${new Date().toISOString()}] 执行天气抓取...`);
  try {
    const data = await getMetar(icao);
    if (data.temp !== null) {
      console.log(`[Cron] 天气更新成功: ${icao} 温度 ${data.temp}°C`);
    }

    const message =
      `## ICAO代码：${icao}\n` +
      `- 温度：${data.temp}°C\n` +
      `- 观测时间：${formatTime(data.obsTime, { timezone })}\n` +
      `- 是否为高频区间：${isHighFrequencyZone ? 'Yes' : 'No'}\n` +
      `- 当地时间：${formatTime(new Date(), { timezone })}`;

    const result = await sendMarkdownMessage(
      bot,
      process.env.TG_PERSONAL_CHAT_ID!,
      message,
      Number(process.env.TG_WEATHER_THREAD_ID!),
    );
    console.log('result', result);
  } catch (error) {
    console.error('[Cron] 天气任务执行失败:', error);
  }
}
