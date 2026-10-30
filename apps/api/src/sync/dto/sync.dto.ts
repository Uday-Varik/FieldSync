import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsObject, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum SyncMutationType {
  UPDATE_STATUS = 'UPDATE_STATUS',
  UPDATE_JOB_FIELDS = 'UPDATE_JOB_FIELDS',
  TOGGLE_CHECKLIST = 'TOGGLE_CHECKLIST',
  ADD_CHECKLIST_ITEM = 'ADD_CHECKLIST_ITEM',
  ADD_NOTE = 'ADD_NOTE',
  ADD_SIGNATURE = 'ADD_SIGNATURE',
}

export class SyncMutationDto {
  @IsString()
  clientMutationId!: string;

  @IsEnum(SyncMutationType)
  type!: SyncMutationType;

  @IsString()
  jobId!: string;

  @IsInt()
  @Min(0)
  clientVersion!: number;

  @IsObject()
  payload!: Record<string, any>;
}

export class SyncRequestDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SyncMutationDto)
  mutations!: SyncMutationDto[];
}
