import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import {
  AcceptLanguageResolver,
  I18nJsonLoader,
  I18nModule,
} from 'nestjs-i18n';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { UsersModule } from './users/users.module';
import { ClassesModule } from './classes/classes.module';
import { ParentLinksModule } from './parent-links/parent-links.module';
import { LessonsModule } from './lessons/lessons.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { TestsModule } from './tests/tests.module';
import { MapPresetsModule } from './map-presets/map-presets.module';
import { TeacherDashboardModule } from './teacher-dashboard/teacher-dashboard.module';
import { TeacherAnalyticsModule } from './teacher-analytics/teacher-analytics.module';
import { StudentWorkspaceModule } from './student-workspace/student-workspace.module';
import { GamificationModule } from './gamification/gamification.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { validateEnvironment } from './config/env.validation';

const i18nPath = existsSync(join(__dirname, 'i18n'))
  ? join(__dirname, 'i18n')
  : join(__dirname, '..', 'i18n');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    I18nModule.forRoot({
      fallbackLanguage: 'uk',
      loader: I18nJsonLoader,
      loaderOptions: {
        path: i18nPath,
        watch: true,
      },
      resolvers: [AcceptLanguageResolver],
    }),
    PrismaModule,
    CommonModule,
    AuthModule,
    UsersModule,
    ClassesModule,
    ParentLinksModule,
    LessonsModule,
    AssignmentsModule,
    MapPresetsModule,
    TestsModule,
    TeacherDashboardModule,
    TeacherAnalyticsModule,
    StudentWorkspaceModule,
    GamificationModule,
    LeaderboardModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
