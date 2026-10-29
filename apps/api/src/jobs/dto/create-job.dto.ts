import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Priority } from '@prisma/client';

export class CreateJobDto {
  @IsString() @MinLength(1) @MaxLength(200)
  title!: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsString() @MinLength(1) @MaxLength(200)
  customerName!: string;

  @IsOptional() @IsString() @MaxLength(50)
  customerPhone?: string;

  @IsOptional() @IsEmail()
  customerEmail?: string;

  @IsString() @MinLength(1) @MaxLength(200)
  addressLine1!: string;

  @IsOptional() @IsString() @MaxLength(200)
  addressLine2?: string;

  @IsString() @MinLength(1) @MaxLength(100)
  city!: string;

  @IsString() @MinLength(1) @MaxLength(100)
  state!: string;

  @IsString() @MinLength(1) @MaxLength(20)
  postalCode!: string;

  @IsDateString()
  scheduledDate!: string;

  @IsString() @MinLength(1) @MaxLength(20)
  scheduledWindowStart!: string;

  @IsString() @MinLength(1) @MaxLength(20)
  scheduledWindowEnd!: string;

  @IsOptional() @IsEnum(Priority)
  priority?: Priority;

  @IsOptional() @IsString() @MaxLength(100)
  jobType?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @IsOptional() @IsString()
  assignedTechnicianId?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  checklistLabels?: string[];

  @IsOptional() @IsString() @MaxLength(2000)
  internalNotes?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  customerNotes?: string;
}
