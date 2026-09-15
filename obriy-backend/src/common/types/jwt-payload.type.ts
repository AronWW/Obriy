import { UserRole, UserStatus } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  sessionVersion?: number;
};
