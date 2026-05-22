import { OLLAMA_MODEL_NAME, GOOGLE_MODEL_NAME, GOOGLE_API_KEY } from '@krobert/utils/config';
import { ChatOllama } from '@langchain/ollama';
import { ChatGoogle } from '@langchain/google';

export function ollamaModelFactory(modelName: string = OLLAMA_MODEL_NAME) {
  return new ChatOllama({
    model: modelName,
    temperature: 0,
    numCtx: 128000,
  });
}

export function googleModelFactory(modelName: string = GOOGLE_MODEL_NAME) {
  return new ChatGoogle({
    model: modelName,
    temperature: 0,
    maxOutputTokens: 8192,
    apiKey: GOOGLE_API_KEY,
  });
}
