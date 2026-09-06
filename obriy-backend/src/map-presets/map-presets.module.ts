import { Module } from '@nestjs/common';
import { MapPresetsController } from './map-presets.controller';
import { MapPresetsService } from './map-presets.service';
import { CustomGeoJsonProcessor } from './custom-geojson.processor';
import { MapStorageService } from './map-storage.service';
import { MapDraftsController } from './map-drafts.controller';
import { MapDraftsService } from './map-drafts.service';

@Module({
  controllers: [MapPresetsController, MapDraftsController],
  providers: [
    MapPresetsService,
    MapDraftsService,
    CustomGeoJsonProcessor,
    MapStorageService,
  ],
  exports: [MapPresetsService],
})
export class MapPresetsModule {}
