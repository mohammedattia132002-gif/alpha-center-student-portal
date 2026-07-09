export type PortalDataSource = 'live' | 'cache' | 'snapshot' | 'local';

export interface CacheEntry<T> {
  at: number;
  data: T;
}

export interface PortalDataFreshness {
  source: PortalDataSource;
  updatedAt: number | null;
  isStale: boolean;
}

const FRESHNESS_WINDOW_MS = 1000 * 60 * 30;

export function readCacheEntry<T>(key: string): CacheEntry<T> | null {
  try {
    const rawValue = window.localStorage.getItem(`portal_cache_${key}`);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<CacheEntry<T>>;
    if (typeof parsedValue.at !== 'number' || !('data' in parsedValue)) {
      return null;
    }

    return {
      at: parsedValue.at,
      data: parsedValue.data as T,
    };
  } catch {
    return null;
  }
}

export function getPortalDataFreshness(
  key: string,
  source: PortalDataSource = 'cache',
): PortalDataFreshness | null {
  const cacheEntry = readCacheEntry<unknown>(key);
  if (!cacheEntry) {
    return null;
  }

  return {
    source,
    updatedAt: cacheEntry.at,
    isStale: Date.now() - cacheEntry.at > FRESHNESS_WINDOW_MS,
  };
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
