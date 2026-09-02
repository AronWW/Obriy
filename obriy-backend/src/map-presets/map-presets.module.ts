import { Module } from '@nestjs/common';
import { MapPresetsController } from './map-presets.controller';
import { MapPresetsService } from './map-presets.service';

@Module({
  controllers: [MapPresetsController],
  providers: [MapPresetsService],
  exports: [MapPresetsService],
})
export class MapPresetsModule {}
