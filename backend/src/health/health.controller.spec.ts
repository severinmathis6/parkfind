import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'
import { HealthController } from './health.controller'

describe('HealthController', () => {
  it('returns status ok with current timestamp', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile()

    const controller = moduleRef.get(HealthController)
    const result = controller.check()

    expect(result.status).toBe('ok')
    expect(typeof result.timestamp).toBe('string')
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow()
  })
})
