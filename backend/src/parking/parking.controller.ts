import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common'
import { ParkingResponseDto } from './dto/parking-response.dto'
import { FindNearbyDto } from './dto/find-nearby.dto'
import { ParkingService } from './parking.service'

@Controller('parkings')
export class ParkingController {
  constructor(private readonly service: ParkingService) {}

  @Get()
  async findNearby(@Query() query: FindNearbyDto): Promise<ParkingResponseDto[]> {
    return this.service.findNearby({
      lat: query.lat,
      lng: query.lng,
      radius: query.radius,
      parkingType: query.parking_type,
      isEvCharging: query.is_ev_charging,
      isFree: query.is_free,
    })
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number): Promise<ParkingResponseDto> {
    return this.service.findById(id)
  }
}
