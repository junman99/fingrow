/**
 * Conversation Manager
 * Manages conversation history and context with sliding window memory
 */

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
};

export type Conversation = {
  id: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

const MAX_MEMORY_TURNS = 5; // Maximum number of exchanges to keep (configurable per tier)
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

export class ConversationManager {
  private conversation: Conversation | null = null;

  constructor(private maxTurns: number = MAX_MEMORY_TURNS) {}

  /**
   * Start a new conversation
   */
  startConversation(): Conversation {
    this.conversation = {
      id: this.generateId(),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    return this.conversation;
  }

  /**
   * Get current conversation or create new one
   */
  getConversation(): Conversation {
    if (!this.conversation || this.isExpired()) {
      return this.startConversation();
    }
    return this.conversation;
  }

  /**
   * Add user message
   */
  addUserMessage(content: string, metadata?: Record<string, any>): Message {
    const conversation = this.getConversation();

    const message: Message = {
      id: this.generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      metadata
    };

    conversation.messages.push(message);
    conversation.updatedAt = Date.now();

    this.pruneMessages();

    return message;
  }

  /**
   * Add assistant message
   */
  addAssistantMessage(content: string, metadata?: Record<string, any>): Message {
    const conversation = this.getConversation();

    const message: Message = {
      id: this.generateId(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata
    };

    conversation.messages.push(message);
    conversation.updatedAt = Date.now();

    this.pruneMessages();

    return message;
  }

  /**
   * Get messages for API context (sliding window)
   */
  getContextMessages(): Array<{ role: 'user' | 'assistant'; content: string }> {
    const conversation = this.getConversation();

    // Get last N exchanges (user + assistant pairs)
    const recentMessages = conversation.messages.slice(-this.maxTurns * 2);

    return recentMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Get all messages for display
   */
  getAllMessages(): Message[] {
    return this.getConversation().messages;
  }

  /**
   * Clear conversation history
   */
  clearConversation(): void {
    this.conversation = null;
  }

  /**
   * Get conversation stats
   */
  getStats(): {
    messageCount: number;
    userMessageCount: number;
    assistantMessageCount: number;
    age: number;
  } {
    const conversation = this.getConversation();
    const userMessages = conversation.messages.filter(m => m.role === 'user');
    const assistantMessages = conversation.messages.filter(m => m.role === 'assistant');

    return {
      messageCount: conversation.messages.length,
      userMessageCount: userMessages.length,
      assistantMessageCount: assistantMessages.length,
      age: Date.now() - conversation.createdAt
    };
  }

  /**
   * Check if conversation is expired
   */
  private isExpired(): boolean {
    if (!this.conversation) return true;
    return Date.now() - this.conversation.updatedAt > SESSION_TIMEOUT_MS;
  }

  /**
   * Prune old messages (sliding window)
   */
  private pruneMessages(): void {
    if (!this.conversation) return;

    // Keep last N turns (N user + N assistant = 2N messages)
    const maxMessages = this.maxTurns * 2;

    if (this.conversation.messages.length > maxMessages) {
      this.conversation.messages = this.conversation.messages.slice(-maxMessages);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export conversation for debugging/analytics
   */
  exportConversation(): string {
    return JSON.stringify(this.conversation, null, 2);
  }

  /**
   * Get memory usage estimate (tokens)
   */
  getEstimatedTokens(): number {
    const messages = this.getContextMessages();
    // Rough estimate: 1 token ≈ 4 characters
    return messages.reduce((sum, msg) => sum + Math.ceil(msg.content.length / 4), 0);
  }
}

// Singleton instance
let globalConversationManager: ConversationManager | null = null;

/**
 * Get global conversation manager instance
 */
export function getConversationManager(maxTurns?: number): ConversationManager {
  if (!globalConversationManager || (maxTurns && globalConversationManager['maxTurns'] !== maxTurns)) {
    globalConversationManager = new ConversationManager(maxTurns);
  }
  return globalConversationManager;
}

/**
 * Reset global conversation manager
 */
export function resetConversationManager(): void {
  globalConversationManager = null;
}
