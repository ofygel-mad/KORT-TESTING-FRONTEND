import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { dealsApi } from './api';
import type { CreateDealDto, UpdateDealDto, AddDealActivityDto } from './types';

export const dealKeys = {
  all: ['deals'] as const,
  board: ['deals', 'board'] as const,
  list: (p?: object) => ['deals', 'list', p] as const,
  detail: (id: string) => ['deals', id] as const,
  activities: (id: string) => ['deals', id, 'activities'] as const,
};

export const useDealsBoard = () =>
  useQuery({
    queryKey: dealKeys.board,
    queryFn: () => dealsApi.getBoard(),
    refetchInterval: 5 * 60_000,
  });

export const useDeals = (params?: { page?: number; limit?: number }) =>
  useQuery({
    queryKey: dealKeys.list(params),
    queryFn: () => dealsApi.list(params),
    refetchInterval: 5 * 60_000,
  });

export const useDeal = (id: string) =>
  useQuery({
    queryKey: dealKeys.detail(id),
    queryFn: () => dealsApi.get(id),
    enabled: Boolean(id),
  });

export const useDealActivities = (id: string) =>
  useQuery({
    queryKey: dealKeys.activities(id),
    queryFn: () => dealsApi.getActivities(id),
    enabled: Boolean(id),
    refetchInterval: 5 * 60_000,
  });

export const useCreateDeal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDealDto) => dealsApi.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dealKeys.all });
      toast.success('Сделка создана');
    },
    onError: () => toast.error('Не удалось создать сделку'),
  });
};

export const useUpdateDeal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateDealDto }) =>
      dealsApi.update(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: dealKeys.all });
      qc.invalidateQueries({ queryKey: dealKeys.detail(id) });
    },
    onError: () => toast.error('Не удалось обновить'),
  });
};

export const useAddDealActivity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: AddDealActivityDto }) =>
      dealsApi.addActivity(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: dealKeys.activities(id) });
      qc.invalidateQueries({ queryKey: dealKeys.detail(id) });
    },
  });
};

export const useDeleteDeal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dealsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dealKeys.all });
      toast.success('Сделка удалена');
    },
  });
};
