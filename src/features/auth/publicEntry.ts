export const PUBLIC_AUTH_SOURCE_PARAM = 'from';

export type PublicAuthSource = 'landing' | 'invite' | 'reset-password';

export function buildPublicAuthPath(
  path: '/auth/login' | '/auth/register',
  source: PublicAuthSource,
) {
  const params = new URLSearchParams({
    [PUBLIC_AUTH_SOURCE_PARAM]: source,
  });

  return `${path}?${params.toString()}`;
}

export function hasPublicAuthSource(search: string, allowed: readonly PublicAuthSource[]) {
  const source = new URLSearchParams(search).get(PUBLIC_AUTH_SOURCE_PARAM);
  return source !== null && allowed.includes(source as PublicAuthSource);
}
