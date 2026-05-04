import { ConversationFlavor } from '@grammyjs/conversations';
import { Context, LazySessionFlavor } from 'grammy';
import { SessionData } from './types/session.interface';

export type { SessionData };

// LazySessionFlavor is required by @grammyjs/conversations v1 so that
// ConversationFlavor can merge its own session data into the same storage.
export type BotContext = Context & LazySessionFlavor<SessionData> & ConversationFlavor;
