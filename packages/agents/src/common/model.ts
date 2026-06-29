import { DEEPSEEK_API_KEY, GOOGLE_MODEL_NAME, GOOGLE_API_KEY } from '@krobert/utils/config';
import { ChatGoogle } from '@langchain/google';
import { ChatDeepSeek } from '@langchain/deepseek';

const MODEL_MAX_RETRIES = 3;

function isGoogleModel(modelName: string) {
  return /gemini|gemma/i.test(modelName);
}

function isDeepSeekModel(modelName: string) {
  return modelName.startsWith('deepseek');
}

export function createModel(modelName: string = GOOGLE_MODEL_NAME) {
  if (isDeepSeekModel(modelName)) {
    return new ChatDeepSeek({
      model: modelName,
      temperature: 0,
      apiKey: DEEPSEEK_API_KEY,
      maxRetries: MODEL_MAX_RETRIES,
    });
  }

  if (isGoogleModel(modelName)) {
    return new ChatGoogle({
      model: modelName,
      temperature: 0,
      maxOutputTokens: 8192,
      apiKey: GOOGLE_API_KEY,
      maxRetries: MODEL_MAX_RETRIES,
    });
  }

  throw new Error(`Unknown model: ${modelName}. Expected a gemini-* or deepseek-* model name.`);
}
