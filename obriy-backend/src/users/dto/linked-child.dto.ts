import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class LinkedChildDto {
  @ApiProperty({ example: '42d9a0e7-7e1c-47a5-8e78-c3d883ddfb49' })
  id: string;

  @ApiProperty({ example: 'Марія' })
  displayName: string;

  @ApiPropertyOptional({ nullable: true, example: null })
  avatarUrl: string | null;

  constructor(data: LinkedChildDto) {
    this.id = data.id;
    this.displayName = data.displayName;
    this.avatarUrl = data.avatarUrl;
  }
}
