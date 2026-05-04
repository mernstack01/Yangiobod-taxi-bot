import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { LocationTier } from '@prisma/client';

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  shortCode!: string;

  @IsString()
  @IsNotEmpty()
  region!: string;

  @IsEnum(LocationTier)
  tier!: LocationTier;

  @IsInt()
  sortOrder!: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
