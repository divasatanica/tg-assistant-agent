export async function getMetar(icao: string) {
  const url = `https://api.checkwx.com/v2/metar/${icao}/decoded`;

  try {
    const response = await fetch(url, {
      headers: { 'X-API-Key': process.env.CHECKWX_API_KEY! },
    });

    const data = (await response.json()) as any;

    console.log('data', data);

    if (data.results > 0) {
      const item = data.data[0];
      return {
        temp: item.temperature.celsius,
        obsTime: item.observed,
      };
    }

    return {
      temp: null,
      obsTime: null,
    };
  } catch (error) {
    console.error(`获取数据失败: ${(error as Error).message}`);
    return { temp: null, obsTime: null };
  }
}
