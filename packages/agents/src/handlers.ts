import { eventBus, EVENT_AGENT_RSS_SUM, EVENT_AGENT_SEC } from '@krobert/events';
import type { AgentRssSumPayload, AgentSecPayload } from '@krobert/events';
import { runAgent as runRssAgent } from './rss-agent/index';
import { runAgent as runSecFilingAgent } from './sec-filing-agent/index';

eventBus.on(EVENT_AGENT_RSS_SUM, ({ category, tgExtra }: AgentRssSumPayload) => {
  void runRssAgent(category, tgExtra);
});

eventBus.on(EVENT_AGENT_SEC, ({ symbol, tgExtra }: AgentSecPayload) => {
  void runSecFilingAgent([symbol], ['10-K', '10-Q', '8-K'], 50, { tgExtra });
});
