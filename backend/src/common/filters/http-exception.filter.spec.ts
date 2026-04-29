import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { HttpExceptionFilter } from './http-exception.filter'

function makeHost(): {
  host: ArgumentsHost
  status: ReturnType<typeof vi.fn>
  json: ReturnType<typeof vi.fn>
} {
  const json = vi.fn()
  const status = vi.fn().mockReturnValue({ json })
  const req = { url: '/api/test' }
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost
  return { host, status, json }
}

describe('HttpExceptionFilter', () => {
  it('formats NotFoundException as 404 JSON response', () => {
    const filter = new HttpExceptionFilter()
    const { host, status, json } = makeHost()

    filter.catch(new NotFoundException('Parking with id 42 not found'), host)

    expect(status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Parking with id 42 not found',
        path: '/api/test',
      }),
    )
  })

  it('formats BadRequestException as 400 JSON response', () => {
    const filter = new HttpExceptionFilter()
    const { host, status, json } = makeHost()

    filter.catch(new BadRequestException(['lat must be a latitude']), host)

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 }),
    )
  })

  it('formats unknown errors as 500 JSON response', () => {
    const filter = new HttpExceptionFilter()
    const { host, status, json } = makeHost()

    filter.catch(new Error('boom'), host)

    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Internal server error' }),
    )
  })
})
