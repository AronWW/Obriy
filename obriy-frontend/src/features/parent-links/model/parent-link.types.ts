export interface LinkedGuardian {
  id: string
  displayName: string
  avatarUrl: string | null
  linkedAt: string
}

export interface ParentInvitation {
  token: string
  expiresAt: string
}

export interface ActiveParentInvitation {
  expiresAt: string
}

export interface ParentInvitationPreview {
  child: {
    id: string
    displayName: string
    avatarUrl: string | null
  }
  alreadyLinked: boolean
}
