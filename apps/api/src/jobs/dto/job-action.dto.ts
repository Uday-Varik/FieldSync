import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JobStatus } from '@prisma/client';

export class ChangeStatusDto {
  @IsEnum(JobStatus)
  status!: JobStatus;

  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

export class AssignJobDto {
  /** Null unassigns. A technician id must belong to the same company and hold TECHNICIAN role (checked in service). */
  @IsOptional() @IsString()
  technicianId?: string | null;
}

export class CancelJobDto {
  @IsString() @MinLength(1) @MaxLength(500)
  reason!: string;
}

export class ReopenJobDto {
  @IsString() @MinLength(1) @MaxLength(500)
  reason!: string;
}
