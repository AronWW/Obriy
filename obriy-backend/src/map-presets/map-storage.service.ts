import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

@Injectable()
export class MapStorageService {
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');
    this.configured = Boolean(cloudName && apiKey && apiSecret);
    if (this.configured)
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
  }

  uploadGeoJson(buffer: Buffer, folder: string): Promise<UploadApiResponse> {
    this.assertConfigured();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          type: 'authenticated',
          folder,
          unique_filename: true,
          overwrite: false,
          format: 'geojson',
        },
        (error, result) =>
          error || !result
            ? reject(
                error instanceof Error
                  ? error
                  : new Error('Cloudinary upload failed'),
              )
            : resolve(result),
      );
      stream.end(buffer);
    });
  }

  uploadDraftGeoJson(
    buffer: Buffer,
    publicId: string,
  ): Promise<UploadApiResponse> {
    this.assertConfigured();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          type: 'authenticated',
          public_id: publicId,
          unique_filename: false,
          overwrite: true,
          invalidate: true,
          format: 'geojson',
        },
        (error, result) =>
          error || !result
            ? reject(
                error instanceof Error
                  ? error
                  : new Error('Cloudinary draft upload failed'),
              )
            : resolve(result),
      );
      stream.end(buffer);
    });
  }

  async downloadGeoJson(storageKey: string): Promise<Buffer> {
    const response = await fetch(this.deliveryUrl(storageKey));
    if (!response.ok) throw new Error('Cloudinary map download failed');
    return Buffer.from(await response.arrayBuffer());
  }

  async destroyGeoJson(storageKey: string): Promise<void> {
    if (!this.configured) return;
    await cloudinary.uploader.destroy(storageKey, {
      resource_type: 'raw',
      type: 'authenticated',
      invalidate: true,
    });
  }

  deliveryUrl(storageKey: string): string {
    this.assertConfigured();
    return cloudinary.utils.private_download_url(storageKey, 'geojson', {
      resource_type: 'raw',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + 5 * 60,
    });
  }

  private assertConfigured(): void {
    if (!this.configured)
      throw new ServiceUnavailableException({
        code: 'CLOUDINARY_NOT_CONFIGURED',
        message: 'Cloudinary map storage is not configured',
      });
  }
}
