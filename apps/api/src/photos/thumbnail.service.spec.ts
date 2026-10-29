import { ThumbnailService } from './thumbnail.service';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('ThumbnailService', () => {
  it('generateThumbnailBuffer: produces a JPEG from a PNG', async () => {
    const svc = new ThumbnailService({} as any, { configured: true } as any);
    const out = await svc.generateThumbnailBuffer(PNG_1X1);
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
    expect(out.length).toBeGreaterThan(100);
  });

  it('process: downloads, thumbnails, uploads, and records thumbnailKey', async () => {
    const prisma: any = {
      photo: {
        findFirst: jest.fn().mockResolvedValue({ id: 'p1', storageKey: 'jobs/j1/a.png' }),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data })),
      },
    };
    const storage: any = {
      configured: true,
      downloadBuffer: jest.fn().mockResolvedValue(PNG_1X1),
      uploadBuffer: jest.fn().mockResolvedValue(undefined),
    };
    const svc = new ThumbnailService(prisma, storage);
    const key = await svc.process('p1');
    expect(key).toBe('thumbnails/p1.jpg');
    expect(storage.uploadBuffer).toHaveBeenCalledWith('thumbnails/p1.jpg', expect.any(Buffer), 'image/jpeg');
    expect(prisma.photo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ thumbnailKey: 'thumbnails/p1.jpg' }) }),
    );
  });

  it('process: returns null (not an error) when storage is not configured or the photo is gone', async () => {
    const prisma: any = { photo: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() } };
    const svc = new ThumbnailService(prisma, { configured: false } as any);
    await expect(svc.process('missing')).resolves.toBeNull();
  });
});
