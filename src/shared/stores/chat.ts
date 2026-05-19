import { create } from 'zustand';
import type { ChatMessage } from '@/features/chat/types';

type PresenceStatus = 'online' | 'offline';

type ChatStore = {
  isOpen: boolean;
  /** null = conversation list view; string = specific conversation */
  activeConversationId: string | null;
  /** userId to find/start a DM with (set when opening from a profile bubble) */
  targetUserId: string | null;
  /** total unread across all conversations — updated by WS events */
  totalUnread: number;
  /** true for a few seconds when a new message arrives (animates floating bar) */
  hasActivity: boolean;

  /** typing state: convId → userId → { name } */
  typingState: Record<string, Record<string, { name: string }>>;
  /** online presence: userId → status */
  presenceState: Record<string, PresenceStatus>;
  /** message being replied to */
  replyingTo: ChatMessage | null;
  /** message being edited */
  editingMessage: ChatMessage | null;
  /** sidebar search query */
  searchQuery: string;

  open: (opts?: { conversationId?: string; userId?: string }) => void;
  close: () => void;
  setActiveConversation: (id: string | null) => void;
  setTotalUnread: (n: number) => void;
  notifyActivity: () => void;
  setTyping: (convId: string, userId: string, name: string, isTyping: boolean) => void;
  setPresence: (userId: string, status: PresenceStatus) => void;
  setReplyingTo: (msg: ChatMessage | null) => void;
  setEditingMessage: (msg: ChatMessage | null) => void;
  setSearchQuery: (q: string) => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  isOpen: false,
  activeConversationId: null,
  targetUserId: null,
  totalUnread: 0,
  hasActivity: false,
  typingState: {},
  presenceState: {},
  replyingTo: null,
  editingMessage: null,
  searchQuery: '',

  open: (opts) => set({
    isOpen: true,
    activeConversationId: opts?.conversationId ?? null,
    targetUserId: opts?.userId ?? null,
    replyingTo: null,
    editingMessage: null,
  }),

  close: () => set({
    isOpen: false,
    activeConversationId: null,
    targetUserId: null,
    replyingTo: null,
    editingMessage: null,
    searchQuery: '',
  }),

  setActiveConversation: (id) => set({
    activeConversationId: id,
    targetUserId: null,
    replyingTo: null,
    editingMessage: null,
  }),

  setTotalUnread: (n) => set({ totalUnread: n }),

  notifyActivity: () => {
    set({ hasActivity: true });
    setTimeout(() => set({ hasActivity: false }), 3000);
  },

  setTyping: (convId, userId, name, isTyping) => set((state) => {
    const convTyping = { ...(state.typingState[convId] ?? {}) };
    if (isTyping) {
      convTyping[userId] = { name };
    } else {
      delete convTyping[userId];
    }
    return {
      typingState: {
        ...state.typingState,
        [convId]: convTyping,
      },
    };
  }),

  setPresence: (userId, status) => set((state) => ({
    presenceState: { ...state.presenceState, [userId]: status },
  })),

  setReplyingTo: (msg) => set({ replyingTo: msg, editingMessage: null }),

  setEditingMessage: (msg) => set({ editingMessage: msg, replyingTo: null }),

  setSearchQuery: (q) => set({ searchQuery: q }),
}));
