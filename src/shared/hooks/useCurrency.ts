import { useAuthStore } from '../stores/auth';
import { normalizeCurrency } from '../utils/format';

export function useCurrency(): string {
  return useAuthStore((s) => normalizeCurrency(s.org?.currency));
}
