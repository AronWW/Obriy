import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OAuthExchangeDto {
  @ApiProperty({ description: 'Single-use code returned by Google callback.' })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  code: string;
}
