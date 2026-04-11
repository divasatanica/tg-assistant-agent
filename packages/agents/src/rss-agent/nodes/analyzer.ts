import { AgentState, model } from '../global';

export const analyzerNode = async (state: typeof AgentState.State) => {
  const isEmpty =
    Object.keys(state.rssData).length === 0 ||
    Object.values(state.rssData).every((items) => items.length === 0);
  if (isEmpty) {
    return { finalReport: 'No RSS feeds found.' };
  }

  const context = JSON.stringify(state.rssData);
  const response = await model.invoke([
    ...(state.messages || []),
    ['user', `Here's fetched feeds organized by category as JSON format: ${context}`],
  ]);
  return { finalReport: response.content as string };
};
