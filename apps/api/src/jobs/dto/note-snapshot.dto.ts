import { IsString, MaxLength, MinLength } from 'class-validator';

export class NoteSnapshotDto {
  @IsString() @MinLength(1) @MaxLength(3000000)
  snapshotBase64!: string;
}
