import { authorizedRequest } from '../../auth/model/session.service'
import type {
  ClassInvite,
  ClassmateProfile,
  ClassMember,
  ClassSummary,
  CreatedClass,
  CreateClassInput,
  StudentClass,
} from '../model/class.types'

export function listTeacherClasses(): Promise<ClassSummary[]> {
  return authorizedRequest<ClassSummary[]>('/classes')
}

export function createTeacherClass(
  input: CreateClassInput,
): Promise<CreatedClass> {
  return authorizedRequest<CreatedClass>('/classes', {
    method: 'POST',
    body: input,
  })
}

export function getTeacherClass(classId: string): Promise<ClassSummary> {
  return authorizedRequest<ClassSummary>(`/classes/${classId}`)
}

export function updateTeacherClass(
  classId: string,
  input: CreateClassInput,
): Promise<ClassSummary> {
  return authorizedRequest<ClassSummary>(`/classes/${classId}`, {
    method: 'PATCH',
    body: input,
  })
}

export function listTeacherClassMembers(
  classId: string,
): Promise<ClassMember[]> {
  return authorizedRequest<ClassMember[]>(`/classes/${classId}/members`)
}

export function getClassInvite(classId: string): Promise<ClassInvite> {
  return authorizedRequest<ClassInvite>(`/classes/${classId}/invite`)
}

export function getStudentClass(): Promise<StudentClass | null> {
  return authorizedRequest<StudentClass | null>('/classes/me')
}

export function listClassmates(): Promise<ClassMember[]> {
  return authorizedRequest<ClassMember[]>('/classes/me/classmates')
}

export function joinClass(code: string): Promise<StudentClass> {
  return authorizedRequest<StudentClass>('/classes/join', {
    method: 'POST',
    body: { code },
  })
}

export function getClassmateProfile(
  studentId: string,
): Promise<ClassmateProfile> {
  return authorizedRequest<ClassmateProfile>(
    `/classes/classmates/${studentId}`,
  )
}
