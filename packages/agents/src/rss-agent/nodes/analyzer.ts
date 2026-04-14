import { messageChannel } from '@krobert/channel/message-channel';
import { AgentState, model } from '../global';
import {
  EVENT_MESSAGE_CHANNEL_SEND_MESSAGE,
  logger,
  MESSAGE_CHANNEL,
  parseMessageContent,
  TG_MESSAGE_THREAD_ID,
} from '@krobert/utils';

export const analyzerNode = async (state: typeof AgentState.State) => {
  const isEmpty =
    Object.keys(state.rssData).length === 0 ||
    Object.values(state.rssData).every((items) => items.length === 0);
  if (isEmpty) {
    return { finalReport: 'No RSS feeds found.' };
  }

  logger.info('[RSSAgent] rssData retrieved, start analyzing');

  const context = JSON.stringify(state.rssData);
  const response = await model.invoke([
    ...(state.messages || []),
    ['user', `Here's fetched feeds organized by category as JSON format: ${context}`],
  ]);

  messageChannel.emit(EVENT_MESSAGE_CHANNEL_SEND_MESSAGE, {
    channel: MESSAGE_CHANNEL.TELEGRAM,
    messages: [parseMessageContent(response.content)],
    extra: {
      tgExtra: {
        threadId: TG_MESSAGE_THREAD_ID.NEWS_REPORT,
      },
    },
  });

  return { finalReport: parseMessageContent(response.content) };
};
