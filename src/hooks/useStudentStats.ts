import { useMemo } from 'react'
import { AttendanceRecord, GradeRecord } from '../types'

export interface StudentStats {
  attendanceRate: number
  attendanceRateDisplay: string
  commitmentStatus: { label: string; emoji: string }
  latestGrade: GradeRecord | null
  latestGradePercent: number
  latestGradeDisplay: string
  hasData: boolean
}

export function calculateAttendanceRate(attendance: AttendanceRecord[]): number {
  if (attendance.length === 0) {
    return 0
  }

  // المتأخر (حضر فعلاً) يُحتسب في نسبة الانتظام تماماً كالحاضر
  const attended = attendance.filter(
    (record) => record.status === 'present' || record.status === 'late'
  ).length
  return Math.round((attended / attendance.length) * 1000) / 10
}

function getCommitmentStatus(rate: number): { label: string; emoji: string } {
  if (rate >= 95) return { label: 'ممتاز', emoji: '⭐' }
  if (rate >= 90) return { label: 'نشط', emoji: '🚀' }
  if (rate >= 80) return { label: 'جيد', emoji: '💵' }
  if (rate >= 70) return { label: 'يحتاج متابعة', emoji: '🟠' }
  return { label: 'إنذار', emoji: '🔴' }
}

export function useStudentStats(attendance: AttendanceRecord[], grades: GradeRecord[]): StudentStats {
  return useMemo(() => {
    const attendanceRate = calculateAttendanceRate(attendance)
    const hasData = attendance.length > 0
    const attendanceRateDisplay = hasData
      ? `${attendanceRate.toFixed(1)}%`
      : 'لا توجد بيانات بعد'

    const latestGrade = grades.length === 0
      ? null
      : [...grades].sort((a, b) => {
          const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
          if (timeDiff !== 0) {
            return timeDiff
          }
          return b.id.localeCompare(a.id)
        })[0]

    const latestGradePercent = latestGrade && latestGrade.maxScore > 0
      ? Math.round((latestGrade.score / latestGrade.maxScore) * 100)
      : 0

    const latestGradeDisplay = latestGrade
      ? `${latestGrade.score} / ${latestGrade.maxScore}`
      : 'لا توجد درجات مسجلة'

    return {
      attendanceRate,
      attendanceRateDisplay,
      commitmentStatus: getCommitmentStatus(attendanceRate),
      latestGrade,
      latestGradePercent,
      latestGradeDisplay,
      hasData,
    }
  }, [attendance, grades])
}
