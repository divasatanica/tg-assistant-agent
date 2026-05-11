import { Config, QuoteContext, ContentContext, TradeContext } from 'longbridge';

class LongBridgeClient {
  private config: Config;

  constructor() {
    this.config = Config.fromApikey(
      process.env.LONGBRIDGE_APP_KEY!,
      process.env.LONGBRIDGE_APP_SECRET!,
      process.env.LONGBRIDGE_ACCESS_TOKEN!,
    );
  }

  quoteContextFactory() {
    return QuoteContext.new(this.config);
  }

  contentContextFactory() {
    return ContentContext.new(this.config);
  }

  tradeContextFactory() {
    return TradeContext.new(this.config);
  }

  async getQuote(symbol: string | string[]) {
    const ctx = this.quoteContextFactory();
    return ctx.quote(typeof symbol === 'string' ? [symbol] : symbol);
  }

  async getContentTopics(symbol: string) {
    const ctx = this.contentContextFactory();
    return ctx.topics(symbol);
  }

  async getContentNews(symbol: string) {
    const ctx = this.contentContextFactory();
    return ctx.news(symbol);
  }

  async getPosition() {
    const ctx = this.tradeContextFactory();
    return ctx.stockPositions([]);
  }

  async getBalance() {
    const ctx = this.tradeContextFactory();
    return ctx.accountBalance();
  }
}

export const longBridgeClient = new LongBridgeClient();

export async function formatPositions(): Promise<string> {
  const positions = await longBridgeClient.getPosition();
  const { channels = [] } = positions;
  let markdown = '';

  channels.forEach((channel: any) => {
    const { positions = [] } = channel;
    positions.forEach((pos: any) => {
      // 提取核心信息
      const { symbol, symbolName, quantity, costPrice, currency } = pos;

      // 尝试提取现价和现市值，如果没提供则使用已有数据计算
      const currentPrice = pos.lastPrice || costPrice;
      const marketValue =
        pos.marketValue || (parseFloat(quantity) * parseFloat(currentPrice)).toFixed(2);

      markdown += `- **${symbolName}** (${symbol}): 持仓 ${quantity}, 现价 ${currentPrice} ${currency}, 市值 ${marketValue} ${currency}\n`;
    });
  });

  return markdown;
}
