import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { financeApi } from './api';
import type { CreateEntryDto } from './types';

export const financeKeys = {
  all: ['finance'] as const,
  entries: (p?: object) => ['finance', 'entries', p] as const,
  summary: (p?: object) => ['finance', 'summary', p] as const,
};

export const useFinanceEntries = (params?: { type?: string; from?: string; to?: string; period?: string; page?: number; limit?: number }) =>
  useQuery({ queryKey: financeKeys.entries(params), queryFn: () => financeApi.listEntries(params), staleTime: 60_000, refetchInterval: 5 * 60_000 });

export const useFinanceSummary = (params?: { period?: string; from?: string; to?: string }) =>
  useQuery({ queryKey: financeKeys.summary(params), queryFn: () => financeApi.getSummary(params), staleTime: 60_000, refetchInterval: 5 * 60_000 });

export const useCreateEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateEntryDto) => financeApi.createEntry(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all });
      toast.success('Запись добавлена');
    },
    onError: () => toast.error('Не удалось добавить запись'),
  });
};
