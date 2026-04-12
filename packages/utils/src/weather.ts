import { logger } from './logger';

export async function getMetar(icao: string) {
  const url = `https://api.checkwx.com/v2/metar/${icao}/decoded`;

  try {
    const response = await fetch(url, {
      headers: { 'X-API-Key': process.env.CHECKWX_API_KEY! },
    });

    const data = (await response.json()) as any;

    logger.info('[Utils] metar data', data);

    if (data.results > 0) {
      const item = data.data[0];
      return {
        temp: item.temperature.celsius,
        obsTime: item.observed,
        ...item,
      };
    }

    return {
      temp: null,
      obsTime: null,
    };
  } catch (error) {
    logger.error(`[Utils] 获取数据失败: ${(error as Error).message}`);

    return { temp: null, obsTime: null };
  }
}

export async function getTAF(icao: string) {
  const url = `https://api.checkwx.com/v2/taf/${icao}/decoded`;

  try {
    const response = await fetch(url, {
      headers: { 'X-API-Key': process.env.CHECKWX_API_KEY! },
    });

    const data = (await response.json()) as any;

    logger.info('[Utils] metar data', data);

    if (data.results > 0) {
      const item = data.data[0];
      return {
        ...item,
      };
    }

    return {
      temp: null,
      obsTime: null,
    };
  } catch (error) {
    logger.error(`[Utils] 获取数据失败: ${(error as Error).message}`);

    return { temp: null, obsTime: null };
  }
}
