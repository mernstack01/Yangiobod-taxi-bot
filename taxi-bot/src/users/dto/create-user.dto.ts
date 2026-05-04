import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateUserDto {
  @IsInt()
  @Min(1)
  telegramId!: number;

  @IsString()
  firstName!: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  username?: string;
}
