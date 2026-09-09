import { authorizedRequest } from '../../auth/model/session.service'
import type {
  TeacherClassAnalytics,
  TeacherStudentAnalytics,
} from '../model/teacher-analytics.types'

export function getTeacherClassAnalytics(
  classId: string,
): Promise<TeacherClassAnalytics> {
  return authorizedRequest<TeacherClassAnalytics>(
    `/teacher/analytics/classes/${classId}`,
  )
}

export function getTeacherStudentAnalytics(
  classId: string,
  studentId: string,
): Promise<TeacherStudentAnalytics> {
  return authorizedRequest<TeacherStudentAnalytics>(
    `/teacher/analytics/classes/${classId}/students/${studentId}`,
  )
}
