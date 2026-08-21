import {
  Controller,
  Get,
  Param,
  Post,
  Redirect,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  AssignmentImagesService,
  type UploadedAssignmentImage,
} from './assignment-images.service';
import { AssignmentEditorDto } from './dto/assignment-response.dto';
import { UploadAssignmentImageDto } from './dto/upload-assignment-image.dto';

@ApiTags('Assignment images')
@Controller()
export class AssignmentImagesController {
  constructor(private readonly images: AssignmentImagesService) {}

  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ type: AssignmentEditorDto })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @Post('assignments/:assignmentId/draft/image')
  upload(
    @CurrentUser() user: AuthUser,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UploadAssignmentImageDto,
    @UploadedFile() file?: UploadedAssignmentImage,
  ): Promise<AssignmentEditorDto> {
    return this.images.upload(user, assignmentId, dto, file);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post('assignments/:assignmentId/draft/image/remove')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UploadAssignmentImageDto,
  ): Promise<AssignmentEditorDto> {
    return this.images.remove(user, assignmentId, dto);
  }

  @Get('assignment-images/:attachmentId')
  @Redirect(undefined, 302)
  async deliver(@Param('attachmentId') attachmentId: string) {
    return { url: await this.images.deliveryUrl(attachmentId) };
  }
}
