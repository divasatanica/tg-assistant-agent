import { eventBus, EVENT_AGENT_RSS_SUM, EVENT_AGENT_SEC } from '@krobert/events';
import type { AgentRssSumPayload, AgentSecPayload } from '@krobert/events';
import { runAgent as runRssAgent } from './rss-agent/index';
import { runAgent as runSecFilingAgent } from './sec-filing-agent/index';

eventBus.on(EVENT_AGENT_RSS_SUM, ({ category, channelExtra }: AgentRssSumPayload) => {
  void runRssAgent(category, channelExtra);
});

eventBus.on(EVENT_AGENT_SEC, ({ symbol, channelExtra }: AgentSecPayload) => {
  void runSecFilingAgent([symbol], ['10-K', '10-Q', '8-K'], 50, { channelExtra });
});
