import { IsInt, IsString, Min } from 'class-validator';

export class RegisterDriverDto {
  @IsInt()
  @Min(1)
  userId!: number;

  @IsString()
  carModel!: string;

  @IsString()
  carNumber!: string;
}
