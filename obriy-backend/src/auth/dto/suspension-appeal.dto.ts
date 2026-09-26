import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SuspensionAppealStatus } from '@prisma/client';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SuspensionTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  suspensionAccessToken: string;
}

export class SubmitSuspensionAppealDto extends SuspensionTokenDto {
  @ApiProperty({ minLength: 20, maxLength: 2000 })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  message: string;
}

export class SuspensionAppealStateDto {
  @ApiProperty({ enum: SuspensionAppealStatus })
  status: SuspensionAppealStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  submittedAt: Date;

  @ApiPropertyOptional({ nullable: true })
  resolutionNote: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  reviewedAt: Date | null;

  constructor(data: SuspensionAppealStateDto) {
    Object.assign(this, data);
  }
}

export class SuspensionContextDto {
  @ApiProperty()
  reason: string;

  @ApiProperty({ type: String, format: 'date-time' })
  suspendedAt: Date;

  @ApiProperty()
  canAppeal: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  nextAppealAt: Date | null;

  @ApiPropertyOptional({ type: SuspensionAppealStateDto, nullable: true })
  appeal: SuspensionAppealStateDto | null;

  constructor(data: SuspensionContextDto) {
    Object.assign(this, data);
  }
}
