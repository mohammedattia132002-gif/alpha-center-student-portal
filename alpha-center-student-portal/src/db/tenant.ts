const PERSONAL_TENANT_ID = 'af975d96-5310-48b8-a5df-f88518ef0557';

function normalizeTenantId(value: unknown): string {
  const token = String(value ?? '').trim();
  if (!token || token === 'CENTER_1' || token === 'default') return PERSONAL_TENANT_ID;
  return token;
}

export const portalTenantId = normalizeTenantId(
  (import.meta as any).env?.VITE_TENANT_ID || (import.meta as any).env?.VITE_DEV_BYPASS_TENANT_ID,
);
