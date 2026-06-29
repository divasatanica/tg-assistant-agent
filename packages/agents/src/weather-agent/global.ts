import { BaseMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';
import { googleModelFactory } from '../common/model';
import { fetchMetarTool, fetchTafTool } from '@krobert/function-tools/weather-supervisor';
import { snapshotCompactWebsiteTool } from '@krobert/function-tools/website-snapshot';

export const toolsList = [fetchMetarTool, fetchTafTool, snapshotCompactWebsiteTool];

export const model = googleModelFactory().bindTools(toolsList);

// 定义全局状态架构
export const AgentState = Annotation.Root({
  // 存储对话消息流
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  city: Annotation<string>(),
  icao: Annotation<string>(),
  rawBrowserData: Annotation<string>(),
  metarData: Annotation<string>(),
  analysis: Annotation<string>(),
  finalStrategy: Annotation<any>(),
});
