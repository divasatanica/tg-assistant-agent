import { Client, WSClient, EventDispatcher, AppType, Domain } from '@larksuiteoapi/node-sdk';
import { LARK_APP_ID, LARK_APP_SECRET, logger } from '@krobert/utils';
import { handleFeishuMessage } from './command';

const FEISHU_DOMAIN = process.env.LARK_DOMAIN === 'lark' ? Domain.Lark : Domain.Feishu;

logger.debug('[Feishu] Initializing channel with config', {
  appId: LARK_APP_ID,
  domain: FEISHU_DOMAIN,
});

/** 用于发送消息的 API Client */
export const feishuClient = new Client({
  appId: LARK_APP_ID,
  appSecret: LARK_APP_SECRET,
  appType: AppType.SelfBuild,
  domain: FEISHU_DOMAIN,
});

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
