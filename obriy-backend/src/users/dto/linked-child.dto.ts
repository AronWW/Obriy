import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * The intentionally small identity surface a parent may see for a linked child.
 * Learning progress is exposed by separate parent-facing endpoints as it becomes
 * available; do not add account or profile-private fields here.
 */
export class LinkedChildDto {
  @ApiProperty({ example: '42d9a0e7-7e1c-47a5-8e78-c3d883ddfb49' })
  id: string;

  @ApiProperty({ example: 'Марія' })
  displayName: string;

  @ApiPropertyOptional({ nullable: true, example: null })
  avatarUrl: string | null;

  @ApiPropertyOptional({ nullable: true, example: 7 })
  gradeLevel: number | null;

  constructor(data: LinkedChildDto) {
    this.id = data.id;
    this.displayName = data.displayName;
    this.avatarUrl = data.avatarUrl;
    this.gradeLevel = data.gradeLevel;
  }
}
