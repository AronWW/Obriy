import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
}

export class CreateClassDto {
  @ApiProperty({ example: '8-А' })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;
}
