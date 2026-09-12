import {
  ChatAttachmentResourceType,
  type MessageAttachment,
} from '@prisma/client';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname } from 'node:path';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

@Injectable()
export class ChatStorageService {
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

  upload(
    buffer: Buffer,
    folder: string,
    resourceType: ChatAttachmentResourceType,
  ): Promise<UploadApiResponse> {
    this.assertConfigured();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type:
            resourceType === ChatAttachmentResourceType.IMAGE ? 'image' : 'raw',
          type: 'authenticated',
          folder,
          unique_filename: true,
          overwrite: false,
        },
        (error, result) =>
          error || !result
            ? reject(
                error instanceof Error
                  ? error
                  : new Error('Chat attachment upload failed'),
              )
            : resolve(result),
      );
      stream.end(buffer);
    });
  }

  async destroy(
    storageKey: string,
    resourceType: ChatAttachmentResourceType,
  ): Promise<void> {
    if (!this.configured) return;
    await cloudinary.uploader.destroy(storageKey, {
      resource_type:
        resourceType === ChatAttachmentResourceType.IMAGE ? 'image' : 'raw',
      type: 'authenticated',
      invalidate: true,
    });
  }

  deliveryUrl(
    attachment: Pick<
      MessageAttachment,
      'storageKey' | 'resourceType' | 'originalFileName'
    >,
  ): string {
    this.assertConfigured();
    const extension = extname(attachment.originalFileName)
      .replace('.', '')
      .toLowerCase();
    return cloudinary.utils.private_download_url(
      attachment.storageKey,
      extension || 'bin',
      {
        resource_type:
          attachment.resourceType === ChatAttachmentResourceType.IMAGE
            ? 'image'
            : 'raw',
        type: 'authenticated',
        expires_at: Math.floor(Date.now() / 1000) + 5 * 60,
      },
    );
  }

  private assertConfigured(): void {
    if (!this.configured)
      throw new ServiceUnavailableException({
        code: 'CLOUDINARY_NOT_CONFIGURED',
        message: 'Cloudinary chat storage is not configured',
      });
  }
}
