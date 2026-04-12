import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getMetar, getTAF } from '@krobert/utils/weather';
import { bot } from '@krobert/channel/telegram/telegraf';
import { sendMarkdownMessage } from '@krobert/channel/telegram/message';
import { formatTime } from '@krobert/utils/format';
import { logger } from '@krobert/utils';

const SHENZHEN_ICAO = 'ZGSZ';
const SHANGHAI_ICAO = 'ZSSS';

export const ICAO_LIST = [
  {
    code: SHENZHEN_ICAO,
    city: 'Shenzhen',
    timezone: 'Asia/Shanghai',
  },
  {
    code: SHANGHAI_ICAO,
    city: 'Shanghai',
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
  try {
    const data = await getMetar(icao);

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
    logger.info('[Tools] result', result);
  } catch (error) {
    logger.error('[Cron] 天气任务执行失败:', error);
  }
}

export const fetchMetarTool = tool(
  async ({ icao }: { icao: string }) => {
    return await getMetar(icao);
  },
  {
    name: 'fetchMetar',
    description:
      'Fetches METAR data for a given ICAO code. When you need to fetch METAR data, you must use this tool.',
    schema: z.object({
      icao: z.string().describe('The ICAO code for the airport.'),
    }),
  },
);

export const fetchTafTool = tool(
  async ({ icao }: { icao: string }) => {
    return await getTAF(icao);
  },
  {
    name: 'fetchTaf',
    description:
      'Fetches TAF data for a given ICAO code. When you need to fetch TAF data, you must use this tool.',
    schema: z.object({
      icao: z.string().describe('The ICAO code for the airport.'),
    }),
  },
);
