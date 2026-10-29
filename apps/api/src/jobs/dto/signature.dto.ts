import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Phase 2 signature capture.
 *
 * The signature pad produces a PNG data URL. Until the S3
 * photo-storage slice lands, that data URL is stored in
 * Signature.storageKey (which will then hold an S3 key
 * instead). The job detail page treats a `data:` value as an
 * image src and any other value as a key it cannot display.
 * Data URLs are capped at ~700k chars (roughly a 500KB PNG)
 * so a signature cannot bloat the jobs table.
 */
export class CreateSignatureDto {
  @IsString() @MinLength(1) @MaxLength(100)
  signedByName!: string;

  @IsString()
  @Matches(/^data:image\/(png|jpeg);base64,/, { message: 'imageDataUrl must be a PNG or JPEG data URL' })
  @MaxLength(700000)
  imageDataUrl!: string;
}
