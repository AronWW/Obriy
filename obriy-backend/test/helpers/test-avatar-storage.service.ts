import type { UploadApiResponse } from 'cloudinary';
import { AvatarStorageService } from '../../src/users/avatar-storage.service';

export class TestAvatarStorageService implements Pick<
  AvatarStorageService,
  'upload' | 'destroy'
> {
  readonly uploads: string[] = [];
  readonly destroyed: string[] = [];

  upload(_buffer: Buffer, userId: string): Promise<UploadApiResponse> {
    const publicId = `test/avatars/${userId}-${this.uploads.length + 1}`;
    this.uploads.push(publicId);
    return Promise.resolve({
      public_id: publicId,
      secure_url: `https://cdn.example/${publicId}.webp`,
    } as UploadApiResponse);
  }

  destroy(storageKey: string): Promise<void> {
    this.destroyed.push(storageKey);
    return Promise.resolve();
  }
}
