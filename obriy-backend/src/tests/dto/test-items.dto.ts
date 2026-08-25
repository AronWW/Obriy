import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNumber,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { TestDraftVersionDto } from './update-test-draft.dto';

export class AddTestItemDto extends TestDraftVersionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  assignmentId: string;

  @ApiPropertyOptional({ minimum: 0.01, maximum: 999_999.99 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999.99)
  maxPoints?: number;
}

export class UpdateTestItemDto extends TestDraftVersionDto {
  @ApiProperty({ minimum: 0.01, maximum: 999_999.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999.99)
  maxPoints: number;
}

export class UpdateTestItemRevisionDto extends TestDraftVersionDto {}

export class ReorderTestItemsDto extends TestDraftVersionDto {
  @ApiProperty({ type: String, isArray: true, format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  itemIds: string[];
}

export class RemoveTestItemDto extends TestDraftVersionDto {}
