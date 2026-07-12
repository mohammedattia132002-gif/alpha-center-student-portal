const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabicNumerals(str: string): string {
  return str.replace(/\d/g, (d) => ARABIC_DIGITS[parseInt(d)]);
}

const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export function formatArabicDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return dateStr;
  return `${DAY_NAMES[date.getDay()]}، ${toArabicNumerals(String(date.getDate()))} ${MONTH_NAMES[date.getMonth()]} ${toArabicNumerals(String(date.getFullYear()))}`;
}

export function formatArabicDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return dateStr;
  const dd = toArabicNumerals(String(date.getDate()).padStart(2, '0'));
  const mm = toArabicNumerals(String(date.getMonth() + 1).padStart(2, '0'));
  const yyyy = toArabicNumerals(String(date.getFullYear()));
  return `${dd} / ${mm} / ${yyyy}`;
}

export function getArabicDayName(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return '';
  return DAY_NAMES[date.getDay()];
}

export function formatArabicTime(timeStr: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0]);
  const m = parseInt(parts[1]);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const period = h >= 12 ? 'مساءً' : 'صباحًا';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return `${toArabicNumerals(String(hour12))}:${toArabicNumerals(String(m).padStart(2, '0'))} ${period}`;
}
