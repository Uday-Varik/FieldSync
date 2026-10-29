import { JobSheetService } from './job-sheet.service';

describe('JobSheetService', () => {
  it('generates a valid PDF for a completed job with checklist and notes', async () => {
    const svc = new JobSheetService();
    const pdf = await svc.generate({
      title: 'Fix panel',
      customerName: 'Jane Doe',
      customerPhone: '555-0100',
      addressLine1: '1 Main St',
      addressLine2: '',
      city: 'Memphis',
      state: 'TN',
      postalCode: '38103',
      scheduledDate: new Date('2026-10-29'),
      scheduledWindowStart: '09:00',
      scheduledWindowEnd: '12:00',
      status: 'COMPLETED',
      priority: 'HIGH',
      completedAt: new Date('2026-10-29T11:00:00Z'),
      checklist: [
        { label: 'Inspect panel', isChecked: true },
        { label: 'Replace breaker', isChecked: false },
      ],
      internalNotes: 'Customer asked to call before arrival.',
      signatures: [{ signedByName: 'Jane Doe', signedAt: new Date(), storageKey: 's3-key-not-an-image' }],
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(500);
  });
});
