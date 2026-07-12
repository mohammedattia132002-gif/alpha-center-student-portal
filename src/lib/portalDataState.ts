export type PortalDataSource = 'live';

export interface PortalDataFreshness {
  source: PortalDataSource;
  updatedAt: number | null;
  isStale: boolean;
}

export function formatFreshnessTimestamp(timestamp: number | null): string {
  if (!timestamp) {
    return 'غير معروف';
  }

  try {
    return new Intl.DateTimeFormat('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}
