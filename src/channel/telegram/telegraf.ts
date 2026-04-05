import { Telegraf } from 'telegraf';
import { TG_BOT_TOKEN } from '@/utils/config';

// 1. 初始化 Bot
export const bot = new Telegraf(TG_BOT_TOKEN);