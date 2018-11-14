import { Activity } from 'botframework-schema';

export interface DirectLineOptions {
  conversationId?: string;
  domain?: string;
  isomorphicFetch: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  isomorphicWS: { new(url: string, protocols?: string | string[]): WebSocket; };
  maxRetries?: number;
  pollingInterval?: number;
  secret?: string;
  streamUrl?: string;
  timeout?: number;
  token?: string;
  watermark?: string;
  useWebSocket?: boolean;
}

export interface ActivityGroup {
  activities: Activity[],
  watermark: string
}

// Direct Line 3.0 types

export interface Conversation {
  conversationId: string;
  token: string;
  eTag?: string;
  streamUrl?: string;
  referenceGrammarId?: string;
  expires_in?: number;
}