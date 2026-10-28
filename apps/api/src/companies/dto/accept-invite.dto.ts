import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AcceptInviteDto {
  @IsString()
  @MinLength(1)
  token!: string;

  /** Display name if Clerk has none; defaults to the invite email prefix. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
