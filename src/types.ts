export interface Student {
  id: string;
  student_code: string;
  tenant_id?: string;
  name: string;
  phone?: string | null;
  parent_phone?: string | null;
  grade_level?: string;
  group_id?: string | null;
  group_name?: string | null;
  balance?: number | null;
  is_active?: boolean;
}

export interface Attendance {
  id: string;
  tenant_id?: string;
  student_id?: string;
  date?: string;
  attendance_date?: string;
  status: string;
}

export interface Grade {
  id: string;
  tenant_id?: string;
  student_id: string;
  student_name?: string;
  subject: string;
  grade_level?: string;
  type?: string;
  score: number;
  max_score: number;
  assessment_date: string;
  remarks?: string;
}

export interface Payment {
  id: string;
  tenant_id?: string;
  student_id: string;
  amount: number;
  paid_at?: string | null;
  timestamp?: string | null;
  date?: string | null;
  status?: string;
  method?: string | null;
  payment_method?: string | null;
  payment_type?: string | null;
  required_amount?: number | null;
  month_key?: string | null;
  receipt_no?: string;
  idempotency_key?: string | null;
  notes?: string | null;
  deleted_at?: string | null;
}

export interface PlatformExam {
  id: string;
  tenant_id?: string;
  title: string;
  description?: string;
  grade_level?: string;
  subject?: string;
  max_score: number;
  duration_minutes: number;
  active?: boolean;
  exam_url?: string;
  allowed_groups?: unknown;
}

export interface PlatformQuestion {
  id: string;
  tenant_id?: string;
  exam_id: string;
  question_text: string;
  image_url?: string;
  image_storage_path?: string | null;
  points: number;
  order_index: number;
  question_type?: 'mcq' | 'numeric' | string | null;
  answer_style?: string | null;
  correct_answer?: string | null;
  numeric_tolerance?: number | null;
  page_number?: number | null;
}

export interface PlatformChoice {
  id: string;
  tenant_id?: string;
  question_id: string;
  choice_text: string;
  is_correct: boolean;
  order_index: number;
}

export interface ExamAttempt {
  id: string;
  tenant_id?: string;
  student_id: string;
  exam_id: string;
  status: 'in_progress' | 'completed' | 'terminated' | 'timed_out';
  warnings_count: number;
  started_at: string;
  finished_at?: string;
  final_score?: number;
}

export interface ExamAnswer {
  id: string;
  tenant_id?: string;
  attempt_id: string;
  question_id: string;
  selected_choice_id?: string | null;
  selected_answer_text?: string | null;
  is_correct?: boolean;
}

export interface PlatformResult {
  id: string;
  tenant_id?: string;
  student_id: string;
  student_name?: string;
  exam_id: string;
  exam_title?: string;
  score: number;
  max_score: number;
  assessment_date?: string;
  subject?: string;
  grade_level?: string;
  correct_answers_count?: number | null;
  wrong_answers_count?: number | null;
  unanswered_answers_count?: number | null;
}
