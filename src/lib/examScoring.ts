import { PlatformChoice, PlatformExam, PlatformQuestion } from '../types';

export interface ExamResponseMap {
  choiceAnswers: Record<string, string>;
  textAnswers: Record<string, string>;
}

export interface QuestionEvaluation {
  questionId: string;
  questionType: 'mcq' | 'numeric';
  maxPoints: number;
  awardedPoints: number;
  isAnswered: boolean;
  isCorrect: boolean;
  selectedChoiceId: string | null;
  selectedAnswerText: string | null;
}

export interface ExamSummary {
  score: number;
  maxScore: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  evaluations: QuestionEvaluation[];
}

type QuestionWithChoices = PlatformQuestion & { choices?: PlatformChoice[] };

const ARABIC_DIGIT_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

const normalizeDigits = (value: string): string =>
  String(value || '')
    .split('')
    .map((char) => ARABIC_DIGIT_MAP[char] ?? char)
    .join('');

const normalizeAnswerToken = (value: string | null | undefined): string =>
  normalizeDigits(String(value || ''))
    .replace(/[٬،]/g, ',')
    .replace(/٫/g, '.')
    .replace(/\s+/g, ' ')
    .trim();

const parseNumericToken = (value: string | null | undefined): number | null => {
  const token = normalizeAnswerToken(value).replace(/,/g, '.');
  if (!token) return null;
  const parsed = Number(token);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveQuestionType = (question: QuestionWithChoices): 'mcq' | 'numeric' => {
  const explicitType = String(question.question_type || '').trim().toLowerCase();
  if (explicitType === 'numeric') return 'numeric';
  if (explicitType === 'mcq') return 'mcq';
  return Array.isArray(question.choices) && question.choices.length > 0 ? 'mcq' : 'numeric';
};

const resolveQuestionPoints = (question: QuestionWithChoices): number =>
  Math.max(1, Number(question.points) || 1);

const resolveExamMaxScore = (exam: PlatformExam, questions: QuestionWithChoices[]): number => {
  const derived = questions.reduce((sum, question) => sum + resolveQuestionPoints(question), 0);
  if (derived > 0) return derived;
  return Math.max(1, Number(exam.max_score) || 1);
};

const isMcqAnswerCorrect = (question: QuestionWithChoices, selectedChoiceId: string | null): boolean => {
  if (!selectedChoiceId) return false;
  const choices = Array.isArray(question.choices) ? question.choices : [];
  const selectedChoice = choices.find((choice) => choice.id === selectedChoiceId);
  if (!selectedChoice) return false;
  if (selectedChoice.is_correct === true) return true;

  const normalizedCorrectAnswer = normalizeAnswerToken(question.correct_answer);
  if (!normalizedCorrectAnswer) return false;

  return normalizeAnswerToken(selectedChoice.choice_text) === normalizedCorrectAnswer;
};

const isNumericAnswerCorrect = (question: QuestionWithChoices, selectedAnswerText: string | null): boolean => {
  const answerToken = normalizeAnswerToken(selectedAnswerText);
  if (!answerToken) return false;

  const expectedNumeric = parseNumericToken(question.correct_answer);
  const actualNumeric = parseNumericToken(selectedAnswerText);
  const tolerance = Math.max(0, Number(question.numeric_tolerance) || 0);

  if (expectedNumeric !== null && actualNumeric !== null) {
    return Math.abs(actualNumeric - expectedNumeric) <= tolerance + Number.EPSILON;
  }

  return answerToken === normalizeAnswerToken(question.correct_answer);
};

export const evaluateQuestion = (
  question: QuestionWithChoices,
  response: { selectedChoiceId?: string | null; selectedAnswerText?: string | null },
): QuestionEvaluation => {
  const questionType = resolveQuestionType(question);
  const maxPoints = resolveQuestionPoints(question);
  const selectedChoiceId = String(response.selectedChoiceId || '').trim() || null;
  const selectedAnswerText = normalizeAnswerToken(response.selectedAnswerText) || null;
  const isAnswered = questionType === 'mcq' ? Boolean(selectedChoiceId) : Boolean(selectedAnswerText);
  const isCorrect = questionType === 'mcq'
    ? isMcqAnswerCorrect(question, selectedChoiceId)
    : isNumericAnswerCorrect(question, selectedAnswerText);

  return {
    questionId: question.id,
    questionType,
    maxPoints,
    awardedPoints: isCorrect ? maxPoints : 0,
    isAnswered,
    isCorrect,
    selectedChoiceId,
    selectedAnswerText,
  };
};

export const calculateExamSummary = (
  exam: PlatformExam,
  questions: QuestionWithChoices[],
  responses: ExamResponseMap,
): ExamSummary => {
  const evaluations = questions.map((question) =>
    evaluateQuestion(question, {
      selectedChoiceId: responses.choiceAnswers[question.id],
      selectedAnswerText: responses.textAnswers[question.id],
    }),
  );

  return {
    score: evaluations.reduce((sum, evaluation) => sum + evaluation.awardedPoints, 0),
    maxScore: resolveExamMaxScore(exam, questions),
    correctCount: evaluations.filter((evaluation) => evaluation.isCorrect).length,
    wrongCount: evaluations.filter((evaluation) => evaluation.isAnswered && !evaluation.isCorrect).length,
    unansweredCount: evaluations.filter((evaluation) => !evaluation.isAnswered).length,
    evaluations,
  };
};

export const getQuestionInputMode = (question: QuestionWithChoices): 'mcq' | 'numeric' =>
  resolveQuestionType(question);
