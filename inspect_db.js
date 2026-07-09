import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mvsmckblqozlicsrragc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12c21ja2JscW96bGljc3JyYWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTc1MDEsImV4cCI6MjA4NjM3MzUwMX0.CnsA4Fzl8NlcSHC4AM7BQE0WpPhYkRb0lwkIoaFAfPw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const studentId = '5e29b308-a2e2-4bde-9c52-d7ce6fb6afd2';
  console.log(`\nQuerying records for بسملة عطية الخضري (ID: ${studentId})`);
  
  // Attendance
  const { data: attendance, error: attError } = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', studentId);
    
  if (attError) console.error('Attendance error:', attError);
  else console.log(`Attendance records count: ${attendance.length}`, attendance.slice(0, 5));
  
  // Payments
  const { data: payments, error: payError } = await supabase
    .from('payments')
    .select('*')
    .eq('student_id', studentId);
    
  if (payError) console.error('Payments error:', payError);
  else console.log(`Payments records count: ${payments.length}`, payments.slice(0, 5));
  
  // Grades
  const { data: grades, error: gradeError } = await supabase
    .from('grades')
    .select('*')
    .eq('student_id', studentId);
    
  if (gradeError) console.error('Grades error:', gradeError);
  else console.log(`Grades records count: ${grades.length}`, grades.slice(0, 5));
}

run();
