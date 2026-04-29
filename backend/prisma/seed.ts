import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type SeedRow = {
  name: string
  address: string
  city: string
  parkingType: 'street' | 'garage' | 'private'
  latitude: number
  longitude: number
  totalSpots: number
  availableSpots: number
  pricePerHour: number
  isEvCharging?: boolean
  maxHeight?: number | null
  openingHours?: string | null
}

const PARKINGS: SeedRow[] = [
  // ────────── ZÜRICH (10) ──────────
  { name: 'PH Hohe Promenade', address: 'Promenadengasse 1, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3700, longitude: 8.5453, totalSpots: 220, availableSpots: 130, pricePerHour: 4.50, isEvCharging: true, maxHeight: 2.10, openingHours: '24/7' },
  { name: 'PH Urania', address: 'Uraniastrasse 3, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3744, longitude: 8.5407, totalSpots: 380, availableSpots: 95, pricePerHour: 4.00, isEvCharging: true, maxHeight: 2.00, openingHours: '24/7' },
  { name: 'PH Globus', address: 'Lintheschergasse 1, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3766, longitude: 8.5396, totalSpots: 540, availableSpots: 40, pricePerHour: 4.00, isEvCharging: false, maxHeight: 2.00, openingHours: 'Mo-Sa 06:00-24:00, So 08:00-22:00' },
  { name: 'PH Talgarten', address: 'Talstrasse 82, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3712, longitude: 8.5358, totalSpots: 130, availableSpots: 8, pricePerHour: 3.50, isEvCharging: false, maxHeight: 1.95, openingHours: '24/7' },
  { name: 'Strassenparkplätze Niederdorfstrasse', address: 'Niederdorfstrasse, 8001 Zürich', city: 'Zürich', parkingType: 'street', latitude: 47.3722, longitude: 8.5446, totalSpots: 25, availableSpots: 12, pricePerHour: 2.00, isEvCharging: false, maxHeight: null, openingHours: 'Mo-Fr 08:00-19:00, Sa 08:00-16:00' },
  { name: 'PH Opéra', address: 'Falkenstrasse 1, 8008 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3672, longitude: 8.5469, totalSpots: 290, availableSpots: 150, pricePerHour: 4.50, isEvCharging: true, maxHeight: 2.05, openingHours: '24/7' },
  { name: 'PH Jelmoli', address: 'Steinmühleplatz 1, 8001 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3742, longitude: 8.5350, totalSpots: 320, availableSpots: 18, pricePerHour: 4.00, isEvCharging: false, maxHeight: 2.00, openingHours: 'Mo-Sa 06:30-24:00, So 09:00-22:00' },
  { name: 'PH USZ', address: 'Sternwartstrasse 14, 8091 Zürich', city: 'Zürich', parkingType: 'garage', latitude: 47.3766, longitude: 8.5519, totalSpots: 220, availableSpots: 90, pricePerHour: 3.50, isEvCharging: true, maxHeight: 2.10, openingHours: '24/7' },
  { name: 'Strassenparkplätze Bellevue', address: 'Bellevueplatz, 8001 Zürich', city: 'Zürich', parkingType: 'street', latitude: 47.3666, longitude: 8.5455, totalSpots: 18, availableSpots: 0, pricePerHour: 2.50, isEvCharging: false, maxHeight: null, openingHours: 'Mo-Sa 08:00-21:00' },
  { name: 'Privatparkplatz Volkshaus', address: 'Stauffacherstrasse 60, 8004 Zürich', city: 'Zürich', parkingType: 'private', latitude: 47.3742, longitude: 8.5269, totalSpots: 12, availableSpots: 7, pricePerHour: 0.00, isEvCharging: false, maxHeight: null, openingHours: 'Mo-So 06:00-23:00' },

  // ────────── BERN (6) ──────────
  { name: 'PH Casino', address: 'Kochergasse 1, 3011 Bern', city: 'Bern', parkingType: 'garage', latitude: 46.9479, longitude: 7.4474, totalSpots: 320, availableSpots: 110, pricePerHour: 3.50, isEvCharging: true, maxHeight: 2.00, openingHours: '24/7' },
  { name: 'PH Rathaus', address: 'Rathausgasse 18, 3011 Bern', city: 'Bern', parkingType: 'garage', latitude: 46.9487, longitude: 7.4513, totalSpots: 260, availableSpots: 25, pricePerHour: 3.50, isEvCharging: false, maxHeight: 2.05, openingHours: '24/7' },
  { name: 'PH Metro', address: 'Waisenhausplatz 32, 3011 Bern', city: 'Bern', parkingType: 'garage', latitude: 46.9490, longitude: 7.4435, totalSpots: 360, availableSpots: 180, pricePerHour: 3.00, isEvCharging: true, maxHeight: 2.00, openingHours: '24/7' },
  { name: 'Strassenparkplätze Münsterplatz', address: 'Münsterplatz, 3011 Bern', city: 'Bern', parkingType: 'street', latitude: 46.9466, longitude: 7.4514, totalSpots: 35, availableSpots: 14, pricePerHour: 2.00, isEvCharging: false, maxHeight: null, openingHours: 'Mo-Sa 08:00-19:00' },
  { name: 'PH PostParc', address: 'Schanzenstrasse 5, 3008 Bern', city: 'Bern', parkingType: 'garage', latitude: 46.9495, longitude: 7.4380, totalSpots: 600, availableSpots: 320, pricePerHour: 3.00, isEvCharging: true, maxHeight: 2.10, openingHours: '24/7' },
  { name: 'Privatparkplatz Reitschule', address: 'Neubrückstrasse 8, 3012 Bern', city: 'Bern', parkingType: 'private', latitude: 46.9525, longitude: 7.4395, totalSpots: 15, availableSpots: 9, pricePerHour: 0.00, isEvCharging: false, maxHeight: null, openingHours: 'Mo-So 24/7' },

  // ────────── GENF (6) ──────────
  { name: 'Parking du Mont-Blanc', address: 'Rue du Mont-Blanc 19, 1201 Genève', city: 'Genève', parkingType: 'garage', latitude: 46.2087, longitude: 6.1457, totalSpots: 720, availableSpots: 230, pricePerHour: 3.80, isEvCharging: true, maxHeight: 2.05, openingHours: '24/7' },
  { name: 'Parking Cornavin', address: 'Place de Cornavin 7, 1201 Genève', city: 'Genève', parkingType: 'garage', latitude: 46.2096, longitude: 6.1421, totalSpots: 900, availableSpots: 450, pricePerHour: 3.50, isEvCharging: true, maxHeight: 2.00, openingHours: '24/7' },
  { name: 'Parking Plainpalais', address: 'Rond-Point de Plainpalais, 1205 Genève', city: 'Genève', parkingType: 'garage', latitude: 46.1972, longitude: 6.1410, totalSpots: 350, availableSpots: 60, pricePerHour: 2.80, isEvCharging: false, maxHeight: 2.10, openingHours: '24/7' },
  { name: 'Strassenparkplätze Bel-Air', address: 'Place de Bel-Air, 1204 Genève', city: 'Genève', parkingType: 'street', latitude: 46.2050, longitude: 6.1430, totalSpots: 22, availableSpots: 5, pricePerHour: 2.00, isEvCharging: false, maxHeight: null, openingHours: 'Mo-Sa 08:00-19:00' },
  { name: 'Parking de la Gare', address: 'Place de Cornavin, 1201 Genève', city: 'Genève', parkingType: 'garage', latitude: 46.2103, longitude: 6.1425, totalSpots: 280, availableSpots: 140, pricePerHour: 3.50, isEvCharging: false, maxHeight: 2.05, openingHours: '24/7' },
  { name: 'Privatparkplatz Pâquis', address: 'Rue de Berne 28, 1201 Genève', city: 'Genève', parkingType: 'private', latitude: 46.2120, longitude: 6.1480, totalSpots: 18, availableSpots: 11, pricePerHour: 0.00, isEvCharging: true, maxHeight: 1.95, openingHours: '24/7' },

  // ────────── BASEL (4) ──────────
  { name: 'PH Elisabethen', address: 'Steinentorstrasse 13, 4051 Basel', city: 'Basel', parkingType: 'garage', latitude: 47.5546, longitude: 7.5859, totalSpots: 540, availableSpots: 220, pricePerHour: 3.00, isEvCharging: true, maxHeight: 2.00, openingHours: '24/7' },
  { name: 'PH Steinen', address: 'Steinentorberg 25, 4051 Basel', city: 'Basel', parkingType: 'garage', latitude: 47.5552, longitude: 7.5895, totalSpots: 460, availableSpots: 35, pricePerHour: 2.80, isEvCharging: false, maxHeight: 2.05, openingHours: 'Mo-Sa 06:00-24:00, So 08:00-22:00' },
  { name: 'Strassenparkplätze Marktplatz', address: 'Marktplatz, 4051 Basel', city: 'Basel', parkingType: 'street', latitude: 47.5582, longitude: 7.5878, totalSpots: 14, availableSpots: 6, pricePerHour: 2.50, isEvCharging: false, maxHeight: null, openingHours: 'Mo-Sa 08:00-19:00' },
  { name: 'Privatparkplatz Kleinbasel', address: 'Riehenstrasse 154, 4058 Basel', city: 'Basel', parkingType: 'private', latitude: 47.5685, longitude: 7.6068, totalSpots: 22, availableSpots: 14, pricePerHour: 0.00, isEvCharging: false, maxHeight: null, openingHours: '24/7' },

  // ────────── LUZERN (4) ──────────
  { name: 'PH Bahnhof', address: 'Zentralstrasse 1, 6002 Luzern', city: 'Luzern', parkingType: 'garage', latitude: 47.0501, longitude: 8.3094, totalSpots: 460, availableSpots: 100, pricePerHour: 3.00, isEvCharging: true, maxHeight: 2.05, openingHours: '24/7' },
  { name: 'PH Flora', address: 'Hirschmattstrasse 13, 6003 Luzern', city: 'Luzern', parkingType: 'garage', latitude: 47.0497, longitude: 8.3056, totalSpots: 220, availableSpots: 12, pricePerHour: 2.50, isEvCharging: false, maxHeight: 2.00, openingHours: 'Mo-Sa 06:00-24:00' },
  { name: 'Strassenparkplätze Schwanenplatz', address: 'Schwanenplatz, 6004 Luzern', city: 'Luzern', parkingType: 'street', latitude: 47.0531, longitude: 8.3091, totalSpots: 18, availableSpots: 4, pricePerHour: 2.00, isEvCharging: false, maxHeight: null, openingHours: 'Mo-Sa 08:00-19:00' },
  { name: 'Privatparkplatz Tribschen', address: 'Tribschenstrasse 60, 6005 Luzern', city: 'Luzern', parkingType: 'private', latitude: 47.0421, longitude: 8.3197, totalSpots: 16, availableSpots: 11, pricePerHour: 0.00, isEvCharging: true, maxHeight: null, openingHours: '24/7' },
]

async function main(): Promise<void> {
  console.log(`Seeding ${PARKINGS.length} parkings...`)
  await prisma.parking.deleteMany()
  await prisma.parking.createMany({ data: PARKINGS })
  console.log(`Done. Inserted ${PARKINGS.length} rows.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
