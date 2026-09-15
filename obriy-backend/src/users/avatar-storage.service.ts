import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

@Injectable()
export class AvatarStorageService {
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');
    this.configured = Boolean(cloudName && apiKey && apiSecret);
    if (this.configured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    }
  }

  upload(buffer: Buffer, userId: string): Promise<UploadApiResponse> {
    this.assertConfigured();
    const root =
      this.config.get<string>('CLOUDINARY_AVATAR_FOLDER')?.replace(/\/$/, '') ??
      'obriy';

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: `${root}/avatars`,
          public_id: `${userId}-${Date.now()}`,
          overwrite: false,
          transformation: [
            { width: 512, height: 512, crop: 'fill', gravity: 'auto' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error || !result) {
            reject(
              error instanceof Error
                ? error
                : new Error('Avatar upload failed'),
            );
            return;
          }
          resolve(result);
        },
      );
      stream.end(buffer);
    });
  }

  async destroy(storageKey: string): Promise<void> {
    if (!this.configured) return;
    await cloudinary.uploader.destroy(storageKey, {
      resource_type: 'image',
      invalidate: true,
    });
  }

  private assertConfigured(): void {
    if (!this.configured) {
      throw new ServiceUnavailableException({
        code: 'CLOUDINARY_NOT_CONFIGURED',
        message: 'Cloudinary avatar storage is not configured',
      });
    }
  }
}
