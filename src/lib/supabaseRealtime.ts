import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type RealtimeRecord = Record<string, unknown>;

export type TableRealtimeHandlers = {
  table: string;
  filter?: string;
  onInsert?: (payload: { eventType: 'INSERT'; new: RealtimeRecord; old: RealtimeRecord }) => void;
  onUpdate?: (payload: { eventType: 'UPDATE'; new: RealtimeRecord; old: RealtimeRecord }) => void;
  onDelete?: (payload: { eventType: 'DELETE'; new: RealtimeRecord; old: RealtimeRecord }) => void;
};

function asRecord(value: unknown): RealtimeRecord {
  return value && typeof value === 'object' ? (value as RealtimeRecord) : {};
}

export function getRealtimeRecordId(value: unknown): string {
  return String(asRecord(value).id || '').trim();
}

export function isSoftDeleted(value: unknown): boolean {
  const row = asRecord(value);
  return String(row.deleted_at || row.deletedAt || '').trim() !== '';
}

export function upsertListRow<T extends { id: string }>(
  items: T[],
  nextItem: T,
  sortFn?: (a: T, b: T) => number,
): T[] {
  const nextId = String(nextItem.id || '').trim();
  if (!nextId) return items;

  const withoutCurrent = items.filter((item) => String(item.id || '').trim() !== nextId);
  const merged = [nextItem, ...withoutCurrent];
  return sortFn ? [...merged].sort(sortFn) : merged;
}

export function removeListRowById<T extends { id: string }>(items: T[], id: string): T[] {
  const targetId = String(id || '').trim();
  if (!targetId) return items;
  return items.filter((item) => String(item.id || '').trim() !== targetId);
}

export function createRealtimeChannel(
  channelName: string,
  handlers: TableRealtimeHandlers[],
): RealtimeChannel {
  const channel = supabase.channel(channelName);

  for (const handler of handlers) {
    const baseConfig = {
      schema: 'public' as const,
      table: handler.table,
      ...(handler.filter ? { filter: handler.filter } : {}),
    };

    if (handler.onInsert) {
      channel.on('postgres_changes', { event: 'INSERT', ...baseConfig }, (payload) => {
        handler.onInsert?.({
          eventType: 'INSERT',
          new: asRecord((payload as { new?: unknown }).new),
          old: asRecord((payload as { old?: unknown }).old),
        });
      });
    }

    if (handler.onUpdate) {
      channel.on('postgres_changes', { event: 'UPDATE', ...baseConfig }, (payload) => {
        handler.onUpdate?.({
          eventType: 'UPDATE',
          new: asRecord((payload as { new?: unknown }).new),
          old: asRecord((payload as { old?: unknown }).old),
        });
      });
    }

    if (handler.onDelete) {
      channel.on('postgres_changes', { event: 'DELETE', ...baseConfig }, (payload) => {
        handler.onDelete?.({
          eventType: 'DELETE',
          new: asRecord((payload as { new?: unknown }).new),
          old: asRecord((payload as { old?: unknown }).old),
        });
      });
    }
  }

  channel.subscribe();
  return channel;
}

export function cleanupRealtimeChannel(channel: RealtimeChannel | null | undefined): void {
  if (!channel) return;
  void supabase.removeChannel(channel);
}
