export interface ClassSummary {
  id: string
  name: string
  gradeLevel: number
  studentCount: number
  createdAt: string
  updatedAt: string
  activeInviteExpiresAt: string | null
}

export interface ClassInvite {
  code: string
  expiresAt: string
}

export interface CreatedClass {
  class: ClassSummary
  invite: ClassInvite
}

export interface ClassTeacher {
  id: string
  displayName: string
}

export interface StudentClass extends ClassSummary {
  teacher: ClassTeacher
}

export interface ClassMember {
  id: string
  displayName: string
  avatarUrl: string | null
  gradeLevel: number | null
}

export interface ClassmateProfile extends ClassMember {
  bio: string | null
}

export interface CreateClassInput {
  name: string
  gradeLevel: number
}
