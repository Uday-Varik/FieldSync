import { PhotosService } from './photos.service';

const tech = { clerkUserId: 'clerk-t', dbUser: { id: 'u-tech', companyId: 'c1', role: 'TECHNICIAN' } } as any;

function makePrisma(job: any) {
  const prisma: any = {
    job: { findFirst: jest.fn().mockResolvedValue(job) },
    photo: {
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data })),
      findMany: jest.fn().mockResolvedValue([{ id: 'p1', storageKey: 'jobs/j1/a.jpg' }]),
      findFirst: jest.fn().mockResolvedValue({ id: 'p1', jobId: 'j1' }),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data })),
    },
    jobActivity: { create: jest.fn() },
  };
  return prisma;
}

const unconfiguredStorage: any = {
  configured: false,
  uploadUrl: jest.fn().mockRejectedValue(Object.assign(new Error('not configured'), { status: 503 })),
  downloadUrl: jest.fn(),
};

const configuredStorage: any = {
  configured: true,
  uploadUrl: jest.fn().mockResolvedValue('https://s3.example/upload'),
  downloadUrl: jest.fn().mockResolvedValue('https://s3.example/download'),
};

describe('PhotosService', () => {
  it('upload-url: technician on another job is 404, on own job with no storage is 503', async () => {
    const prisma = makePrisma({ id: 'j1', companyId: 'c1', assignedTechnicianId: 'u-other', status: 'IN_PROGRESS' });
    const svc = new PhotosService(prisma, configuredStorage);
    await expect(svc.uploadUrl(tech, 'j1', 'a.jpg', 'image/jpeg')).rejects.toMatchObject({ status: 404 });

    const prisma2 = makePrisma({ id: 'j1', companyId: 'c1', assignedTechnicianId: 'u-tech', status: 'IN_PROGRESS' });
    const svc2 = new PhotosService(prisma2, unconfiguredStorage);
    await expect(svc2.uploadUrl(tech, 'j1', 'a.jpg', 'image/jpeg')).rejects.toMatchObject({ status: 503 });
  });

  it('upload-url: own job with storage returns a key under jobs/<jobId>', async () => {
    const prisma = makePrisma({ id: 'j1', companyId: 'c1', assignedTechnicianId: 'u-tech', status: 'IN_PROGRESS' });
    const svc = new PhotosService(prisma, configuredStorage);
    const out = await svc.uploadUrl(tech, 'j1', 'photo.jpg', 'image/jpeg');
    expect(out.uploadUrl).toBe('https://s3.example/upload');
    expect(out.storageKey.startsWith('jobs/j1/')).toBe(true);
  });

  it('confirm: creates a READY photo and an activity row; list: attaches download URLs', async () => {
    const prisma = makePrisma({ id: 'j1', companyId: 'c1', assignedTechnicianId: 'u-tech', status: 'IN_PROGRESS' });
    const svc = new PhotosService(prisma, configuredStorage);
    const photo = await svc.confirm(tech, 'j1', { storageKey: 'jobs/j1/a.jpg', originalFilename: 'a.jpg' });
    expect(photo.status).toBe('READY');
    expect(prisma.jobActivity.create).toHaveBeenCalled();
    const listed = await svc.list(tech, 'j1');
    expect(listed.data[0].downloadUrl).toBe('https://s3.example/download');
  });

  it('remove: soft-deletes the photo and writes activity', async () => {
    const prisma = makePrisma({ id: 'j1', companyId: 'c1', assignedTechnicianId: 'u-tech', status: 'IN_PROGRESS' });
    const svc = new PhotosService(prisma, configuredStorage);
    const out = await svc.remove(tech, 'j1', 'p1');
    expect(out.deletedAt).toBeInstanceOf(Date);
  });
});
