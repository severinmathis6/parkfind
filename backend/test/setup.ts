import 'reflect-metadata'
import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach } from 'vitest'

const databaseUrl = process.env.DATABASE_URL_TEST
if (!databaseUrl) {
  throw new Error('DATABASE_URL_TEST must be set for integration tests')
}

let prisma: PrismaClient

beforeAll(() => {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  })
  prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
})

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE parkings RESTART IDENTITY CASCADE')
})

afterAll(async () => {
  await prisma.$disconnect()
})
