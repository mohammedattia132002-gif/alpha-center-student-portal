import assert from 'node:assert/strict';
import { fetchAllRows } from '../src/lib/supabasePagination.ts';

function createPagedSupabaseClient(rowsByTable) {
  const calls = [];

  return {
    calls,
    from(tableName) {
      return {
        select(columns) {
          const filters = [];
          const query = {
            eq(column, value) {
              filters.push({ op: 'eq', column, value });
              return query;
            },
            is(column, value) {
              filters.push({ op: 'is', column, value });
              return query;
            },
            order(column, options) {
              filters.push({ op: 'order', column, options });
              return query;
            },
            range(from, to) {
              calls.push({ tableName, columns, filters: [...filters], from, to });
              const tableRows = rowsByTable[tableName] ?? [];
              return Promise.resolve({
                data: tableRows.slice(from, to + 1),
                error: null,
              });
            },
          };
          return query;
        },
      };
    },
  };
}

function makeRows(count, prefix) {
  return Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index + 1}` }));
}

async function expectFetchesEveryPage(tableName, rowCount, expectedRanges) {
  const client = createPagedSupabaseClient({ [tableName]: makeRows(rowCount, tableName) });
  const rows = await fetchAllRows(client, tableName, (query) => query.eq('tenant_id', 'tenant-1'), 1000);

  assert.equal(rows.length, rowCount, `${tableName} should return every row`);
  assert.deepEqual(
    client.calls.map(({ from, to }) => [from, to]),
    expectedRanges,
    `${tableName} should request every Supabase page in order`,
  );
  if (rowCount > 0) {
    assert.equal(rows[0]?.id, `${tableName}-1`);
    assert.equal(rows.at(-1)?.id, `${tableName}-${rowCount}`);
  }
}

await expectFetchesEveryPage('attendance', 2505, [[0, 999], [1000, 1999], [2000, 2999]]);
await expectFetchesEveryPage('payments', 2000, [[0, 999], [1000, 1999], [2000, 2999]]);
await expectFetchesEveryPage('grades', 1001, [[0, 999], [1000, 1999]]);
await expectFetchesEveryPage('platform_exams', 0, [[0, 999]]);
await expectFetchesEveryPage('platform_questions', 3456, [[0, 999], [1000, 1999], [2000, 2999], [3000, 3999]]);
await expectFetchesEveryPage('platform_choices', 999, [[0, 999]]);

console.log('✅ Portal pagination pressure passed: all rows are fetched across Supabase 1000-row pages.');
