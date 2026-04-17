import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { customersApi } from './api';
const KEY = ['customers'] as const;
export const useCustomers = (params?: { page?: number; limit?: number; q?: string }) =>
  useQuery({ queryKey: [...KEY, params], queryFn: () => customersApi.list(params), staleTime: 60_000, refetchInterval: 5 * 60_000 });
export const useCustomer = (id: string) =>
  useQuery({ queryKey: [...KEY, id], queryFn: () => customersApi.get(id), enabled: Boolean(id), staleTime: 120_000 });
export const useCreateCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Parameters<typeof customersApi.create>[0]) => customersApi.create(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success('Клиент добавлен'); },
    onError: () => toast.error('Не удалось создать клиента'),
  });
};
