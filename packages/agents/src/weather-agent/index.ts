import { StateGraph, START, END } from '@langchain/langgraph';
import { AgentState } from './global';
import { informationGatheringNode } from './nodes/informationGathering';
import { toolNode } from './nodes/tools';
import { eventBus, EVENT_CHANNEL_SEND_MESSAGE } from '@krobert/events';
import type { ChannelTarget } from '@krobert/events';
import { logger, parseMessageContent, LARK_USER_OPEN_ID } from '@krobert/utils';

function shouldContinue(state: typeof AgentState.State) {
  const lastMessage = state.messages[state.messages.length - 1];

  // 检查最后一条消息是否有 tool_calls
  if ('tool_calls' in lastMessage && (lastMessage.tool_calls as any[])?.length > 0) {
    return 'tools'; // 走向工具节点执行代码
  }
  return END; // 没有工具要调了，直接结束
}

const workflow = new StateGraph(AgentState)
  .addNode('informationGathering', informationGatheringNode)
  .addNode('tools', toolNode)
  .addEdge(START, 'informationGathering')
  .addConditionalEdges('informationGathering', shouldContinue)
  .addEdge('tools', 'informationGathering');

const app = workflow.compile();

export async function runAgent(
  city: string,
  icao: string,
  channels: Array<'telegram' | 'feishu'> = ['telegram'],
) {
  const result = await app.invoke({
    messages: [], // 初始消息为空
    city,
    icao,
  });

  const lastMessage = result.messages[result.messages.length - 1];

  const targets: ChannelTarget[] = [];
  for (const ch of channels) {
    if (ch === 'telegram') {
      targets.push({
        channel: 'telegram',
        chatId: process.env.TG_PERSONAL_CHAT_ID!,
        threadId: Number(process.env.TG_WEATHER_THREAD_ID!),
      });
    } else if (ch === 'feishu') {
      if (!LARK_USER_OPEN_ID) continue;
      targets.push({
        channel: 'feishu',
        chatId: LARK_USER_OPEN_ID,
        receiveIdType: 'open_id',
      });
    }
  }

  eventBus.emit(EVENT_CHANNEL_SEND_MESSAGE, {
    targets,
    messages: [result.rawBrowserData as string],
  });

  logger.info('[WeatherAgent] weather report emitted to event bus');

  return { analysis: parseMessageContent(lastMessage.content) };
}
