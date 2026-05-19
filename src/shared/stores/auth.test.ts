import { beforeEach, describe, expect, it } from 'vitest';
import { resolvePostAuthPath } from '@/features/auth/navigation';
import { DEFAULT_MEMBERSHIP, useAuthStore, type Membership, type Org, type User } from './auth';

const MOCK_USER: User = {
  id: 'user-1',
  full_name: 'Test User',
  email: 'user@example.test',
};

const MOCK_ORG: Org = {
  id: 'org-1',
  name: 'Workspace',
  slug: 'workspace',
  mode: 'basic',
  currency: 'KZT',
  onboarding_completed: false,
};

function buildActiveMembership(role: Membership['role'] = 'owner'): Membership {
  return {
    ...DEFAULT_MEMBERSHIP,
    companyId: MOCK_ORG.id,
    companyName: MOCK_ORG.name,
    companySlug: MOCK_ORG.slug,
    status: 'active',
    role,
    source: 'manual',
  };
}

describe('useAuthStore membership model', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('creates employee sessions without company access when org is absent', () => {
    useAuthStore.getState().setAuth(MOCK_USER, null, 'access-token', 'refresh-token', [], 'viewer');

    const state = useAuthStore.getState();

    expect(state.org).toBeNull();
    expect(state.membership).toMatchObject({
      companyId: null,
      companyName: null,
      companySlug: null,
      inviteToken: null,
      joinedAt: null,
      requestId: null,
      status: 'none',
      role: null,
      source: null,
    });
    expect(state.membership.updatedAt).toEqual(expect.any(String));
    expect(state.role).toBe('viewer');
  });

  it('syncs derived org and role from an active membership', () => {
    useAuthStore.getState().setAuth(MOCK_USER, null, 'access-token', 'refresh-token', [], 'viewer');
    useAuthStore.getState().setMembership({
      companyId: 'org-2',
      companyName: 'Acme Works',
      companySlug: 'acme-works',
      status: 'active',
      role: 'admin',
      source: 'invite',
    });

    const state = useAuthStore.getState();

    expect(state.role).toBe('admin');
    expect(state.org).toMatchObject({
      id: 'org-2',
      name: 'Acme Works',
      slug: 'acme-works',
      mode: 'basic',
      currency: 'KZT',
    });
  });

  it('clears derived org when membership is no longer active', () => {
    useAuthStore.getState().setAuth(
      MOCK_USER,
      MOCK_ORG,
      'access-token',
      'refresh-token',
      ['team.manage'],
      'owner',
      { membership: buildActiveMembership('owner') },
    );

    useAuthStore.getState().setMembership({
      status: 'pending',
      role: 'viewer',
      source: 'request',
    });

    const state = useAuthStore.getState();

    expect(state.role).toBe('viewer');
    expect(state.org).toBeNull();
    expect(state.membership.status).toBe('pending');
  });
});

describe('resolvePostAuthPath', () => {
  it('routes owners with incomplete onboarding to onboarding', () => {
    expect(resolvePostAuthPath({
      org: MOCK_ORG,
      membership: buildActiveMembership('owner'),
    })).toBe('/onboarding');
  });

  it('keeps everyone else on the dashboard path', () => {
    expect(resolvePostAuthPath({
      org: { ...MOCK_ORG, onboarding_completed: true },
      membership: buildActiveMembership('owner'),
    })).toBe('/');

    expect(resolvePostAuthPath({
      org: null,
      membership: {
        ...DEFAULT_MEMBERSHIP,
        status: 'pending',
        role: 'viewer',
        source: 'request',
      },
    })).toBe('/');
  });
});
