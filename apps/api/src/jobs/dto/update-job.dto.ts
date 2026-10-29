import { IsArray, IsDateString, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Priority } from '@prisma/client';

/**
 * PATCH /jobs/:id. Status, companyId and assignment are NOT
 * editable here: status goes through POST /:id/status,
 * assignment through POST /:id/assign. Technicians (assigned
 * only, enforced in the service) may edit notes and job
 * details, but not assignedTechnicianId — that field is
 * simply absent from this DTO.
 */
export class UpdateJobDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) customerName?: string;
  @IsOptional() @IsString() @MaxLength(50) customerPhone?: string;
  @IsOptional() @IsEmail() customerEmail?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine2?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) state?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(20) postalCode?: string;
  @IsOptional() @IsDateString() scheduledDate?: string;
  @IsOptional() @IsString() @MaxLength(20) scheduledWindowStart?: string;
  @IsOptional() @IsString() @MaxLength(20) scheduledWindowEnd?: string;
  @IsOptional() @IsEnum(Priority) priority?: Priority;
  @IsOptional() @IsString() @MaxLength(100) jobType?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() @MaxLength(2000) internalNotes?: string;
  @IsOptional() @IsString() @MaxLength(2000) customerNotes?: string;
}
