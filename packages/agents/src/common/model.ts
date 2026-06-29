import { GOOGLE_MODEL_NAME, GOOGLE_API_KEY } from '@krobert/utils/config';
import { ChatGoogle } from '@langchain/google';

const MODEL_MAX_RETRIES = 3;

export function googleModelFactory(modelName: string = GOOGLE_MODEL_NAME) {
  return new ChatGoogle({
    model: modelName,
    temperature: 0,
    maxOutputTokens: 8192,
    apiKey: GOOGLE_API_KEY,
    maxRetries: MODEL_MAX_RETRIES,
  });
}
