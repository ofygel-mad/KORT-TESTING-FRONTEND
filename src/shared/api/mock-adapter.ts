import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import {
  buildConsoleMockSession,
  LOCAL_CONSOLE_ACCESS_TOKEN,
  LOCAL_CONSOLE_REFRESH_TOKEN,
} from '../../console/devSession';
import type {
  AuthSessionResponse,
  CompanyDirectoryItem,
  InviteRecord,
  MembershipRequestRecord,
  MembershipRequestSubmissionResponse,
  TeamMemberResponse,
} from './contracts';
import type {
  Membership,
  MembershipRole,
  MembershipSource,
  MembershipStatus,
  Org,
  OrgSummary,
} from '../stores/auth';
import {
  attachInviteToSession,
  cloneSession,
  MOCK_AUTH_SESSIONS,
  MOCK_COMPANIES,
  MOCK_CUSTOMERS,
  MOCK_DASHBOARD,
  MOCK_DEALS,
  MOCK_INVITES,
  MOCK_MEMBERSHIP_REQUESTS,
  MOCK_PIPELINE,
  MOCK_TASKS,
  resolveMockAuthSessionByEmail,
  type MockAuthSession,
} from './mock-data';

type AnyRecord = Record<string, any>;

const companies = structuredClone(MOCK_COMPANIES) as CompanyDirectoryItem[];
const sessions = structuredClone(MOCK_AUTH_SESSIONS) as MockAuthSession[];
const invites = structuredClone(MOCK_INVITES) as InviteRecord[];
const membershipRequests = structuredClone(MOCK_MEMBERSHIP_REQUESTS) as MembershipRequestRecord[];
let mockCustomers = structuredClone(MOCK_CUSTOMERS);
let mockDeals = structuredClone(MOCK_DEALS);
let mockTasks = structuredClone(MOCK_TASKS);
let mockPipeline = structuredClone(MOCK_PIPELINE);

function delay(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function parseBody(config: InternalAxiosRequestConfig<any>) {
  if (!config.data) return {};
  if (typeof config.data === 'string') {
    try {
      return JSON.parse(config.data);
    } catch {
      return {};
    }
  }
  return config.data as AnyRecord;
}

function withResponse(config: InternalAxiosRequestConfig<any>, data: unknown, status = 200) {
  config.adapter = async () => ({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config,
  });
  return config;
}

function extractBearerToken(config: InternalAxiosRequestConfig<any>) {
  const raw = config.headers?.Authorization ?? config.headers?.authorization;
  if (!raw || typeof raw !== 'string' || !raw.startsWith('Bearer ')) return null;
  return raw.slice('Bearer '.length).trim();
}

function buildCapabilities(role: MembershipRole | 'viewer', active: boolean) {
  if (!active) return [];

  const shared = [
    'customers:read',
    'customers:write',
    'deals:read',
    'deals:write',
    'tasks:read',
    'tasks:write',
    'reports.basic',
    'customers.import',
  ];

  if (role === 'owner') {
    return [
      ...shared,
      'billing.manage',
      'integrations.manage',
      'audit.read',
      'team.manage',
      'automations.manage',
    ];
  }

  if (role === 'admin') {
    return [
      ...shared,
      'integrations.manage',
      'audit.read',
      'team.manage',
      'automations.manage',
    ];
  }

  if (role === 'manager') {
    return shared;
  }

  return ['reports.basic'];
}

function buildMembership(
  company: CompanyDirectoryItem | Org | null,
  role: MembershipRole | null,
  status: MembershipStatus,
  source: MembershipSource | null,
  overrides: Partial<Membership> = {},
): Membership {
  return {
    companyId: company?.id ?? null,
    companyName: company?.name ?? null,
    companySlug: company?.slug ?? null,
    status,
    role,
    source,
    requestId: null,
    inviteToken: null,
    joinedAt: status === 'active' ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function sanitizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48) || `company-${Date.now()}`;
}

function findSessionByToken(token: string | null) {
  if (!token) return null;
  if (token === LOCAL_CONSOLE_ACCESS_TOKEN || token === LOCAL_CONSOLE_REFRESH_TOKEN) {
    return buildConsoleMockSession();
  }
  return sessions.find((session) => session.access === token || session.refresh === token) ?? null;
}

function getSession(config: InternalAxiosRequestConfig<any>) {
  return findSessionByToken(extractBearerToken(config));
}

function toAuthSession(session: MockAuthSession): AuthSessionResponse {
  const { password: _password, ...rest } = cloneSession(session);
  return rest;
}

function updateSession(nextSession: MockAuthSession) {
  const index = sessions.findIndex((session) => session.user.id === nextSession.user.id);
  if (index >= 0) {
    sessions[index] = nextSession;
  } else {
    sessions.unshift(nextSession);
  }
  return nextSession;
}

function getCompanyIdForSession(session: MockAuthSession | null) {
  return session?.membership.companyId ?? session?.org?.id ?? null;
}

function applyInviteToSession(session: MockAuthSession, token: string) {
  const invite = invites.find((item) => item.token === token);
  if (!invite) return null;
  const nextSession = attachInviteToSession(session, invite);
  updateSession(nextSession);
  return nextSession;
}

function buildTeam(companyId: string | null): TeamMemberResponse[] {
  if (!companyId) return [];
  return sessions
    .filter((session) => session.membership.companyId === companyId && session.membership.status === 'active')
    .map((session) => ({
      id: session.user.id,
      full_name: session.user.full_name,
      email: session.user.email,
      status: session.user.status ?? 'active',
      role: session.membership.role ?? session.role,
    }));
}

function getMockUserOrgs(session: MockAuthSession): OrgSummary[] {
  const primary: OrgSummary[] = session.org && session.membership.status === 'active'
    ? [{
        id: session.org.id,
        name: session.org.name,
        slug: session.org.slug,
        mode: session.org.mode as OrgSummary['mode'],
        currency: session.org.currency,
        onboarding_completed: session.org.onboarding_completed,
        role: (session.membership.role ?? session.role) as OrgSummary['role'],
      }]
    : [];

  // Primary mock owner also has manager access to the secondary workspace.
  if (session.user.id === 'u-001') {
    const northwind = companies.find((c) => c.id === 'org-002');
    if (northwind && !primary.find((o) => o.id === northwind.id)) {
      primary.push({
        id: northwind.id,
        name: northwind.name,
        slug: northwind.slug,
        mode: northwind.mode as OrgSummary['mode'],
        currency: northwind.currency,
        onboarding_completed: northwind.onboarding_completed,
        role: 'manager',
      });
    }
  }

  return primary;
}

function updateCompanyAcrossSessions(company: CompanyDirectoryItem) {
  sessions.forEach((session, index) => {
    if (session.membership.companyId !== company.id) return;
    sessions[index] = {
      ...session,
      org: session.membership.status === 'active' ? company : session.org,
      membership: {
        ...session.membership,
        companyId: company.id,
        companyName: company.name,
        companySlug: company.slug,
        updatedAt: new Date().toISOString(),
      },
    };
  });
}

function createEmployeeSession(args: {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
}) {
  const id = `u-${Date.now()}`;
  const session: MockAuthSession = {
    access: `mock_access_${id}`,
    refresh: `mock_refresh_${id}`,
    user: {
      id,
      full_name: args.full_name,
      email: args.email,
      phone: args.phone,
      avatar_url: null,
      status: 'pending',
    },
    org: null,
    capabilities: [],
    role: 'viewer',
    membership: buildMembership(null, null, 'none', 'employee_registration'),
    password: args.password,
  };
  return updateSession(session);
}

function createCompanySession(args: {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  company_name: string;
}) {
  const company: CompanyDirectoryItem = {
    id: `org-${Date.now()}`,
    name: args.company_name,
    slug: sanitizeSlug(args.company_name),
    mode: 'basic',
    currency: 'KZT',
    onboarding_completed: false,
    industry: 'Новая компания',
  };
  companies.unshift(company);

  const id = `u-${Date.now()}`;
  const session: MockAuthSession = {
    access: `mock_access_${id}`,
    refresh: `mock_refresh_${id}`,
    user: {
      id,
      full_name: args.full_name,
      email: args.email,
      phone: args.phone,
      avatar_url: null,
      status: 'active',
    },
    org: company,
    capabilities: buildCapabilities('owner', true),
    role: 'owner',
    membership: buildMembership(company, 'owner', 'active', 'company_registration'),
    password: args.password,
  };
  return updateSession(session);
}

function searchResults(query: string) {
  const q = query.toLowerCase();
  const results = [
    ...mockCustomers
      .filter((customer) => customer.full_name.toLowerCase().includes(q))
      .slice(0, 3)
      .map((customer) => ({
        id: customer.id,
        type: 'customer',
        label: customer.full_name,
        sublabel: customer.company_name || customer.phone,
        path: '/crm/customers',
      })),
    ...mockDeals
      .filter((deal) => deal.title.toLowerCase().includes(q))
      .slice(0, 3)
      .map((deal) => ({
        id: deal.id,
        type: 'deal',
        label: deal.title,
        sublabel: deal.customer_name,
        path: '/crm/deals',
      })),
    ...mockTasks
      .filter((task) => task.title.toLowerCase().includes(q))
      .slice(0, 3)
      .map((task) => ({
        id: task.id,
        type: 'task',
        label: task.title,
        sublabel: task.priority,
        path: '/crm/tasks',
      })),
  ];
  return { count: results.length, results };
}

export function installMockAdapter(client: AxiosInstance) {
  client.interceptors.request.use(async (config) => {
    await delay();

    const url = (config.url ?? '').replace(/^\/api\/v1/, '').replace(/\/+$/, '') || '/';
    const method = (config.method ?? 'get').toLowerCase();
    const body = parseBody(config);
    const params = (config.params ?? {}) as AnyRecord;
    const session = getSession(config);

    if (url === '/auth/login' && method === 'post') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const found = resolveMockAuthSessionByEmail(email);
      if (!found) return withResponse(config, null);
      const nextSession = cloneSession(found);
      updateSession(nextSession);
      const orgs = getMockUserOrgs(nextSession);
      return withResponse(config, { ...toAuthSession(nextSession), orgs });
    }

    if (url === '/auth/register/employee' && method === 'post') {
      const nextSession = createEmployeeSession({
        full_name: String(body.full_name ?? '').trim() || 'Новый сотрудник',
        email: String(body.email ?? '').trim().toLowerCase(),
        password: String(body.password ?? '').trim() || 'demo',
        phone: String(body.phone ?? '').trim() || undefined,
      });
      return withResponse(config, { ...toAuthSession(nextSession), orgs: getMockUserOrgs(nextSession) });
    }

    if (url === '/auth/register/company' && method === 'post') {
      const nextSession = createCompanySession({
        full_name: String(body.full_name ?? '').trim() || 'Владелец компании',
        email: String(body.email ?? '').trim().toLowerCase(),
        password: String(body.password ?? '').trim() || 'demo',
        phone: String(body.phone ?? '').trim() || undefined,
        company_name: String(body.company_name ?? '').trim() || 'Новая компания',
      });
      return withResponse(config, { ...toAuthSession(nextSession), orgs: getMockUserOrgs(nextSession) });
    }

    if (url === '/auth/token/refresh' && method === 'post') {
      const refresh = String(body.refresh ?? '').trim();
      const found = findSessionByToken(refresh);
      if (!found) return withResponse(config, { detail: 'Invalid refresh token' }, 401);
      return withResponse(config, { access: found.access, refresh: found.refresh });
    }

    if ((url === '/bootstrap' || url === '/auth/bootstrap' || url === '/me' || url === '/auth/me') && method === 'get') {
      if (!session) return withResponse(config, null);

      const xOrgId = String(
        config.headers?.['x-org-id'] ?? config.headers?.['X-Org-Id'] ?? '',
      ).trim();

      let activeSession = session;
      if (xOrgId && xOrgId !== session.org?.id) {
        const targetCompany = companies.find((c) => c.id === xOrgId);
        const userOrgs = getMockUserOrgs(session);
        const targetOrgEntry = userOrgs.find((o) => o.id === xOrgId);
        if (targetCompany && targetOrgEntry) {
          const role = targetOrgEntry.role as MembershipRole;
          activeSession = {
            ...session,
            org: targetCompany,
            role,
            capabilities: buildCapabilities(role, true),
            membership: buildMembership(targetCompany, role, 'active', 'manual'),
          };
        }
      }

      const orgs = getMockUserOrgs(session);
      return withResponse(config, { ...toAuthSession(activeSession), orgs });
    }

    if (url === '/companies/search' && method === 'get') {
      const q = String(params.q ?? '').trim().toLowerCase();
      const results = !q ? [] : companies.filter((company) => company.name.toLowerCase().includes(q) || company.slug.includes(q));
      return withResponse(config, { count: results.length, results: clone(results) });
    }

    if (url === '/membership-requests' && method === 'post') {
      if (!session) return withResponse(config, null, 401);
      const companyId = String(body.company_id ?? '').trim();
      const company = companies.find((item) => item.id === companyId);
      if (!company) return withResponse(config, null);

      const existing = membershipRequests.find(
        (item) => item.user_id === session.user.id && item.company_id === companyId && item.status === 'pending',
      );

      const request = existing ?? {
        id: `req-${Date.now()}`,
        user_id: session.user.id,
        full_name: session.user.full_name,
        email: session.user.email,
        company_id: company.id,
        company_name: company.name,
        status: 'pending',
        requested_role: 'viewer',
        created_at: new Date().toISOString(),
      };

      if (!existing) membershipRequests.unshift(request);

      const membership = buildMembership(company, 'viewer', 'pending', 'request', { requestId: request.id });
      updateSession({
        ...session,
        membership,
        org: null,
        role: 'viewer',
        capabilities: [],
      });

      const payload: MembershipRequestSubmissionResponse = {
        request: clone(request),
        membership,
      };
      return withResponse(config, payload);
    }

    if (url === '/membership-requests/me' && method === 'get') {
      const results = membershipRequests.filter((item) => item.user_id === session?.user.id);
      return withResponse(config, { count: results.length, results: clone(results) });
    }

    if (url === '/admin/invites' && method === 'post') {
      if (!session) return withResponse(config, null, 401);
      const companyId = getCompanyIdForSession(session);
      const company = companies.find((item) => item.id === companyId);
      if (!company) return withResponse(config, null);

      const token = `invite-${Date.now()}`;
      const invite: InviteRecord = {
        token,
        companyId: company.id,
        companyName: company.name,
        companySlug: company.slug,
        role: (body.role as MembershipRole) ?? 'manager',
        autoApprove: true,
        kind: (body.kind as 'invite' | 'referral') ?? 'referral',
        created_at: new Date().toISOString(),
        created_by: session.user.id,
        share_url: `https://kort.local/auth/accept-invite?token=${token}`,
        expiresAt: null,
        status: 'valid',
      };
      invites.unshift(invite);
      return withResponse(config, clone(invite));
    }

    if (url === '/admin/invites' && method === 'get') {
      const companyId = getCompanyIdForSession(session);
      const results = invites.filter((invite) => !companyId || invite.companyId === companyId);
      return withResponse(config, { count: results.length, results: clone(results) });
    }

    if (url === '/admin/membership-requests' && method === 'get') {
      const companyId = getCompanyIdForSession(session);
      const results = membershipRequests.filter((item) => !companyId || item.company_id === companyId);
      return withResponse(config, { count: results.length, results: clone(results) });
    }

    if (/^\/admin\/membership-requests\/[^/]+\/approve$/.test(url) && method === 'post') {
      const requestId = url.split('/')[3];
      const request = membershipRequests.find((item) => item.id === requestId);
      if (!request) return withResponse(config, null);
      request.status = 'approved';

      const target = sessions.find((item) => item.user.id === request.user_id);
      const company = companies.find((item) => item.id === request.company_id);
      if (target && company) {
        const nextRole = request.requested_role;
        updateSession({
          ...target,
          user: { ...target.user, status: 'active' },
          org: company,
          role: nextRole,
          capabilities: buildCapabilities(nextRole, true),
          membership: buildMembership(company, nextRole, 'active', 'request', { requestId: request.id }),
        });
      }
      return withResponse(config, { ok: true });
    }

    if (/^\/admin\/membership-requests\/[^/]+\/reject$/.test(url) && method === 'post') {
      const requestId = url.split('/')[3];
      const request = membershipRequests.find((item) => item.id === requestId);
      if (!request) return withResponse(config, null);
      request.status = 'rejected';

      const target = sessions.find((item) => item.user.id === request.user_id);
      const company = companies.find((item) => item.id === request.company_id) ?? null;
      if (target) {
        updateSession({
          ...target,
          user: { ...target.user, status: 'pending' },
          org: null,
          role: 'viewer',
          capabilities: [],
          membership: buildMembership(company, 'viewer', 'rejected', 'request', { requestId: request.id }),
        });
      }
      return withResponse(config, { ok: true });
    }

    if (/^\/invites\/[^/]+\/accept$/.test(url) && method === 'post') {
      if (!session) return withResponse(config, { code: 'UNAUTHORIZED', message: 'Требуется авторизация.' }, 401);
      const token = decodeURIComponent(url.split('/')[2]);
      const invite = invites.find((item) => item.token === token);
      if (!invite) return withResponse(config, { code: 'NOT_FOUND', message: 'Приглашение не найдено.' }, 404);
      if (invite.status === 'used') return withResponse(config, { code: 'VALIDATION', message: 'Это приглашение уже было использовано.' }, 400);
      if (invite.status === 'expired') return withResponse(config, { code: 'VALIDATION', message: 'Срок действия приглашения истёк.' }, 400);
      invite.status = 'used';
      const nextSession = applyInviteToSession(session, token);
      return withResponse(config, nextSession ? toAuthSession(nextSession) : null);
    }

    if (/^\/invites\/[^/]+$/.test(url) && method === 'get') {
      const token = decodeURIComponent(url.split('/')[2]);
      return withResponse(config, clone(invites.find((invite) => invite.token === token) ?? null));
    }

    if (url === '/organization' && method === 'get') {
      return withResponse(config, clone(session?.org ?? companies[0]));
    }

    if (url === '/organization' && (method === 'patch' || method === 'put')) {
      const companyId = getCompanyIdForSession(session);
      const company = companies.find((item) => item.id === companyId);
      if (!company) return withResponse(config, null);
      Object.assign(company, {
        ...body,
        slug: body.slug ? sanitizeSlug(String(body.slug)) : company.slug,
      });
      updateCompanyAcrossSessions(company);
      return withResponse(config, clone(company));
    }

    if (url === '/workspaces' && method === 'post') {
      if (!session) return withResponse(config, null, 401);

      const workspace = {
        id: `ws-${Date.now()}`,
        name: String(body.name ?? '').trim() || 'Новое производство',
        description: String(body.description ?? '').trim(),
        prefix: String(body.prefix ?? '').trim().toUpperCase(),
        status: 'created',
        created_at: new Date().toISOString(),
      };

      return withResponse(config, workspace);
    }

    if (url === '/users/team' && method === 'get') {
      const results = buildTeam(getCompanyIdForSession(session));
      return withResponse(config, { count: results.length, results });
    }

    if (/^\/users\/[^/]+\/role$/.test(url) && method === 'patch') {
      const userId = url.split('/')[2];
      const target = sessions.find((item) => item.user.id === userId);
      if (!target) return withResponse(config, null);
      const nextRole = (body.role as MembershipRole) ?? 'viewer';
      const active = target.membership.status === 'active';
      updateSession({
        ...target,
        role: active ? nextRole : 'viewer',
        capabilities: buildCapabilities(nextRole, active),
        membership: {
          ...target.membership,
          role: active ? nextRole : target.membership.role,
          updatedAt: new Date().toISOString(),
        },
      });
      return withResponse(config, { ok: true });
    }

    if (/^\/users\/[^/]+\/activate$/.test(url) && method === 'post') {
      const userId = url.split('/')[2];
      const target = sessions.find((item) => item.user.id === userId);
      if (!target) return withResponse(config, null);
      updateSession({
        ...target,
        user: { ...target.user, status: 'active' },
        membership: {
          ...target.membership,
          status: 'active',
          joinedAt: target.membership.joinedAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
      return withResponse(config, { ok: true });
    }

    if (/^\/users\/[^/]+\/deactivate$/.test(url) && method === 'post') {
      const userId = url.split('/')[2];
      const target = sessions.find((item) => item.user.id === userId);
      if (!target) return withResponse(config, null);
      updateSession({
        ...target,
        user: { ...target.user, status: 'inactive' },
        membership: {
          ...target.membership,
          updatedAt: new Date().toISOString(),
        },
      });
      return withResponse(config, { ok: true });
    }

    if (url === '/users/me' && method === 'get') {
      return withResponse(config, clone(session?.user ?? null));
    }

    if (url === '/reports/dashboard' && method === 'get') {
      return withResponse(config, clone(MOCK_DASHBOARD));
    }

    if (url === '/customers' && method === 'get') {
      return withResponse(config, { count: mockCustomers.length, results: clone(mockCustomers) });
    }

    if (url === '/customers' && method === 'post') {
      const created = {
        id: `c-${Date.now()}`,
        ...body,
        status: 'new',
        created_at: new Date().toISOString(),
        health: { score: 50, band: 'at_risk' },
        notes: '',
        tags: [],
      };
      mockCustomers = [created, ...mockCustomers];
      return withResponse(config, created);
    }

    if (/^\/customers\/[^/]+$/.test(url)) {
      const id = url.split('/')[2];
      if (method === 'patch' || method === 'put') {
        mockCustomers = mockCustomers.map((customer) => customer.id === id ? { ...customer, ...body } : customer);
      }
      return withResponse(config, clone(mockCustomers.find((customer) => customer.id === id) ?? mockCustomers[0]));
    }

    if (url === '/deals/board' && method === 'get') {
      return withResponse(config, {
        pipeline: clone(mockPipeline),
        deals: clone(mockDeals),
        total_open: mockDeals.filter((deal) => deal.status === 'open').length,
        total_amount: mockDeals.reduce((sum, deal) => sum + (deal.amount ?? 0), 0),
      });
    }

    if (url === '/deals' && method === 'get') {
      return withResponse(config, { count: mockDeals.length, results: clone(mockDeals) });
    }

    if (url === '/deals' && method === 'post') {
      const created = {
        id: `d-${Date.now()}`,
        ...body,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockDeals = [created, ...mockDeals];
      return withResponse(config, created);
    }

    if (/^\/deals\/[^/]+$/.test(url)) {
      const id = url.split('/')[2];
      if (method === 'patch' || method === 'put') {
        mockDeals = mockDeals.map((deal) => deal.id === id ? { ...deal, ...body, updated_at: new Date().toISOString() } : deal);
      }
      return withResponse(config, clone(mockDeals.find((deal) => deal.id === id) ?? mockDeals[0]));
    }

    if (url.startsWith('/pipelines') && method === 'get') {
      return withResponse(config, { count: 1, results: [clone(mockPipeline)] });
    }

    if (/^\/pipelines\/[^/]+\/stages\/reorder$/.test(url) && method === 'post') {
      const order = Array.isArray(body.order) ? body.order : [];
      mockPipeline.stages = order
        .map((id: string, index: number) => {
          const stage = mockPipeline.stages.find((item) => item.id === id);
          return stage ? { ...stage, position: index + 1 } : null;
        })
        .filter(Boolean) as typeof mockPipeline.stages;
      return withResponse(config, { ok: true });
    }

    if (/^\/pipelines\/[^/]+\/stages$/.test(url) && method === 'post') {
      const stage = {
        id: `s-${Date.now()}`,
        name: String(body.name ?? 'Новый этап'),
        position: mockPipeline.stages.length + 1,
        stage_type: 'open',
        color: '#6B7280',
        deals: [],
      };
      mockPipeline.stages.push(stage);
      return withResponse(config, stage);
    }

    if (/^\/pipelines\/[^/]+\/stages\/[^/]+$/.test(url) && (method === 'patch' || method === 'put')) {
      const stageId = url.split('/')[4];
      mockPipeline.stages = mockPipeline.stages.map((stage) => stage.id === stageId ? { ...stage, ...body } : stage);
      return withResponse(config, clone(mockPipeline.stages.find((stage) => stage.id === stageId) ?? null));
    }

    if (/^\/pipelines\/[^/]+\/stages\/[^/]+$/.test(url) && method === 'delete') {
      const stageId = url.split('/')[4];
      mockPipeline.stages = mockPipeline.stages.filter((stage) => stage.id !== stageId);
      return withResponse(config, { ok: true });
    }

    if (url === '/tasks' && method === 'get') {
      return withResponse(config, { count: mockTasks.length, results: clone(mockTasks) });
    }

    if (url === '/tasks' && method === 'post') {
      const created = {
        id: `t-${Date.now()}`,
        ...body,
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      mockTasks = [created, ...mockTasks];
      return withResponse(config, created);
    }

    if (url === '/search' && method === 'get') {
      return withResponse(config, searchResults(String(params.q ?? '')));
    }

    if (url.startsWith('/notifications') || url.startsWith('/activities') || url.startsWith('/feed') || url.startsWith('/automations')) {
      return withResponse(config, { count: 0, results: [] });
    }

    if (url.startsWith('/audit')) {
      return withResponse(config, { count: 0, results: [] });
    }

    return withResponse(config, { count: 0, results: [] });
  });
}
