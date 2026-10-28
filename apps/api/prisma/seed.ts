// Demo seed — idempotent, demo company only.
// Run only with ALLOW_DEMO_SEED=true. Never run against a real company DB.
//
// Usage (after `npm install` + migrate):
//   ALLOW_DEMO_SEED=true npm run db:seed --workspace=fieldsync-api
//
// NOTE: This file does not run in this workspace yet — DATABASE_URL / Docker /
// Clerk are not set up here. It is checked in so Phase 1 can run it without
// rewriting the seed spec. Clerk user ids here are placeholders and must be
// replaced with real Clerk ids when Clerk is wired up in Phase 1.
//
// Seed spec (must match docs/03-DATA-MODEL.md):
// 18 jobs: 4 past, 9 today, 5 tomorrow. Statuses: SCHEDULED 5, EN_ROUTE 2,
// ON_SITE 1, IN_PROGRESS 3, ON_HOLD 1, COMPLETED 4, CANCELLED 2.
// Unassigned: 3. Urgent: 2. Overdue: at least 1 guaranteed (past-date
// SCHEDULED job); more appear during the day as today's windows pass —
// do not claim an exact overdue count in seed, it is time-dependent.
// One COMPLETED job has 3 demo photos, a current signature, and a READY job sheet.
import { PrismaClient, JobStatus, Priority, Role } from '@prisma/client';

const prisma = new PrismaClient();
const COMPANY_ID = '00000000-0000-4000-8000-000000000001';

function day(offset: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

type SeedJob = {
  id: string;
  title: string;
  customerName: string;
  status: JobStatus;
  priority: Priority;
  tech: 'tina' | 'tom' | 'tara' | null;
  dateOffset: number;
  windowStart: string;
  windowEnd: string;
  jobType: string;
};

const JOBS: SeedJob[] = [
  // Past — completed / cancelled
  { id: '10000000-0000-4000-8000-000000000001', title: 'AC not cooling — 2nd floor', customerName: 'Priya Sharma', status: JobStatus.COMPLETED, priority: Priority.HIGH, tech: 'tina', dateOffset: -1, windowStart: '09:00', windowEnd: '12:00', jobType: 'HVAC repair' },
  { id: '10000000-0000-4000-8000-000000000002', title: 'Panel upgrade', customerName: 'Maria Lopez', status: JobStatus.COMPLETED, priority: Priority.NORMAL, tech: 'tom', dateOffset: -1, windowStart: '13:00', windowEnd: '16:00', jobType: 'Electrical' },
  { id: '10000000-0000-4000-8000-000000000003', title: 'Outlet repair — kitchen', customerName: 'James Chen', status: JobStatus.CANCELLED, priority: Priority.NORMAL, tech: 'tara', dateOffset: -1, windowStart: '10:00', windowEnd: '12:00', jobType: 'Electrical' },
  { id: '10000000-0000-4000-8000-000000000004', title: 'Leaking tap — bathroom', customerName: 'Sara Ahmed', status: JobStatus.SCHEDULED, priority: Priority.NORMAL, tech: 'tina', dateOffset: -1, windowStart: '09:00', windowEnd: '11:00', jobType: 'Plumbing' },
  // Today
  { id: '10000000-0000-4000-8000-000000000005', title: 'Boiler service', customerName: 'David Kim', status: JobStatus.EN_ROUTE, priority: Priority.URGENT, tech: 'tina', dateOffset: 0, windowStart: '08:00', windowEnd: '10:00', jobType: 'HVAC repair' },
  { id: '10000000-0000-4000-8000-000000000006', title: 'Light fitting — hallway', customerName: 'Emma Wright', status: JobStatus.ON_SITE, priority: Priority.NORMAL, tech: 'tom', dateOffset: 0, windowStart: '09:00', windowEnd: '11:00', jobType: 'Electrical' },
  { id: '10000000-0000-4000-8000-000000000007', title: 'Solar inverter check', customerName: 'Liam Patel', status: JobStatus.IN_PROGRESS, priority: Priority.HIGH, tech: 'tara', dateOffset: 0, windowStart: '10:00', windowEnd: '13:00', jobType: 'Solar' },
  { id: '10000000-0000-4000-8000-000000000008', title: 'Fuse box inspection', customerName: 'Nina Rossi', status: JobStatus.IN_PROGRESS, priority: Priority.NORMAL, tech: 'tina', dateOffset: 0, windowStart: '11:00', windowEnd: '13:00', jobType: 'Electrical' },
  { id: '10000000-0000-4000-8000-000000000009', title: 'Radiator not heating', customerName: 'Omar Farouk', status: JobStatus.SCHEDULED, priority: Priority.NORMAL, tech: null, dateOffset: 0, windowStart: '14:00', windowEnd: '16:00', jobType: 'HVAC repair' },
  { id: '10000000-0000-4000-8000-000000000010', title: 'EV charger install', customerName: 'Grace Liu', status: JobStatus.SCHEDULED, priority: Priority.HIGH, tech: 'tom', dateOffset: 0, windowStart: '14:00', windowEnd: '17:00', jobType: 'Electrical' },
  { id: '10000000-0000-4000-8000-000000000011', title: 'Drain blockage', customerName: 'Ben Carter', status: JobStatus.ON_HOLD, priority: Priority.NORMAL, tech: 'tara', dateOffset: 0, windowStart: '15:00', windowEnd: '17:00', jobType: 'Plumbing' },
  { id: '10000000-0000-4000-8000-000000000012', title: 'Thermostat replacement', customerName: 'Aisha Khan', status: JobStatus.COMPLETED, priority: Priority.NORMAL, tech: 'tina', dateOffset: 0, windowStart: '08:00', windowEnd: '10:00', jobType: 'HVAC repair' },
  { id: '10000000-0000-4000-8000-000000000013', title: 'Water heater fault', customerName: 'Tom Becker', status: JobStatus.SCHEDULED, priority: Priority.NORMAL, tech: null, dateOffset: 0, windowStart: '09:00', windowEnd: '11:00', jobType: 'Plumbing' },
  // Tomorrow
  { id: '10000000-0000-4000-8000-000000000014', title: 'Aircon install — bedroom', customerName: 'Zoe Martin', status: JobStatus.SCHEDULED, priority: Priority.URGENT, tech: 'tom', dateOffset: 1, windowStart: '08:00', windowEnd: '12:00', jobType: 'HVAC repair' },
  { id: '10000000-0000-4000-8000-000000000015', title: 'Garden lighting', customerName: 'Hugo Silva', status: JobStatus.EN_ROUTE, priority: Priority.LOW, tech: 'tara', dateOffset: 1, windowStart: '09:00', windowEnd: '11:00', jobType: 'Electrical' },
  { id: '10000000-0000-4000-8000-000000000016', title: 'Bathroom refit — electrics', customerName: 'Ivy Zhang', status: JobStatus.IN_PROGRESS, priority: Priority.NORMAL, tech: 'tina', dateOffset: 1, windowStart: '10:00', windowEnd: '14:00', jobType: 'Electrical' },
  { id: '10000000-0000-4000-8000-000000000017', title: 'Heat pump service', customerName: 'Karl Novak', status: JobStatus.COMPLETED, priority: Priority.NORMAL, tech: 'tom', dateOffset: 1, windowStart: '09:00', windowEnd: '11:00', jobType: 'HVAC repair' },
  { id: '10000000-0000-4000-8000-000000000018', title: 'Socket replacement', customerName: 'Lena Fischer', status: JobStatus.CANCELLED, priority: Priority.NORMAL, tech: null, dateOffset: 1, windowStart: '13:00', windowEnd: '15:00', jobType: 'Electrical' },
];

async function main() {
  if (process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Refusing to seed without ALLOW_DEMO_SEED=true');
  }

  const company = await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {},
    create: { id: COMPANY_ID, name: 'BrightSpark Electrical — Demo', timezone: 'America/Chicago' },
  });

  const userDefs = [
    { clerkUserId: 'demo-clerk-ava', email: 'ava@demo.fieldsync', name: 'Ava (Admin)', role: Role.ADMIN },
    { clerkUserId: 'demo-clerk-dan', email: 'dan@demo.fieldsync', name: 'Dan (Dispatcher)', role: Role.DISPATCHER },
    { clerkUserId: 'demo-clerk-tina', email: 'tina@demo.fieldsync', name: 'Tina (Technician)', role: Role.TECHNICIAN },
    { clerkUserId: 'demo-clerk-tom', email: 'tom@demo.fieldsync', name: 'Tom (Technician)', role: Role.TECHNICIAN },
    { clerkUserId: 'demo-clerk-tara', email: 'tara@demo.fieldsync', name: 'Tara (Technician)', role: Role.TECHNICIAN },
  ];

  const usersByKey: Record<string, string> = {};
  for (const u of userDefs) {
    const created = await prisma.user.upsert({
      where: { clerkUserId: u.clerkUserId },
      update: {},
      create: { ...u, companyId: company.id },
    });
    usersByKey[u.clerkUserId.replace('demo-clerk-', '')] = created.id;
  }

  // Idempotency: remove demo children first, then demo jobs, then recreate.
  const jobIds = JOBS.map((j) => j.id);
  await prisma.jobActivity.deleteMany({ where: { jobId: { in: jobIds } } });
  await prisma.syncMutation.deleteMany({ where: { jobId: { in: jobIds } } });
  await prisma.photo.deleteMany({ where: { jobId: { in: jobIds } } });
  await prisma.checklistItem.deleteMany({ where: { jobId: { in: jobIds } } });
  await prisma.signature.deleteMany({ where: { jobId: { in: jobIds } } });
  await prisma.jobSheet.deleteMany({ where: { jobId: { in: jobIds } } });
  await prisma.jobNoteDocument.deleteMany({ where: { jobId: { in: jobIds } } });
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });

  for (const j of JOBS) {
    await prisma.job.create({
      data: {
        id: j.id,
        companyId: company.id,
        title: j.title,
        customerName: j.customerName,
        customerPhone: '+1 555 010 2030',
        addressLine1: '12 Maple St',
        city: 'Austin',
        state: 'TX',
        postalCode: '78704',
        scheduledDate: day(j.dateOffset),
        scheduledWindowStart: j.windowStart,
        scheduledWindowEnd: j.windowEnd,
        status: j.status,
        priority: j.priority,
        jobType: j.jobType,
        assignedTechnicianId: j.tech ? usersByKey[j.tech] : null,
        startedAt: j.status !== JobStatus.SCHEDULED && j.status !== JobStatus.CANCELLED ? day(j.dateOffset) : null,
        completedAt: j.status === JobStatus.COMPLETED ? day(j.dateOffset) : null,
        cancelledAt: j.status === JobStatus.CANCELLED ? day(j.dateOffset) : null,
        cancelReason: j.status === JobStatus.CANCELLED ? 'Demo: customer rescheduled' : null,
        checklist: {
          create: ['Arrive and assess', 'Complete work', 'Test and tidy'].map((label, i) => ({
            label,
            sortOrder: i,
            isChecked:
              j.status === JobStatus.COMPLETED ||
              (j.status === JobStatus.IN_PROGRESS && i === 0),
          })),
        },
      },
    });
  }

  // Fully equipped completed job (first job): 3 demo photos, current signature, READY job sheet.
  const completedJobId = JOBS[0].id;
  const tinaId = usersByKey['tina'];
  for (let i = 0; i < 3; i++) {
    await prisma.photo.create({
      data: {
        jobId: completedJobId,
        uploadedById: tinaId,
        storageKey: `demo/photos/${completedJobId}-${i + 1}.jpg`,
        originalFilename: `demo-photo-${i + 1}.jpg`,
        caption: `Demo photo ${i + 1} — placeholder, clearly labelled demo`,
        status: 'READY',
        takenAt: day(-1),
      },
    });
  }
  await prisma.signature.create({
    data: {
      jobId: completedJobId,
      storageKey: `demo/signatures/${completedJobId}.png`,
      signedByName: 'Priya Sharma (demo)',
      signedAt: day(-1),
      capturedById: tinaId,
      isCurrent: true,
    },
  });
  await prisma.jobSheet.create({
    data: {
      jobId: completedJobId,
      storageKey: `demo/job-sheets/${completedJobId}.pdf`,
      status: 'READY',
      generatedAt: day(-1),
    },
  });

  console.log(`Seeded demo company: ${company.name} with ${userDefs.length} users and ${JOBS.length} jobs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
