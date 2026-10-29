import { IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PhotoUploadUrlDto {
  @IsString() @MinLength(1) @MaxLength(200)
  filename!: string;

  @IsString() @MinLength(1) @MaxLength(100)
  contentType!: string;
}

export class PhotoConfirmDto {
  @IsString() @MinLength(1) @MaxLength(500)
  storageKey!: string;

  @IsString() @MinLength(1) @MaxLength(200)
  originalFilename!: string;

  @IsOptional() @IsString() @MaxLength(500)
  caption?: string;

  @IsOptional() @IsNumber()
  lat?: number;

  @IsOptional() @IsNumber()
  lng?: number;

  @IsOptional() @IsNumber()
  fileSizeBytes?: number;
}
