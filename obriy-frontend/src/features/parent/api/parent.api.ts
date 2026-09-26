import { authorizedRequest } from '../../auth/model/session.service'
import type {
  LinkedChild,
  ParentChildOverview,
  ParentChildProgress,
  ParentDashboard,
  ParentLessonProgress,
} from '../model/parent.types'
import type { StudentLessonTest, StudentTestAttempt } from '../../tests/model/test.types'

export const parentApi = {
  getLinkedChildren: () =>
    authorizedRequest<LinkedChild[]>('/users/me/children'),
  getDashboard: () => authorizedRequest<ParentDashboard>('/parent/dashboard'),
  getChildOverview: (childId: string) =>
    authorizedRequest<ParentChildOverview>(
      `/parent/children/${childId}/overview`,
    ),
  getChildProgress: (childId: string) =>
    authorizedRequest<ParentChildProgress>(
      `/parent/children/${childId}/progress`,
    ),
  getChildLesson: (childId: string, lessonId: string) =>
    authorizedRequest<ParentLessonProgress>(
      `/parent/children/${childId}/lessons/${lessonId}`,
    ),
  getChildTestRelease: (childId: string, releaseId: string) =>
    authorizedRequest<StudentLessonTest>(
      `/parent/children/${childId}/test-releases/${releaseId}`,
    ),
  getChildTestAttempt: (childId: string, attemptId: string) =>
    authorizedRequest<StudentTestAttempt>(
      `/parent/children/${childId}/test-attempts/${attemptId}`,
    ),
}
