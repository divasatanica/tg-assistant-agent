import cron from 'node-cron';
import { sleep } from '@krobert/utils/common';
import { ICAO_LIST, runWeatherTask } from '@krobert/function-tools/weather-supervisor';

/**
 * 判断当前分钟是否处于“高频采样区”
 * 高频区：每小时的 27-33 分 和 57-03 分 (跨小时)
 */
function isHighFrequencyZone(minutes: number): boolean {
  // 57-59, 0, 1, 2, 3
  const isAroundHour = minutes >= 57 || minutes <= 3;
  // 27, 28, 29, 30, 31, 32, 33
  const isMidHour = minutes >= 27 && minutes <= 33;
  return isAroundHour || isMidHour;
}

export function bootstrapWeatherCron() {
  console.log('[Cron] 启动天气动态采样逻辑...');

  // 每 30 秒运行一次逻辑检查
  // node-cron 支持 6 位表达式 (秒 分 时 日 月 周)
  cron.schedule('*/30 * * * * *', async () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    if (isHighFrequencyZone(minutes)) {
      // 处于高频区：每 30 秒都运行
      ICAO_LIST.reduce((acc, curr) => {
        return acc
          .then(() => {
            return runWeatherTask(curr.code, {
              isHighFrequencyZone: true,
              timezone: curr.timezone,
            });
          })
          .then(() => {
            return sleep(1000) as Promise<void>;
          });
      }, Promise.resolve());
    } else {
      // 处于低频区：每 10 分钟运行一次
      // 我们选在分钟能被 10 整除且秒数 < 30 的那个点运行
      if (minutes % 5 === 0 && seconds < 30) {
        // 处于高频区：每 30 秒都运行
        ICAO_LIST.reduce((acc, curr) => {
          return acc
            .then(() => {
              return runWeatherTask(curr.code, {
                isHighFrequencyZone: false,
                timezone: curr.timezone,
              });
            })
            .then(() => {
              return sleep(1000) as Promise<void>;
            });
        }, Promise.resolve());
      }
    }
  });
}
