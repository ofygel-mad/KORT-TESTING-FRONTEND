import type {
  InviteContext,
  Membership,
  MembershipRole,
  Org,
  OrgSummary,
  User,
} from '../stores/auth';

export type EmployeePermission =
  | 'full_access'
  | 'financial_report'
  | 'sales'
  | 'production'
  | 'warehouse_manager'
  | 'observer'
  | 'chapan_full_access'
  | 'chapan_access_orders'
  | 'chapan_access_production'
  | 'chapan_access_ready'
  | 'chapan_access_archive'
  | 'chapan_access_warehouse_nav'
  | 'chapan_manage_production'
  | 'chapan_confirm_invoice'
  | 'chapan_warehouse_operator'
  | 'chapan_shipping'
  | 'chapan_manage_settings';

export type EmployeeAccountStatus = 'active' | 'pending_first_login' | 'dismissed';

export interface EmployeeRecord {
  id: string;
  full_name: string;
  phone: string;
  department: string;
  permissions: EmployeePermission[];
  account_status: EmployeeAccountStatus;
  added_by_id: string;
  added_by_name: string;
  created_at: string;
}

export interface CreateEmployeePayload {
  phone: string;
  full_name: string;
  department: string;
  permissions: EmployeePermission[];
}

export interface UpdateEmployeePayload {
  department?: string;
  permissions?: EmployeePermission[];
}

export interface FirstLoginResponse {
  requires_password_setup: true;
  temp_token: string;
  user: {
    id: string;
    full_name: string;
    phone: string;
  };
}

export type LoginApiResponse = AuthSessionResponse | FirstLoginResponse;

export function isFirstLoginResponse(value: LoginApiResponse | null): value is FirstLoginResponse {
  return Boolean(value && (value as FirstLoginResponse).requires_password_setup === true);
}

export interface AuthSessionResponse {
  access: string;
  refresh: string;
  user: User;
  org: Org | null;
  capabilities: string[];
  role: MembershipRole | 'viewer';
  membership: Membership;
  onboarding_completed?: boolean;
  orgs?: OrgSummary[];
}

export interface CompanyDirectoryItem extends Org {
  industry?: string;
}

export interface TeamMemberResponse {
  id: string;
  full_name: string;
  email: string;
  status: string;
  role?: MembershipRole | 'viewer';
}

export interface InviteRecord extends InviteContext {
  created_at: string;
  created_by: string;
  share_url: string;
  status: 'valid' | 'used' | 'expired';
}

export interface MembershipRequestRecord {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  company_id: string;
  company_name: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_role: MembershipRole;
  created_at: string;
}

export interface MembershipRequestSubmissionResponse {
  request: MembershipRequestRecord;
  membership: Membership;
}
