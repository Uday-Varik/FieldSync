import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateChecklistDto {
  @IsString() @MinLength(1) @MaxLength(300)
  label!: string;
}

export class UpdateChecklistDto {
  @IsBoolean()
  isChecked!: boolean;
}
