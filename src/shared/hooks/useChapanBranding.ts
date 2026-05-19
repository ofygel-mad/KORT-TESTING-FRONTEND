import { useChapanProfile } from '@/entities/order/queries';
import { resolveChapanBranding } from '../lib/chapanBranding';

export function useChapanBranding() {
  const query = useChapanProfile();

  return {
    ...query,
    ...resolveChapanBranding(query.data),
  };
}
