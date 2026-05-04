import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { NeedTime } from '@prisma/client';

export class CreateListingDto {
  @IsString()
  clientId!: string;

  @IsString()
  fromId!: string;

  @IsString()
  toId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  passengerCount?: number;

  @IsOptional()
  @IsBoolean()
  acceptsParcel?: boolean;

  @IsOptional()
  @IsBoolean()
  parcelOnly?: boolean;

  @IsOptional()
  @IsEnum(NeedTime)
  needTime?: NeedTime;

  @IsOptional()
  scheduledAt?: Date;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceOffer?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
