import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Phase 2 job sheet PDF (pdf-lib, the locked PDF engine).
 *
 * The PDF is generated on demand when a completed job's sheet
 * is downloaded, not stored in S3 yet: the JobSheet row is
 * marked READY on first download, with storageKey left null
 * until the S3 photo-storage slice gives it a real key.
 * Signature images stored as PNG data URLs (Phase 2
 * signature slice) are embedded; S3-key signatures are
 * listed by signer name only.
 */
@Injectable()
export class JobSheetService {
  async generate(job: any): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]); // A4
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    let y = 800;
    const line = (text: string, useBold = false, size = 12) => {
      page.drawText(text.slice(0, 110), { x: 50, y, size, font: useBold ? bold : font, color: rgb(0, 0, 0) });
      y -= size + 8;
    };
    line('FieldSync — Job Sheet', true, 18);
    line(`Job: ${job.title ?? ''}`, true);
    line(`Customer: ${job.customerName ?? ''}${job.customerPhone ? ` (${job.customerPhone})` : ''}`);
    line(`Address: ${job.addressLine1 ?? ''} ${job.addressLine2 ?? ''}, ${job.city ?? ''}, ${job.state ?? ''} ${job.postalCode ?? ''}`);
    line(`Scheduled: ${job.scheduledDate ? String(job.scheduledDate).slice(0, 10) : ''} ${job.scheduledWindowStart ?? ''}–${job.scheduledWindowEnd ?? ''}`);
    line(`Status: ${job.status ?? ''} · Priority: ${job.priority ?? ''}`);
    if (job.completedAt) line(`Completed: ${String(job.completedAt).slice(0, 19).replace('T', ' ')}`);
    y -= 8;
    line('Checklist', true, 14);
    const checklist = job.checklist ?? [];
    if (checklist.length === 0) line('No checklist items.');
    for (const item of checklist) {
      line(`${item.isChecked ? '[x]' : '[ ]'} ${item.label ?? ''}`);
    }
    if (job.internalNotes) {
      y -= 8;
      line('Notes', true, 14);
      line(String(job.internalNotes).slice(0, 500));
    }
    const signature = (job.signatures ?? [])[0];
    if (signature) {
      y -= 8;
      line(`Signed by: ${signature.signedByName ?? ''}`, true);
      if (typeof signature.storageKey === 'string' && signature.storageKey.startsWith('data:image/png;base64,')) {
        try {
          const bytes = Buffer.from(signature.storageKey.split(',')[1], 'base64');
          const img = await doc.embedPng(bytes);
          const scale = Math.min(1, 200 / img.width);
          page.drawImage(img, { x: 50, y: y - img.height * scale, width: img.width * scale, height: img.height * scale });
        } catch {
          // A corrupt signature image must not break the job sheet.
        }
      }
    }
    const bytes = await doc.save();
    return Buffer.from(bytes);
  }
}
