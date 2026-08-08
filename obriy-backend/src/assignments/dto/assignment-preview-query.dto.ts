import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { AssignmentRevisionSource } from './assignment-revision-source.dto';

export class AssignmentPreviewQueryDto {
  @ApiPropertyOptional({ enum: AssignmentRevisionSource })
  @IsOptional()
  @IsEnum(AssignmentRevisionSource)
  source?: AssignmentRevisionSource;
}
