import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches } from 'class-validator';
import { LocationTier } from '@prisma/client';

export class UpdateLocationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  @IsOptional()
  shortCode?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsEnum(LocationTier)
  @IsOptional()
  tier?: LocationTier;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
