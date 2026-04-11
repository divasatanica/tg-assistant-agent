import { ToolNode } from '@langchain/langgraph/prebuilt';
import { toolsList } from '../global';

export const toolNode = new ToolNode(toolsList);
