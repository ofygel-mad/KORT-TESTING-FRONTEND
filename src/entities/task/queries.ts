import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tasksApi } from './api';
import type { CreateTaskDto, UpdateTaskDto, TaskFilters } from './types';

export const taskKeys = {
  all: ['tasks'] as const,
  list: (f?: TaskFilters) => ['tasks', 'list', f] as const,
  detail: (id: string) => ['tasks', id] as const,
};

export const useTasks = (filters?: TaskFilters) =>
  useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => tasksApi.list(filters),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

export const useTask = (id: string) =>
  useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => tasksApi.get(id),
    enabled: Boolean(id),
    staleTime: 120_000,
  });

export const useCreateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTaskDto) => tasksApi.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
      toast.success('Задача создана');
    },
    onError: () => toast.error('Не удалось создать задачу'),
  });
};

export const useUpdateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTaskDto }) =>
      tasksApi.update(id, dto),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: taskKeys.list() });
      qc.invalidateQueries({ queryKey: taskKeys.detail(id) });
    },
    onError: () => toast.error('Не удалось обновить задачу'),
  });
};

export const useUpdateTaskStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      tasksApi.updateStatus(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: taskKeys.list() });
      qc.invalidateQueries({ queryKey: taskKeys.detail(id) });
    },
    onError: () => toast.error('Не удалось изменить статус'),
  });
};

export const useDeleteTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
      toast.success('Задача удалена');
    },
  });
};
