import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  Max,
  Min,
} from 'class-validator'
import { PARKING_TYPES, type ParkingType } from '../parking.types'

export class FindNearbyDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number

  @Type(() => Number)
  @IsLongitude()
  lng!: number

  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(20000)
  @IsOptional()
  radius: number = 2000

  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined
    return String(value).split(',').map((v) => v.trim())
  })
  @IsOptional()
  @IsArray()
  @IsEnum(PARKING_TYPES, { each: true })
  parking_type?: ParkingType[]

  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined
    return value === 'true' || value === true
  })
  @IsOptional()
  @IsBoolean()
  is_ev_charging?: boolean

  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined
    return value === 'true' || value === true
  })
  @IsOptional()
  @IsBoolean()
  is_free?: boolean
}
