import { Injectable, NotFoundException } from '@nestjs/common'
import { ParkingResponseDto } from './dto/parking-response.dto'
import { ParkingRepository, type FindNearbyParams } from './parking.repository'

@Injectable()
export class ParkingService {
  constructor(private readonly repo: ParkingRepository) {}

  async findNearby(params: FindNearbyParams): Promise<ParkingResponseDto[]> {
    const rows = await this.repo.findNearby(params)
    return rows.map((row) => ParkingResponseDto.fromRow(row))
  }

  async findById(id: number): Promise<ParkingResponseDto> {
    const row = await this.repo.findById(id)
    if (row === null) {
      throw new NotFoundException(`Parking with id ${id} not found`)
    }
    return ParkingResponseDto.fromRow(row)
  }
}
