import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiClient } from '../../shared/api/client';
import { useAuthStore } from '../../shared/stores/auth';
import type { ChatConversation, ChatMessage, OrderPreview } from './types';

export function useChatConversations() {
  return useQuery<ChatConversation[]>({
    queryKey: ['chat', 'conversations'],
    queryFn: () => api.get('/chat/conversations/'),
    staleTime: 10_000,
    retry: false,
    throwOnError: false,
    select: (data) => (Array.isArray(data) ? data : []),
  });
}

export function useChatMessages(conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: ['chat', 'messages', conversationId] as const,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      api.get<ChatMessage[]>(
        `/chat/conversations/${conversationId}/messages/${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: null as string | null,
    getPreviousPageParam: (firstPage: ChatMessage[]) =>
      firstPage.length > 0 ? firstPage[0].id : undefined,
    getNextPageParam: () => undefined,
    enabled: !!conversationId,
    staleTime: 0,
    retry: false,
    throwOnError: false,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (convId: string) => api.post(`/chat/conversations/${convId}/read/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
  });
}

export function useSendMessage(conversationId: string | null) {
  const qc = useQueryClient();
  return useMutation<
    ChatMessage,
    Error,
    { body: string; replyToId?: string | null },
    { prev: unknown; optimisticId: string }
  >({
    mutationFn: ({ body, replyToId }) =>
      api.post<ChatMessage>(`/chat/conversations/${conversationId}/messages/`, {
        body,
        reply_to_id: replyToId ?? null,
      }),

    onMutate: async ({ body }) => {
      await qc.cancelQueries({ queryKey: ['chat', 'messages', conversationId] });
      const prev = qc.getQueryData(['chat', 'messages', conversationId]);
      const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimistic: ChatMessage = {
        id: optimisticId,
        conversation_id: conversationId ?? '',
        sender_id: useAuthStore.getState().user?.id ?? '',
        body,
        type: 'TEXT',
        reply_to_id: null,
        reply_to: null,
        edited_at: null,
        deleted_at: null,
        order_id: null,
        attachment: null,
        created_at: new Date().toISOString(),
        read_at: null,
      };
      qc.setQueryData(
        ['chat', 'messages', conversationId],
        (old: InfiniteData<ChatMessage[]> | undefined) => {
          if (!old?.pages?.length) return old;
          const pages = old.pages.map((p, i) =>
            i === old.pages.length - 1 ? [...p, optimistic] : p,
          );
          return { ...old, pages };
        },
      );
      return { prev, optimisticId };
    },

    onSuccess: (newMsg, _vars, ctx) => {
      qc.setQueryData(
        ['chat', 'messages', conversationId],
        (old: InfiniteData<ChatMessage[]> | undefined) => {
          if (!old?.pages?.length) return old;
          const pages = old.pages.map((p) =>
            p.map((m) => (m.id === ctx.optimisticId ? newMsg : m)),
          );
          return { ...old, pages };
        },
      );
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(['chat', 'messages', conversationId], ctx.prev);
      }
      toast.error('Не удалось отправить сообщение');
    },
  });
}

export function useEditMessage(conversationId: string | null) {
  const qc = useQueryClient();
  return useMutation<ChatMessage, Error, { messageId: string; body: string }>({
    mutationFn: ({ messageId, body }) =>
      api.patch<ChatMessage>(`/chat/messages/${messageId}`, { body }),
    onSuccess: (updated) => {
      qc.setQueryData(
        ['chat', 'messages', conversationId],
        (old: InfiniteData<ChatMessage[]> | undefined) => {
          if (!old?.pages?.length) return old;
          const pages = old.pages.map((p) =>
            p.map((m) => (m.id === updated.id ? updated : m)),
          );
          return { ...old, pages };
        },
      );
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
    onError: () => toast.error('Не удалось изменить сообщение'),
  });
}

export function useDeleteMessage(conversationId: string | null) {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (messageId) => api.delete(`/chat/messages/${messageId}`),
    onSuccess: (_data, messageId) => {
      qc.setQueryData(
        ['chat', 'messages', conversationId],
        (old: InfiniteData<ChatMessage[]> | undefined) => {
          if (!old?.pages?.length) return old;
          const pages = old.pages.map((p) =>
            p.map((m) =>
              m.id === messageId
                ? { ...m, deleted_at: new Date().toISOString(), body: '' }
                : m,
            ),
          );
          return { ...old, pages };
        },
      );
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
    onError: () => toast.error('Не удалось удалить сообщение'),
  });
}

export function useSendAttachment(conversationId: string | null) {
  const qc = useQueryClient();
  return useMutation<ChatMessage, Error, File>({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append('file', file, file.name);
      const res = await apiClient.post<ChatMessage>(
        `/chat/conversations/${conversationId}/attachments`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return res.data;
    },
    onSuccess: (newMsg) => {
      qc.setQueryData(
        ['chat', 'messages', conversationId],
        (old: InfiniteData<ChatMessage[]> | undefined) => {
          if (!old?.pages?.length) return old;
          const pages = old.pages.map((p, i) =>
            i === old.pages.length - 1 ? [...p, newMsg] : p,
          );
          return { ...old, pages };
        },
      );
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
    onError: () => toast.error('Не удалось загрузить файл'),
  });
}

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation<{ id: string }, Error, string>({
    mutationFn: (participantId: string) =>
      api.post('/chat/conversations/', { participant_id: participantId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
  });
}

export function useOrderPreview(orderId: string | null | undefined) {
  return useQuery<OrderPreview>({
    queryKey: ['chat', 'order-preview', orderId],
    queryFn: () => api.get(`/chat/orders/${orderId}/preview`),
    enabled: !!orderId,
    staleTime: 5 * 60_000,
    retry: false,
    throwOnError: false,
  });
}
