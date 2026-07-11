import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const tenantId = env.VITE_TENANT_ID || env.VITE_DEV_BYPASS_TENANT_ID || 'af975d96-5310-48b8-a5df-f88518ef0557';
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const students = [
  'f799aa33-0f25-4671-a1ec-1538adcbcf17',
  '98f0e2aa-4268-49a4-b54a-eb2b9369cfba',
];

for (const studentId of students) {
  const counts = { studentId };
  for (const tableName of ['attendance', 'payments', 'grades']) {
    const { count, error } = await supabase
      .from(tableName)
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('student_id', studentId)
      .is('deleted_at', null);
    counts[tableName] = error ? { error } : count;
  }
  console.log(JSON.stringify(counts));
}

const { count: platformExamCount, error: platformExamError } = await supabase
  .from('platform_exams')
  .select('id', { count: 'exact', head: true })
  .eq('tenant_id', tenantId)
  .eq('active', true)
  .is('deleted_at', null);
console.log(JSON.stringify({ platform_exams: platformExamError ? { error: platformExamError } : platformExamCount }));
