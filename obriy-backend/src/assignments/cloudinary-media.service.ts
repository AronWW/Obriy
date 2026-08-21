import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryMediaService {
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

  uploadImage(buffer: Buffer, folder: string): Promise<UploadApiResponse> {
    this.assertConfigured();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder,
          unique_filename: true,
          overwrite: false,
          transformation: [{ width: 4_000, height: 4_000, crop: 'limit' }],
        },
        (error, result) => {
          if (error || !result)
            reject(
              error instanceof Error
                ? error
                : new Error('Cloudinary upload failed'),
            );
          else resolve(result);
        },
      );
      stream.end(buffer);
    });
  }

  async destroyImage(publicId: string): Promise<void> {
    if (!this.configured) return;
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  }

  deliveryUrl(publicId: string): string {
    this.assertConfigured();
    return cloudinary.url(publicId, {
      secure: true,
      transformation: [
        { width: 2_400, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
      ],
    });
  }

  private assertConfigured(): void {
    if (!this.configured) {
      throw new ServiceUnavailableException({
        code: 'CLOUDINARY_NOT_CONFIGURED',
        message: 'Cloudinary image storage is not configured',
      });
    }
  }
}
