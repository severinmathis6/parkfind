import { Module } from '@nestjs/common'
import { ParkingController } from './parking.controller'
import { ParkingRepository } from './parking.repository'
import { ParkingService } from './parking.service'

@Module({
  controllers: [ParkingController],
  providers: [ParkingService, ParkingRepository],
})
export class ParkingModule {}
