export const authEvents = {
  sessionsRevoked: 'auth.sessions.revoked',
} as const;

export type SessionsRevokedEvent = {
  userId: string;
};
