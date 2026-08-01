import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClassSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: '8-А' })
  name: string;

  @ApiProperty({ example: 8 })
  gradeLevel: number;

  @ApiProperty({ example: 18 })
  studentCount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  activeInviteExpiresAt: Date | null;

  constructor(data: ClassSummaryDto) {
    Object.assign(this, data);
  }
}

export class ClassInviteDto {
  @ApiProperty({ example: '7KXM-P9QD' })
  code: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt: Date;

  constructor(data: ClassInviteDto) {
    this.code = data.code;
    this.expiresAt = data.expiresAt;
  }
}

export class CreatedClassDto {
  @ApiProperty({ type: ClassSummaryDto })
  class: ClassSummaryDto;

  @ApiProperty({ type: ClassInviteDto })
  invite: ClassInviteDto;

  constructor(data: CreatedClassDto) {
    this.class = data.class;
    this.invite = data.invite;
  }
}

export class ClassTeacherDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  constructor(data: ClassTeacherDto) {
    this.id = data.id;
    this.displayName = data.displayName;
  }
}

export class StudentClassDto extends ClassSummaryDto {
  @ApiProperty({ type: ClassTeacherDto })
  teacher: ClassTeacherDto;

  constructor(data: StudentClassDto) {
    super(data);
    this.teacher = data.teacher;
  }
}

export class ClassMemberDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  gradeLevel: number | null;

  constructor(data: ClassMemberDto) {
    Object.assign(this, data);
  }
}

export class ClassmateProfileDto extends ClassMemberDto {
  @ApiPropertyOptional({ nullable: true })
  bio: string | null;

  constructor(data: ClassmateProfileDto) {
    super(data);
    this.bio = data.bio;
  }
}
