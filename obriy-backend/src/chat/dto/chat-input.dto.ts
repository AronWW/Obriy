import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ChatPageQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 30;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CreateConversationDto {
  @IsUUID()
  counterpartId: string;
}

export class SendMessageDto {
  @IsUUID()
  clientMessageId: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;
}

export class EditMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body: string;
}

export interface UploadedChatFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
