export const SUPABASE_PAGE_SIZE = 1000;

export async function fetchAllRows<T = any>(
  client: any,
  tableName: string,
  configureQuery: (query: any) => any,
  pageSize = SUPABASE_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await configureQuery(client.from(tableName).select('*')).range(from, to);
    if (error) throw error;

    const pageRows = Array.isArray(data) ? data as T[] : [];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}
