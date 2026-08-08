import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentType, Locale } from '@prisma/client';
import { IsEnum, IsNumber, Max, Min, ValidateIf } from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty({ enum: AssignmentType })
  @IsEnum(AssignmentType)
  type: AssignmentType;

  @ApiPropertyOptional({
    enum: Locale,
    description: "Defaults to the teacher's preferred locale",
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(Locale)
  contentLocale?: Locale;

  @ApiPropertyOptional({ minimum: 0.01, maximum: 999_999.99, default: 1 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999.99)
  defaultMaxPoints?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, default: 100 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  defaultPassingPercent?: number;
}
