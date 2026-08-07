import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  ClassInviteDto,
  ClassmateProfileDto,
  ClassMemberDto,
  ClassSummaryDto,
  CreatedClassDto,
  StudentClassDto,
} from './dto/class.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_LENGTH = 8;

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async createClass(
    user: AuthUser,
    dto: CreateClassDto,
  ): Promise<CreatedClassDto> {
    this.assertRole(user, UserRole.TEACHER);

    const code = this.generateInviteCode();
    const created = await this.prisma.class.create({
      data: {
        teacherId: user.id,
        name: dto.name.trim(),
        inviteCode: code,
      },
      include: {
        _count: { select: { students: true } },
      },
    });

    return new CreatedClassDto({
      class: this.toClassSummary(created),
      invite: new ClassInviteDto({ code }),
    });
  }

  async listMyClasses(user: AuthUser): Promise<ClassSummaryDto[]> {
    this.assertRole(user, UserRole.TEACHER);
    const classes = await this.prisma.class.findMany({
      where: { teacherId: user.id },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      include: {
        _count: { select: { students: true } },
      },
    });

    return classes.map((classroom) => this.toClassSummary(classroom));
  }

  async findOwnedClass(
    user: AuthUser,
    classId: string,
  ): Promise<ClassSummaryDto> {
    this.assertRole(user, UserRole.TEACHER);
    const classroom = await this.findOwnedClassRecord(user.id, classId);
    return this.toClassSummary(classroom);
  }

  async updateOwnedClass(
    user: AuthUser,
    classId: string,
    dto: UpdateClassDto,
  ): Promise<ClassSummaryDto> {
    this.assertRole(user, UserRole.TEACHER);
    await this.findOwnedClassRecord(user.id, classId);

    const classroom = await this.prisma.class.update({
      where: { id: classId },
      data: {
        name: dto.name?.trim(),
      },
      include: {
        _count: { select: { students: true } },
      },
    });

    return this.toClassSummary(classroom);
  }

  async findInvite(user: AuthUser, classId: string): Promise<ClassInviteDto> {
    this.assertRole(user, UserRole.TEACHER);
    const classroom = await this.findOwnedClassRecord(user.id, classId);
    return new ClassInviteDto({ code: classroom.inviteCode });
  }

  async listOwnedClassMembers(
    user: AuthUser,
    classId: string,
  ): Promise<ClassMemberDto[]> {
    this.assertRole(user, UserRole.TEACHER);
    await this.findOwnedClassRecord(user.id, classId);

    const students = await this.prisma.user.findMany({
      where: { studentClassId: classId, role: UserRole.STUDENT },
      orderBy: [{ profile: { displayName: 'asc' } }, { id: 'asc' }],
      select: {
        id: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
            gradeLevel: true,
          },
        },
      },
    });

    return students.map((student) => this.toClassMember(student));
  }

  async joinClass(user: AuthUser, rawCode: string): Promise<StudentClassDto> {
    this.assertRole(user, UserRole.STUDENT);

    const currentStudent = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { studentClassId: true },
    });

    if (!currentStudent) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    if (currentStudent.studentClassId) {
      throw new ConflictException({
        code: 'STUDENT_ALREADY_IN_CLASS',
        message: 'Student already belongs to a class',
      });
    }

    const classroom = await this.prisma.class.findUnique({
      where: { inviteCode: this.normalizeInviteCode(rawCode) },
      include: {
        teacher: {
          select: {
            id: true,
            profile: { select: { displayName: true } },
          },
        },
        _count: { select: { students: true } },
      },
    });

    if (!classroom) {
      throw new NotFoundException({
        code: 'INVALID_CLASS_INVITE',
        message: 'Invitation code is invalid',
      });
    }

    const updateResult = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        role: UserRole.STUDENT,
        studentClassId: null,
      },
      data: { studentClassId: classroom.id },
    });

    if (updateResult.count !== 1) {
      throw new ConflictException({
        code: 'STUDENT_ALREADY_IN_CLASS',
        message: 'Student already belongs to a class',
      });
    }

    return this.toStudentClass({
      ...classroom,
      _count: { students: classroom._count.students + 1 },
    });
  }

  async findMyClass(user: AuthUser): Promise<StudentClassDto | null> {
    this.assertRole(user, UserRole.STUDENT);

    const student = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        studentClass: {
          include: {
            teacher: {
              select: {
                id: true,
                profile: { select: { displayName: true } },
              },
            },
            _count: { select: { students: true } },
          },
        },
      },
    });

    if (!student?.studentClass) {
      return null;
    }

    return this.toStudentClass(student.studentClass);
  }

  async listMyClassmates(user: AuthUser): Promise<ClassMemberDto[]> {
    this.assertRole(user, UserRole.STUDENT);
    const classId = await this.findStudentClassId(user.id);

    if (!classId) {
      return [];
    }

    const students = await this.prisma.user.findMany({
      where: {
        studentClassId: classId,
        role: UserRole.STUDENT,
        id: { not: user.id },
      },
      orderBy: [{ profile: { displayName: 'asc' } }, { id: 'asc' }],
      select: {
        id: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
            gradeLevel: true,
          },
        },
      },
    });

    return students.map((student) => this.toClassMember(student));
  }

  async findClassmateProfile(
    user: AuthUser,
    studentId: string,
  ): Promise<ClassmateProfileDto> {
    this.assertRole(user, UserRole.STUDENT);
    const classId = await this.findStudentClassId(user.id);

    if (!classId) {
      throw new NotFoundException({
        code: 'CLASSMATE_NOT_FOUND',
        message: 'Classmate profile not found',
      });
    }

    const classmate = await this.prisma.user.findFirst({
      where: {
        id: studentId,
        role: UserRole.STUDENT,
        studentClassId: classId,
      },
      select: {
        id: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
            gradeLevel: true,
            bio: true,
          },
        },
      },
    });

    if (!classmate?.profile) {
      throw new NotFoundException({
        code: 'CLASSMATE_NOT_FOUND',
        message: 'Classmate profile not found',
      });
    }

    return new ClassmateProfileDto({
      id: classmate.id,
      displayName: classmate.profile.displayName,
      avatarUrl: classmate.profile.avatarUrl,
      gradeLevel: classmate.profile.gradeLevel,
      bio: classmate.profile.bio,
    });
  }

  private async findOwnedClassRecord(teacherId: string, classId: string) {
    const classroom = await this.prisma.class.findFirst({
      where: { id: classId, teacherId },
      include: {
        _count: { select: { students: true } },
      },
    });

    if (!classroom) {
      throw new NotFoundException({
        code: 'CLASS_NOT_FOUND',
        message: 'Class not found',
      });
    }

    return classroom;
  }

  private async findStudentClassId(userId: string): Promise<string | null> {
    const student = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { studentClassId: true },
    });
    return student?.studentClassId ?? null;
  }

  private assertRole(user: AuthUser, role: UserRole): void {
    if (user.role !== role) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: `Only ${role.toLowerCase()} accounts may use this endpoint`,
      });
    }
  }

  private toClassSummary(classroom: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    _count: { students: number };
  }): ClassSummaryDto {
    return new ClassSummaryDto({
      id: classroom.id,
      name: classroom.name,
      studentCount: classroom._count.students,
      createdAt: classroom.createdAt,
      updatedAt: classroom.updatedAt,
    });
  }

  private toStudentClass(classroom: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    _count: { students: number };
    teacher: {
      id: string;
      profile: { displayName: string } | null;
    };
  }): StudentClassDto {
    if (!classroom.teacher.profile) {
      throw new InternalServerErrorException('Teacher profile is unavailable');
    }

    return new StudentClassDto({
      ...this.toClassSummary(classroom),
      teacher: {
        id: classroom.teacher.id,
        displayName: classroom.teacher.profile.displayName,
      },
    });
  }

  private toClassMember(student: {
    id: string;
    profile: {
      displayName: string;
      avatarUrl: string | null;
      gradeLevel: number | null;
    } | null;
  }): ClassMemberDto {
    if (!student.profile) {
      throw new InternalServerErrorException('Student profile is unavailable');
    }

    return new ClassMemberDto({
      id: student.id,
      displayName: student.profile.displayName,
      avatarUrl: student.profile.avatarUrl,
      gradeLevel: student.profile.gradeLevel,
    });
  }

  private generateInviteCode(): string {
    let value = '';

    for (let index = 0; index < INVITE_LENGTH; index += 1) {
      value += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
    }

    return `${value.slice(0, 4)}-${value.slice(4)}`;
  }

  private normalizeInviteCode(code: string): string {
    const compact = code.toUpperCase().replace(/[\s-]/g, '');
    return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  }
}
