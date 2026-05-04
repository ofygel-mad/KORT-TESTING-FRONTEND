import { useAuthStore } from '../stores/auth';

export type OrgMode = 'basic' | 'advanced' | 'industrial';

export const PLAN_RANK: Record<OrgMode, number> = { basic: 0, advanced: 1, industrial: 2 };

export const PLAN_LABELS: Record<OrgMode, string> = {
  basic: 'Базовый',
  advanced: 'Продвинутый',
  industrial: 'Промышленный',
};

export const PLAN_COLORS: Record<OrgMode, string> = {
  basic: '#5C8DFF',
  advanced: '#D97706',
  industrial: '#7C3AED',
};

export function usePlan(): OrgMode {
  const org = useAuthStore((s) => s.org);
  return (org?.mode as OrgMode) ?? 'basic';
}

export function planIncludes(currentPlan: OrgMode, required: OrgMode): boolean {
  return PLAN_RANK[currentPlan] >= PLAN_RANK[required];
}
