import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { leadsApi } from './api';
import type { CreateLeadDto, UpdateLeadDto, LeadFilters } from './types';

export const leadKeys = {
  all: ['leads'] as const,
  list: (f?: LeadFilters) => ['leads', f] as const,
  detail: (id: string) => ['leads', id] as const,
};

export const useLeads = (filters?: LeadFilters) =>
  useQuery({
    queryKey: leadKeys.list(filters),
    queryFn: () => leadsApi.list(filters),
    refetchInterval: 5 * 60_000,
  });

export const useLead = (id: string) =>
  useQuery({
    queryKey: leadKeys.detail(id),
    queryFn: () => leadsApi.get(id),
    enabled: Boolean(id),
  });

export const useCreateLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateLeadDto) => leadsApi.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leadKeys.all });
      toast.success('Лид создан');
    },
    onError: () => toast.error('Не удалось создать лид'),
  });
};

export const useUpdateLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateLeadDto }) =>
      leadsApi.update(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: leadKeys.all });
      qc.invalidateQueries({ queryKey: leadKeys.detail(id) });
    },
    onError: () => toast.error('Не удалось обновить'),
  });
};

export const useAddLeadHistory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, type, content }: { id: string; type: string; content?: string }) =>
      leadsApi.addHistory(id, { type, content }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: leadKeys.detail(id) });
    },
  });
};
