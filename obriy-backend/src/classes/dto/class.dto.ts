import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GamificationProfileDto } from '../../gamification/dto/gamification.dto';

export class ClassSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: '8-А' })
  name: string;

  @ApiProperty({ example: 18 })
  studentCount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(data: ClassSummaryDto) {
    Object.assign(this, data);
  }
}

export class ClassInviteDto {
  @ApiProperty({ example: '7KXM-P9QD' })
  code: string;

  constructor(data: ClassInviteDto) {
    this.code = data.code;
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

  @ApiProperty({ type: GamificationProfileDto })
  gamification: GamificationProfileDto;

  constructor(data: ClassmateProfileDto) {
    super(data);
    this.bio = data.bio;
    this.gamification = data.gamification;
  }
}
