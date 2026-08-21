import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsInt, IsUUID, Min } from 'class-validator';

function toNumber({ value }: TransformFnParams): unknown {
  return typeof value === 'string' && value.trim() !== ''
    ? Number(value)
    : value;
}

export class UploadAssignmentImageDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  expectedRevisionId: string;

  @ApiProperty({ minimum: 1 })
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  expectedEditVersion: number;
}
