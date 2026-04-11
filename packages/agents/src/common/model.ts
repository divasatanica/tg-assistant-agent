import { OLLAMA_MODEL_NAME } from '@krobert/utils/config';
import { ChatOllama } from '@langchain/ollama';

export function ollamaModelFactory(modelName: string = OLLAMA_MODEL_NAME) {
  return new ChatOllama({
    model: modelName,
    temperature: 0,
    numCtx: 128000,
  });
}
