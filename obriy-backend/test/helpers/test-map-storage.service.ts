import type { UploadApiResponse } from 'cloudinary';

export class TestMapStorageService {
  private sequence = 0;
  readonly destroyed: string[] = [];
  readonly files = new Map<string, Buffer>();

  uploadGeoJson(buffer: Buffer): Promise<UploadApiResponse> {
    this.sequence += 1;
    const publicId = `test/maps/map-${this.sequence}`;
    this.files.set(publicId, Buffer.from(buffer));
    return Promise.resolve({ public_id: publicId } as UploadApiResponse);
  }

  uploadDraftGeoJson(
    buffer: Buffer,
    publicId: string,
  ): Promise<UploadApiResponse> {
    this.files.set(publicId, Buffer.from(buffer));
    return Promise.resolve({ public_id: publicId } as UploadApiResponse);
  }

  downloadGeoJson(storageKey: string): Promise<Buffer> {
    const value = this.files.get(storageKey);
    if (!value) return Promise.reject(new Error('Test map file not found'));
    return Promise.resolve(Buffer.from(value));
  }

  destroyGeoJson(storageKey: string): Promise<void> {
    this.destroyed.push(storageKey);
    this.files.delete(storageKey);
    return Promise.resolve();
  }

  deliveryUrl(storageKey: string): string {
    return `https://example.test/${storageKey}.geojson`;
  }
}
