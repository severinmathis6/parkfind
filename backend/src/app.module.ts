import { Module } from '@nestjs/common'
import { HealthController } from './health/health.controller'
import { ParkingModule } from './parking/parking.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [PrismaModule, ParkingModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
