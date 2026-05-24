import { Client, WSClient, EventDispatcher, AppType, Domain } from '@larksuiteoapi/node-sdk';
import { LARK_APP_ID, LARK_APP_SECRET, logger } from '@krobert/utils';
import { eventBus, EVENT_AGENT_RSS_SUM } from '@krobert/events';
import { handleFeishuMessage } from './command';

const FEISHU_DOMAIN = process.env.LARK_DOMAIN === 'lark' ? Domain.Lark : Domain.Feishu;

/** 用于发送消息的 API Client */
export const feishuClient = new Client({
  appId: LARK_APP_ID,
  appSecret: LARK_APP_SECRET,
  appType: AppType.SelfBuild,
  domain: FEISHU_DOMAIN,
});

/** 机器人菜单 event_key → RSS category 映射 */
const MENU_CATEGORY_MAP: Record<string, string> = {
  'rss.subscription.blog': 'Blog',
  'rss.subscription.news': 'News',
};

export function bootstrapFeishuChannel() {
  // 创建事件分发器，注册消息接收处理
  const eventDispatcher = new EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => {
      try {
        logger.debug('[Feishu] Received message event', { data });
        await handleFeishuMessage(feishuClient, data);
      } catch (error) {
        logger.error('[Feishu] Error handling message event', error as any);
      }
      return {};
    },
    'application.bot.menu_v6': async (data) => {
      try {
        const eventKey = data?.event_key;
        const operatorId = data?.operator?.operator_id;
        const { open_id, union_id, user_id } = operatorId ?? {};

        logger.info('[Feishu] Received menu event', {
          eventKey,
          open_id,
          union_id,
          user_id,
          tenant_key: data?.tenant_key,
        });

        const category = MENU_CATEGORY_MAP[eventKey ?? ''];
        if (!category) {
          logger.warn('[Feishu] Unknown bot menu event_key', { eventKey });
          return {};
        }

        // 优先用 open_id，fallback 到 union_id → user_id
        const receiveId = open_id || union_id || user_id;
        const receiveIdType = open_id
          ? 'open_id'
          : union_id
            ? 'union_id'
            : user_id
              ? 'user_id'
              : undefined;

        if (!receiveId || !receiveIdType) {
          logger.warn('[Feishu] Bot menu event has no usable operator ID', { operatorId });
          return {};
        }

        logger.info('[Feishu] Dispatching RSS agent from menu', {
          category,
          receiveId,
          receiveIdType,
        });

        eventBus.emit(EVENT_AGENT_RSS_SUM, {
          category,
          channelExtra: {
            chatId: receiveId,
            channels: ['feishu'],
            receiveIdType,
          },
        });
      } catch (error) {
        logger.error('[Feishu] Error handling menu event', error as any);
      }
      return {};
    },
  });

  // 启动 WebSocket 长连接
  const wsClient = new WSClient({
    appId: LARK_APP_ID,
    appSecret: LARK_APP_SECRET,
    domain: FEISHU_DOMAIN,
    onReady: () => {
      logger.info('[Feishu] WebSocket connected successfully');
    },
    onError: (err: Error) => {
      logger.error('[Feishu] WSClient error', err as any);
    },
    onReconnecting: () => {
      logger.info('[Feishu] WebSocket reconnecting...');
    },
    onReconnected: () => {
      logger.info('[Feishu] WebSocket reconnected');
    },
  });

  wsClient.start({ eventDispatcher });
  logger.info('[Feishu] Channel is running via WebSocket long connection...');
}
