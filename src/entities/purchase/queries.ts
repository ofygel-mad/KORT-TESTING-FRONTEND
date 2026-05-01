import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { purchaseApi } from './api';
import type { CreateManualInvoiceDto, UpdateManualInvoiceDto } from './types';
import { readApiErrorMessage } from '../../shared/api/errors';

const purchaseKeys = {
  all: ['chapan-purchase'] as const,
  list: (type?: string, archived?: boolean) => [...purchaseKeys.all, 'list', type, archived ?? false] as const,
  detail: (id: string) => [...purchaseKeys.all, 'detail', id] as const,
};

export const useManualInvoices = (type?: string, archived?: boolean) =>
  useQuery({
    queryKey: purchaseKeys.list(type, archived),
    queryFn: () => purchaseApi.list({
      ...(type ? { type } : {}),
      ...(archived !== undefined ? { archived } : {}),
    }),
    staleTime: 30_000,
  });

export const useManualInvoice = (id: string) =>
  useQuery({
    queryKey: purchaseKeys.detail(id),
    queryFn: () => purchaseApi.getById(id),
    enabled: !!id,
  });

export const useCreateManualInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateManualInvoiceDto) => purchaseApi.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: purchaseKeys.all }),
    onError: (error) => toast.error(readApiErrorMessage(error, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u0443\u044e')),
  });
};

export const useUpdateManualInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateManualInvoiceDto }) => purchaseApi.update(id, dto),
    onSuccess: (invoice) => {
      qc.invalidateQueries({ queryKey: purchaseKeys.all });
      qc.setQueryData(purchaseKeys.detail(invoice.id), invoice);
    },
    onError: (error) => toast.error(readApiErrorMessage(error, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u0443\u044e')),
  });
};

export const useArchiveManualInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseApi.archive(id),
    onSuccess: (invoice) => {
      qc.invalidateQueries({ queryKey: purchaseKeys.all });
      qc.setQueryData(purchaseKeys.detail(invoice.id), invoice);
    },
    onError: (error) => toast.error(readApiErrorMessage(error, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0430\u0440\u0445\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u0443\u044e')),
  });
};

export const useRestoreManualInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseApi.restore(id),
    onSuccess: (invoice) => {
      qc.invalidateQueries({ queryKey: purchaseKeys.all });
      qc.setQueryData(purchaseKeys.detail(invoice.id), invoice);
    },
    onError: (error) => toast.error(readApiErrorMessage(error, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u0443\u044e')),
  });
};

export const useDeleteManualInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: purchaseKeys.all }),
    onError: (error) => toast.error(readApiErrorMessage(error, '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u0443\u044e')),
  });
};
