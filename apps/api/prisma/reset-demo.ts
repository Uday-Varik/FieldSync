// Demo reset — wipes ONLY the demo company and re-seeds it, for when
// a demo user messes up the demo data (docs/09 §4). Never expose this
// as a public endpoint, and never run it against a real company DB:
// it deletes by the fixed demo COMPANY_ID and nothing else.
//
// Usage (after `npm install` + migrate):
//   ALLOW_DEMO_SEED=true npm run db:reset-demo --workspace=fieldsync-api
//
// The wipe deletes database rows only. Demo photo/PDF objects in the
// dev storage bucket are left in place; the seed re-creates rows that
// point at the same demo keys, so nothing in storage needs cleaning.
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import * as path from 'node:path';

const prisma = new PrismaClient();
const COMPANY_ID = '00000000-0000-4000-8000-000000000001';

async function main() {
  if (process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Refusing to reset demo data without ALLOW_DEMO_SEED=true');
  }

  const company = await prisma.company.findUnique({
    where: { id: COMPANY_ID },
    select: { id: true },
  });
  if (!company) {
    console.log('Demo company not found; nothing to wipe.');
  } else {
    // Children first (foreign keys), then jobs, users, invites, company.
    const counts = await prisma.$transaction([
      prisma.syncMutation.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.jobActivity.deleteMany({
        where: { job: { companyId: COMPANY_ID } },
      }),
      prisma.checklistItem.deleteMany({
        where: { job: { companyId: COMPANY_ID } },
      }),
      prisma.jobNoteDocument.deleteMany({
        where: { job: { companyId: COMPANY_ID } },
      }),
      prisma.photo.deleteMany({ where: { job: { companyId: COMPANY_ID } } }),
      prisma.signature.deleteMany({
        where: { job: { companyId: COMPANY_ID } },
      }),
      prisma.jobSheet.deleteMany({
        where: { job: { companyId: COMPANY_ID } },
      }),
      prisma.job.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.invite.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.user.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.deleteMany({ where: { id: COMPANY_ID } }),
    ]);
    console.log(
      `Wiped demo company rows: ${counts.map((c) => c.count).join(', ')} (sync, activity, checklist, notes, photos, signatures, sheets, jobs, invites, users, company).`,
    );
  }

  // Re-seed through the workspace script so seed stays the single
  // source of truth for demo data. If this fails, the wipe above
  // already happened — the error must say so plainly.
  const repoRoot = path.join(__dirname, '..', '..');
  try {
    execSync('npm run db:seed --workspace=fieldsync-api', {
      cwd: repoRoot,
      env: process.env,
      stdio: 'inherit',
    });
  } catch {
    throw new Error(
      'Demo data was wiped but re-seeding failed. Re-run the reset to restore the demo data.',
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
