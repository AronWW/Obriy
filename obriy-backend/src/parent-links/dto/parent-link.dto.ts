import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ParentInvitationDto {
  @ApiProperty()
  token: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt: Date;

  constructor(data: ParentInvitationDto) {
    this.token = data.token;
    this.expiresAt = data.expiresAt;
  }
}

export class ActiveParentInvitationDto {
  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt: Date;

  constructor(data: ActiveParentInvitationDto) {
    this.expiresAt = data.expiresAt;
  }
}

export class LinkedGuardianDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  linkedAt: Date;

  constructor(data: LinkedGuardianDto) {
    Object.assign(this, data);
  }
}

export class ParentInvitationChildDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl: string | null;

  constructor(data: ParentInvitationChildDto) {
    Object.assign(this, data);
  }
}

export class ParentInvitationPreviewDto {
  @ApiProperty({ type: ParentInvitationChildDto })
  child: ParentInvitationChildDto;

  @ApiProperty()
  alreadyLinked: boolean;

  constructor(data: ParentInvitationPreviewDto) {
    this.child = data.child;
    this.alreadyLinked = data.alreadyLinked;
  }
}
