import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  ClassInviteDto,
  ClassmateProfileDto,
  ClassMemberDto,
  ClassSummaryDto,
  CreatedClassDto,
  StudentClassDto,
} from './dto/class.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { JoinClassDto } from './dto/join-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { ClassesService } from './classes.service';

@UseGuards(JwtAuthGuard)
@ApiTags('Classes')
@ApiBearerAuth()
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @ApiCreatedResponse({ type: CreatedClassDto })
  @Post()
  createClass(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateClassDto,
  ): Promise<CreatedClassDto> {
    return this.classesService.createClass(user, dto);
  }

  @ApiOkResponse({ type: ClassSummaryDto, isArray: true })
  @Get()
  listMyClasses(@CurrentUser() user: AuthUser): Promise<ClassSummaryDto[]> {
    return this.classesService.listMyClasses(user);
  }

  @ApiOkResponse({ type: StudentClassDto, nullable: true })
  @Get('me')
  findMyClass(@CurrentUser() user: AuthUser): Promise<StudentClassDto | null> {
    return this.classesService.findMyClass(user);
  }

  @ApiOkResponse({ type: ClassMemberDto, isArray: true })
  @Get('me/classmates')
  listMyClassmates(@CurrentUser() user: AuthUser): Promise<ClassMemberDto[]> {
    return this.classesService.listMyClassmates(user);
  }

  @ApiOkResponse({ type: ClassmateProfileDto })
  @Get('classmates/:studentId')
  findClassmateProfile(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
  ): Promise<ClassmateProfileDto> {
    return this.classesService.findClassmateProfile(user, studentId);
  }

  @ApiCreatedResponse({ type: StudentClassDto })
  @Post('join')
  joinClass(
    @CurrentUser() user: AuthUser,
    @Body() dto: JoinClassDto,
  ): Promise<StudentClassDto> {
    return this.classesService.joinClass(user, dto.code);
  }

  @ApiOkResponse({ type: ClassSummaryDto })
  @Get(':classId')
  findOwnedClass(
    @CurrentUser() user: AuthUser,
    @Param('classId') classId: string,
  ): Promise<ClassSummaryDto> {
    return this.classesService.findOwnedClass(user, classId);
  }

  @ApiOkResponse({ type: ClassSummaryDto })
  @Patch(':classId')
  updateOwnedClass(
    @CurrentUser() user: AuthUser,
    @Param('classId') classId: string,
    @Body() dto: UpdateClassDto,
  ): Promise<ClassSummaryDto> {
    return this.classesService.updateOwnedClass(user, classId, dto);
  }

  @ApiOkResponse({ type: ClassInviteDto })
  @Get(':classId/invite')
  findInvite(
    @CurrentUser() user: AuthUser,
    @Param('classId') classId: string,
  ): Promise<ClassInviteDto> {
    return this.classesService.findInvite(user, classId);
  }

  @ApiOkResponse({ type: ClassMemberDto, isArray: true })
  @Get(':classId/members')
  listOwnedClassMembers(
    @CurrentUser() user: AuthUser,
    @Param('classId') classId: string,
  ): Promise<ClassMemberDto[]> {
    return this.classesService.listOwnedClassMembers(user, classId);
  }
}
