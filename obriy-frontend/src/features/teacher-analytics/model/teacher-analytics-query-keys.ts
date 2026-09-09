export const teacherAnalyticsQueryKeys = {
  all: ['teacher-analytics'] as const,
  class: (classId: string) =>
    [...teacherAnalyticsQueryKeys.all, 'class', classId] as const,
  student: (classId: string, studentId: string) =>
    [
      ...teacherAnalyticsQueryKeys.class(classId),
      'student',
      studentId,
    ] as const,
}
