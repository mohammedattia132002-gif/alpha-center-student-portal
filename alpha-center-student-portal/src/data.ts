import type {
  StudentProfile,
  AttendanceRecord,
  PaymentRecord,
  GradeRecord,
  Exam,
} from './types/domain';

export const initialStudentProfile: StudentProfile = {
  id: "STD-2026-9041",
  tenantId: "af975d96-5310-48b8-a5df-f88518ef0557",
  name: "محمد أحمد عطية",
  studentCode: "2026110904",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256-h=256",
  gradeLevel: "الصف الثالث الثانوي",
  balance: 1200,
  billingType: "monthly",
  isActive: true,
  phone: "01011223344",
  parentPhone: "01234567890",
  registrationDate: "2024-09-01",
  school: "سنتر الألفا",
  group: {
    id: "group-1",
    name: "شعبة علمي رياضة",
    subject: "الرياضيات",
    teacherName: "الأستاذ/ محمد عطية",
  },
};

export const initialAttendanceRecords: AttendanceRecord[] = [
  {
    id: "att-001",
    date: "2026-05-24",
    subject: "الرياضيات البحتة (التفاضل والتكامل)",
    time: "09:00 ص - 11:00 ص",
    status: "present",
    lecturer: "الأستاذ/ محمد عطية",
    notes: "حضور مبكر وتفاعل متميز أثناء المحاضرة وحل المتفوقين",
  },
  {
    id: "att-002",
    date: "2026-05-22",
    subject: "الجبر والهندسة الفراغية",
    time: "10:00 ص - 12:00 م",
    status: "present",
    lecturer: "الأستاذ/ محمد عطية",
  },
  {
    id: "att-003",
    date: "2026-05-20",
    subject: "الفيزياء الكهربائية",
    time: "01:00 م - 03:00 م",
    status: "late",
    lecturer: "الأستاذ/ محمد عطية",
    notes: "تأخر 10 دقائق",
  },
];

export const initialPaymentRecords: PaymentRecord[] = [
  {
    id: "pay-104",
    amount: 1200,
    status: "pending",
    title: "اشتراك المراجعة النهائية المكثفة وبنك الأسئلة السنوي",
    receiptNo: "INV-2026-448",
  },
  {
    id: "pay-105",
    amount: 120,
    status: "pending",
    title: "رسوم ملازم ومطبوعات مادة الفيزياء (مستعجل)",
    receiptNo: "INV-2026-120",
  },
  {
    id: "pay-106",
    amount: 450,
    status: "paid",
    paidAt: "2026-05-19",
    title: "رسوم مراجعات شهر مايو",
    receiptNo: "INV-2026-301",
  },
];

export const initialGradeRecords: GradeRecord[] = [
  {
    id: "grd-201",
    subject: "الرياضيات البحتة (التفاضل)",
    score: 95,
    maxScore: 100,
    percentage: 95,
    letterGrade: "A+",
    date: "2026-05-10",
    type: "final",
    notes: "أداء متميز في اختبار التفاضل والتكامل وسرعة بديهة استثنائية.",
  },
  {
    id: "grd-202",
    subject: "الجبر والهندسة الفراغية",
    score: 88,
    maxScore: 100,
    percentage: 88,
    letterGrade: "A-",
    date: "2026-05-12",
    type: "final",
    notes: "جهد رائع في تحليل الفراغ الثلاثي والمحددات وتحقيق درجة ممتازة.",
  },
  {
    id: "grd-203",
    subject: "الديناميكا والاستاتيكا",
    score: 45,
    maxScore: 50,
    percentage: 90,
    letterGrade: "A",
    date: "2026-05-15",
    type: "midterm",
    notes: "استيعاب متميز لمفهوم المحصلة وقوانين نيوتن للحركة الدائرية.",
  },
  {
    id: "grd-204",
    subject: "الفيزياء الكهربائية والحديثة",
    score: 38,
    maxScore: 50,
    percentage: 76,
    letterGrade: "C+",
    date: "2026-05-18",
    type: "midterm",
    notes: "أداء ناضج في مسائل كيرشوف والفيزياء الكهربائية.",
  },
];

export const examsData: Exam[] = [
  {
    id: "ex-301",
    title: "اختبار التفاضل والتكامل والاشتقاق الدوري",
    subject: "الرياضيات البحتة",
    durationMinutes: 10,
    totalPoints: 25,
    questions: [
      {
        id: "ex301_q1",
        text: "ما هي قيمة نها (س² - 4) / (س - 2) عندما تقترب س من 2؟",
        options: [
          { id: "a", text: "2" },
          { id: "b", text: "4" },
          { id: "c", text: "0" },
          { id: "d", text: "غير معرفة" },
        ],
        correctOptionId: "b",
        points: 5,
        explanation: "بالتحليل في البسط كفرق بين مربعين: (س - 2)(س + 2) ثم الاختصار والتعويض المباشر بـ س=2 يعطينا: 2 + 2 = 4.",
      },
      {
        id: "ex301_q2",
        text: "إذا كانت ص = جا(2س)، فإن دص / دس عند س = 0 تساوي:",
        options: [
          { id: "a", text: "0" },
          { id: "b", text: "1" },
          { id: "c", text: "2" },
          { id: "d", text: "-2" },
        ],
        correctOptionId: "c",
        points: 5,
        explanation: "مشتقة جا(دالتين) هي دص/دس = 2 جتا(2س). عند س=0، تصبح 2 جتا(0) = 2 × 1 = 2.",
      },
      {
        id: "ex301_q3",
        text: "قيمة محدد المصفوفة ثنائية الأبعاد |[3, 4], [2, 5]| تساوي:",
        options: [
          { id: "a", text: "7" },
          { id: "b", text: "23" },
          { id: "c", text: "12" },
          { id: "d", text: "-7" },
        ],
        correctOptionId: "a",
        points: 5,
        explanation: "طريقة فك محدد المصفوفة الثنائية: حاصل ضرب عناصر القطر الرئيسي مطروحاً منه القطر الفرعي: (3 × 5) - (4 × 2) = 15 - 8 = 7.",
      },
    ],
    instructions: [
      "احرص على استخدام ورقة مسودة وقلم لتنفيذ خطوات الحل الرياضية بدقة.",
      "عند الضغط على 'بدء الاختبار'، سيبدأ المؤقت ولن تتمكن من إيقافه.",
    ],
    passingScorePercent: 60,
    status: "available",
  },
];
