export interface OpenAILog {
  id: string;
  conversationId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface Message {
  sender_role?: string;
  content: string;
  created_at?: string;
  display_type?: string;
  attachment?: {
    fullback_url?: string;
    [key: string]: unknown;
  } | null;
}

export interface Conversation {
  id: string;
  subject?: string;
  last_message?: unknown;
  lastMessage?: unknown;
  isRead?: boolean;
  [key: string]: unknown;
}

export interface ConversationDetail extends Conversation {
  messages?: (Message & { id?: string })[];
  customer?: Record<string, unknown>;
  property?: Record<string, unknown>;
  check_in_date?: string;
  check_out_date?: string;
}

export interface SettingData {
  theme?: string;
  apiKey?: string;
  endpoint?: string;
  model?: string;
  autoReply?: boolean;
  pollOnRefresh?: boolean;
  prompt?: string;
  [key: string]: unknown;
}

export interface Setting {
  id: string;
  name: string;
  data: SettingData;
  pollInterval: number;
  createdAt?: string;
  updatedAt?: string;
}
