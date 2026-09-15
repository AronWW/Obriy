export interface ClassSummary {
  id: string
  name: string
  studentCount: number
  createdAt: string
  updatedAt: string
}

export interface ClassInvite {
  code: string
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
}

export interface ClassmateProfile extends ClassMember {
  bio: string | null
  gamification: GamificationProfile
}

export interface CreateClassInput {
  name: string
}
import type { GamificationProfile } from '../../gamification/model/gamification.types'
