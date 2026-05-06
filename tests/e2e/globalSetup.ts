import { request, type StorageState } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authDir = path.join(__dirname, '.auth');
const E2E_HOST = process.env.E2E_HOST || '127.0.0.1';
const E2E_FRONTEND_PORT = process.env.E2E_FRONTEND_PORT || '4174';
const E2E_BASE_URL = process.env.E2E_BASE_URL || `http://${E2E_HOST}:${E2E_FRONTEND_PORT}`;
const E2E_API_ORIGIN = process.env.E2E_API_BASE_URL
  ? process.env.E2E_API_BASE_URL.replace(/\/api\/v1\/?$/, '')
  : `http://${E2E_HOST}:${process.env.E2E_BACKEND_PORT || '8002'}`;

async function globalSetup() {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  async function authenticate() {
    const api = await request.newContext({ baseURL: E2E_API_ORIGIN });

    try {
      console.log('[chromium] Authenticating via API...');
      const loginResponse = await api.post('/api/v1/auth/login', {
        data: {
          email: 'admin@kort.local',
          password: 'demo1234',
        },
      });
      const loginText = await loginResponse.text();
      if (!loginResponse.ok()) {
        throw new Error(`Login failed with ${loginResponse.status()}: ${loginText}`);
      }

      const session = JSON.parse(loginText) as {
        access: string;
        refresh: string;
        user: {
          id: string;
          full_name: string;
          email: string;
          phone?: string | null;
          avatar_url?: string | null;
          status?: string;
          is_owner?: boolean;
          employee_permissions?: string[];
          account_status?: string;
        };
        org: {
          id: string;
          name: string;
          slug: string;
          mode: 'basic' | 'advanced' | 'industrial';
          currency: string;
          onboarding_completed?: boolean;
        } | null;
        capabilities: string[];
        role: 'owner' | 'admin' | 'manager' | 'viewer';
        membership: {
          companyId: string | null;
          companyName: string | null;
          companySlug: string | null;
          status: 'none' | 'pending' | 'active' | 'rejected';
          role: 'owner' | 'admin' | 'manager' | 'viewer' | null;
          source: 'company_registration' | 'employee_registration' | 'invite' | 'request' | 'manual' | null;
          requestId?: string | null;
          inviteToken?: string | null;
          joinedAt?: string | null;
          updatedAt?: string | null;
        };
      };

      const sanitizedState: StorageState = {
        cookies: [],
        origins: [
          {
            origin: E2E_BASE_URL,
            localStorage: [
              {
                name: 'kort-pin',
                value: JSON.stringify({ state: { pin: null, isTrustedDevice: true }, version: 0 }),
              },
              {
                name: 'kort-ui',
                value: JSON.stringify({ state: { sidebarCollapsed: false, focusMode: false }, version: 0 }),
              },
              {
                name: 'kort-auth',
                value: JSON.stringify({
                  state: {
                    user: session.user,
                    org: session.org,
                    token: session.access,
                    refreshToken: session.refresh,
                    role: session.role,
                    capabilities: session.capabilities,
                    membership: session.membership,
                    inviteContext: null,
                    userOrgs: session.org ? [{
                      id: session.org.id,
                      name: session.org.name,
                      slug: session.org.slug,
                      mode: session.org.mode,
                      currency: session.org.currency,
                      onboarding_completed: session.org.onboarding_completed,
                      role: session.role,
                    }] : [],
                    selectedOrgId: null,
                    isUnlocked: true,
                  },
                  version: 0,
                }),
              },
              {
                name: 'kort.workspace:intro-v1',
                value: '1',
              },
            ],
          },
        ],
      };

      for (const browserName of ['chromium', 'firefox', 'webkit'] as const) {
        const stateFile = path.join(authDir, `${browserName}.json`);
        fs.writeFileSync(stateFile, JSON.stringify(sanitizedState, null, 2));
        console.log(`[${browserName}] Saved auth state to ${stateFile}`);
      }
    } catch (error) {
      console.error('[chromium] Global setup failed:', error);
      throw new Error('Failed to authenticate during global setup');
    } finally {
      await api.dispose();
    }
  }

  await authenticate();
}

export default globalSetup;
