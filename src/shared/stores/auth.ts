import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { normalizeCurrency } from '../utils/format';

export type MembershipStatus = 'none' | 'pending' | 'active' | 'rejected';
export type MembershipRole = 'owner' | 'admin' | 'manager' | 'viewer';
export type MembershipSource =
  | 'company_registration'
  | 'employee_registration'
  | 'invite'
  | 'request'
  | 'manual';

export type User = {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string | null;
  status?: string;
  /** Признак первичного владельца (прошедшего регистрацию компании) */
  is_owner?: boolean;
  /** Права доступа сотрудника — строки из EmployeePermission */
  employee_permissions?: string[];
  /** Статус аккаунта сотрудника */
  account_status?: string;
};

export type Org = {
  id: string;
  name: string;
  slug: string;
  mode: 'basic' | 'advanced' | 'industrial';
  currency: string;
  is_demo?: boolean;
  onboarding_completed?: boolean;
};

export type Membership = {
  companyId: string | null;
  companyName: string | null;
  companySlug: string | null;
  status: MembershipStatus;
  role: MembershipRole | null;
  source: MembershipSource | null;
  requestId?: string | null;
  inviteToken?: string | null;
  joinedAt?: string | null;
  updatedAt?: string | null;
};

export type InviteContext = {
  token: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  role: MembershipRole;
  autoApprove: boolean;
  kind: 'invite' | 'referral';
  expiresAt?: string | null;
};

export type OrgSummary = {
  id: string;
  name: string;
  slug: string;
  mode: 'basic' | 'advanced' | 'industrial';
  currency: string;
  is_demo?: boolean;
  onboarding_completed?: boolean;
  role: MembershipRole | 'viewer';
};

export const DEFAULT_MEMBERSHIP: Membership = {
  companyId: null,
  companyName: null,
  companySlug: null,
  status: 'none',
  role: null,
  source: null,
  requestId: null,
  inviteToken: null,
  joinedAt: null,
  updatedAt: null,
};

function normalizeOrgState(org: Org | null): Org | null {
  if (!org) {
    return null;
  }

  return {
    ...org,
    currency: normalizeCurrency(org.currency),
  };
}

function normalizeOrgSummaryState(org: OrgSummary): OrgSummary {
  return {
    ...org,
    currency: normalizeCurrency(org.currency),
  };
}

function buildOrgFromMembership(membership: Membership, currentOrg: Org | null): Org | null {
  if (
    membership.status !== 'active'
    || !membership.companyId
    || !membership.companyName
  ) {
    return null;
  }

  return normalizeOrgState({
    id: membership.companyId,
    name: membership.companyName,
    slug: membership.companySlug ?? currentOrg?.slug ?? 'company',
    mode: currentOrg?.mode ?? 'basic',
    currency: currentOrg?.currency ?? 'KZT',
    is_demo: currentOrg?.is_demo,
    onboarding_completed: currentOrg?.onboarding_completed,
  });
}

function deriveStoredRole(membership: Membership, fallbackRole: string) {
  if (membership.status !== 'active') {
    return 'viewer';
  }

  return membership.role ?? fallbackRole ?? 'viewer';
}

type AuthState = {
  user: User | null;
  org: Org | null;
  token: string | null;
  refreshToken: string | null;
  role: string;
  capabilities: string[];
  membership: Membership;
  inviteContext: InviteContext | null;
  userOrgs: OrgSummary[];
  selectedOrgId: string | null;
  isUnlocked: boolean;
  setAuth: (
    user: User,
    org: Org | null,
    token: string,
    refresh: string,
    caps: string[],
    role?: string,
    options?: {
      membership?: Partial<Membership>;
      inviteContext?: InviteContext | null;
      orgs?: OrgSummary[];
    },
  ) => void;
  setTokens: (access: string, refresh: string) => void;
  syncSession: (payload: {
    user: User;
    org: Org | null;
    capabilities: string[];
    role?: string;
    membership: Membership;
    inviteContext?: InviteContext | null;
    orgs?: OrgSummary[];
  }) => void;
  setRole: (role: string) => void;
  setUser: (user: Partial<User>) => void;
  setOrg: (org: Partial<Org>) => void;
  setMembership: (membership: Partial<Membership>) => void;
  replaceMembership: (membership: Membership) => void;
  setInviteContext: (ctx: InviteContext | null) => void;
  clearAuth: () => void;
  unlock: () => void;
  lock: () => void;
  setUserOrgs: (orgs: OrgSummary[]) => void;
  setSelectedOrgId: (orgId: string | null) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      org: null,
      token: null,
      refreshToken: null,
      role: 'viewer',
      capabilities: [],
      membership: DEFAULT_MEMBERSHIP,
      inviteContext: null,
      userOrgs: [],
      selectedOrgId: null,
      isUnlocked: false,
      setAuth: (user, org, token, refresh, capabilities, role = 'viewer', options) => {
        const membership: Membership = {
          ...DEFAULT_MEMBERSHIP,
          companyId: org?.id ?? null,
          companyName: org?.name ?? null,
          companySlug: org?.slug ?? null,
          role: org ? ((role as MembershipRole) ?? null) : null,
          status: org ? 'active' : 'none',
          source: org ? 'manual' : null,
          updatedAt: new Date().toISOString(),
          ...options?.membership,
        };

        set({
          user,
          org: membership.status === 'active'
            ? normalizeOrgState(org ?? buildOrgFromMembership(membership, org))
            : null,
          token,
          refreshToken: refresh,
          capabilities,
          role: deriveStoredRole(membership, role),
          inviteContext: options?.inviteContext ?? null,
          membership,
          userOrgs: options?.orgs?.map(normalizeOrgSummaryState) ?? get().userOrgs,
        });
      },
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      syncSession: ({ user, org, capabilities, role = 'viewer', membership, inviteContext, orgs }) => set((state) => ({
        user,
        org: membership.status === 'active'
          ? normalizeOrgState(org ?? buildOrgFromMembership(membership, state.org))
          : null,
        capabilities,
        role: deriveStoredRole(membership, role),
        membership,
        inviteContext: inviteContext ?? state.inviteContext,
        userOrgs: orgs?.map(normalizeOrgSummaryState) ?? state.userOrgs,
      })),
      setRole: (role) => set({ role }),
      setUser: (partial) => set((state) => ({
        user: state.user ? { ...state.user, ...partial } : null,
      })),
      setOrg: (partial) => set((state) => {
        const nextOrg = state.org ? normalizeOrgState({ ...state.org, ...partial }) : null;
        return {
          org: nextOrg,
          membership: {
            ...state.membership,
            companyId: nextOrg?.id ?? state.membership.companyId,
            companyName: nextOrg?.name ?? state.membership.companyName,
            companySlug: nextOrg?.slug ?? state.membership.companySlug,
            updatedAt: new Date().toISOString(),
          },
        };
      }),
      setMembership: (partial) => set((state) => {
        const membership = {
          ...state.membership,
          ...partial,
          updatedAt: new Date().toISOString(),
        };
        return {
          membership,
          role: deriveStoredRole(membership, state.role),
          org: buildOrgFromMembership(membership, state.org),
        };
      }),
      replaceMembership: (membership) => set((state) => ({
        membership,
        role: deriveStoredRole(membership, state.role),
        org: buildOrgFromMembership(membership, state.org),
      })),
      setInviteContext: (inviteContext) => set({ inviteContext }),
      clearAuth: () => set({
        user: null,
        org: null,
        token: null,
        refreshToken: null,
        role: 'viewer',
        capabilities: [],
        membership: DEFAULT_MEMBERSHIP,
        inviteContext: null,
        userOrgs: [],
        selectedOrgId: null,
        isUnlocked: false,
      }),
      unlock: () => set({ isUnlocked: true }),
      lock: () => set({ isUnlocked: false }),
      setUserOrgs: (orgs) => set({ userOrgs: orgs.map(normalizeOrgSummaryState) }),
      setSelectedOrgId: (orgId) => set({ selectedOrgId: orgId }),
    }),
    {
      name: 'kort-auth',
      partialize: (state) => ({
        user: state.user,
        org: state.org,
        token: state.token,
        refreshToken: state.refreshToken,
        role: state.role,
        capabilities: state.capabilities,
        membership: state.membership,
        inviteContext: state.inviteContext,
        userOrgs: state.userOrgs,
        selectedOrgId: state.selectedOrgId,
        isUnlocked: state.isUnlocked,
      }),
    },
  ),
);
