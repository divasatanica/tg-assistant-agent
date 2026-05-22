import { StateGraph, START, END } from '@langchain/langgraph';
import { AgentState } from './global';
import { informationGatheringNode } from './nodes/informationGathering';
import { toolNode } from './nodes/tools';
import { eventBus, EVENT_CHANNEL_SEND_MESSAGE } from '@krobert/events';
import { logger, parseMessageContent } from '@krobert/utils';

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

export async function runAgent(city: string, icao: string) {
  const result = await app.invoke({
    messages: [], // 初始消息为空
    city,
    icao,
  });

  const lastMessage = result.messages[result.messages.length - 1];

  eventBus.emit(EVENT_CHANNEL_SEND_MESSAGE, {
    channel: 'telegram',
    messages: [result.rawBrowserData as string],
    extra: {
      tgExtra: {
        chatId: process.env.TG_PERSONAL_CHAT_ID!,
        threadId: Number(process.env.TG_WEATHER_THREAD_ID!),
      },
    },
  });

  logger.info('[WeatherAgent] weather report emitted to event bus');

  return { analysis: parseMessageContent(lastMessage.content) };
}
