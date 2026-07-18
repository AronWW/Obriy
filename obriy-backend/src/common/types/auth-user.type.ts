import { UserRole, UserStatus } from '@prisma/client';

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};
