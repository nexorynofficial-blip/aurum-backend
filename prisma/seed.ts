import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const collections = [
  { slug: 'rings', name: 'Rings', tagline: 'Signets, solitaires & bands', description: 'Conceived as heirlooms, set by hand.', image: '/images/rings-thumbnail.png', sortOrder: 0 },
  { slug: 'necklaces', name: 'Necklaces', tagline: 'Pendants & chains', description: 'Weighted, articulated, drawn to fall exactly.', image: '/images/necklace-thumbnail.png', sortOrder: 1 },
  { slug: 'earrings', name: 'Earrings', tagline: 'Studs, drops & hoops', description: 'Considered proportion and quiet movement.', image: '/images/earrings-thumbnail.png', sortOrder: 2 },
  { slug: 'bracelets', name: 'Bracelets', tagline: 'Cuffs & bangles', description: 'Sculptural forms in solid metal.', image: '/images/bracelet-thumbnail.png', sortOrder: 3 },
  { slug: 'timepieces', name: 'Timepieces', tagline: 'Mechanical watches', description: 'Precision as a discipline, not a feature.', image: '/images/timepiece-thumbnail.png', sortOrder: 4 },
  { slug: 'objects', name: 'Objects', tagline: 'Objets for the interior', description: 'Desk and vanity objects, made to last.', image: '/images/object-thumbnail.png', sortOrder: 5 },
];

type SeedProduct = {
  sku: string; name: string; slug: string; description: string; price: number;
  images: string[]; material: string; stoneType?: string; stock: number; collection: string; isNew?: boolean;
};

const products: SeedProduct[] = [
  { sku: 'AU-R-001', name: 'Aurum Signet', slug: 'aurum-signet', description: 'A plain gold signet, the defining object of the house.', price: 2400, images: ['/images/ring-1.png'], material: '18k Gold', stock: 6, collection: 'rings' },
  { sku: 'AU-R-002', name: 'Solstice Solitaire', slug: 'solstice-solitaire', description: 'A brilliant solitaire held in four slender claws.', price: 8600, images: ['/images/ring-2.png'], material: 'Platinum', stoneType: 'Diamond', stock: 2, collection: 'rings', isNew: true },
  { sku: 'AU-R-003', name: 'Meridian Band', slug: 'meridian-band', description: 'A clean band with a single flush-set stone.', price: 3100, images: ['/images/ring-3.png'], material: '18k Gold', stock: 9, collection: 'rings' },
  { sku: 'AU-N-001', name: 'Thread Pendant', slug: 'thread-pendant', description: 'A fine chain and a single suspended stone.', price: 1900, images: ['/images/necklace-1.png'], material: '18k Gold', stock: 8, collection: 'necklaces' },
  { sku: 'AU-N-002', name: 'Cascade Necklace', slug: 'cascade-necklace', description: 'An articulated fall of graduated links.', price: 5400, images: ['/images/necklace-2.png'], material: 'White Gold', stock: 4, collection: 'necklaces' },
  { sku: 'AU-N-003', name: 'Sable Sautoir', slug: 'sable-sautoir', description: 'A long rope, assembled link by link.', price: 6200, images: ['/images/necklace-3.png'], material: '18k Gold', stock: 3, collection: 'necklaces' },
  { sku: 'AU-E-001', name: 'Eclipse Studs', slug: 'eclipse-studs', description: 'Quiet studs to be worn morning to midnight.', price: 1500, images: ['/images/earring-1.png'], material: '18k Gold', stock: 7, collection: 'earrings' },
  { sku: 'AU-E-002', name: 'Lumen Drops', slug: 'lumen-drops', description: 'Drops with a considered, gentle movement.', price: 3300, images: ['/images/earring-2.png'], material: 'Platinum', stoneType: 'Diamond', stock: 5, collection: 'earrings', isNew: true },
  { sku: 'AU-E-003', name: 'Arc Hoops', slug: 'arc-hoops', description: 'Solid hoops with a reassuring weight.', price: 2100, images: ['/images/earring-3.png'], material: '18k Gold', stock: 9, collection: 'earrings' },
  { sku: 'AU-B-001', name: 'Monolith Cuff', slug: 'monolith-cuff', description: 'A sculptural cuff turned from solid metal.', price: 4200, images: ['/images/bracelet-1.png'], material: '18k Gold', stock: 4, collection: 'bracelets' },
  { sku: 'AU-B-002', name: 'Tether Chain Bracelet', slug: 'tether-chain-bracelet', description: 'A substantial chain for the wrist.', price: 2800, images: ['/images/bracelet-2.png'], material: 'White Gold', stock: 6, collection: 'bracelets' },
  { sku: 'AU-B-003', name: 'Halo Bangle', slug: 'halo-bangle', description: 'A plain bangle, perfectly round.', price: 2300, images: ['/images/bracelet-3.png'], material: '18k Gold', stock: 8, collection: 'bracelets' },
  { sku: 'AU-T-001', name: 'Atelier Automatic', slug: 'atelier-automatic', description: 'A mechanical measure of time, cased in gold.', price: 14800, images: ['/images/timepiece-1.png'], material: '18k Gold', stock: 2, collection: 'timepieces' },
  { sku: 'AU-T-002', name: 'Meridian Chronometer', slug: 'meridian-chronometer', description: 'Precision, worn.', price: 18600, images: ['/images/timepiece-2.png'], material: 'Platinum', stock: 1, collection: 'timepieces' },
  { sku: 'AU-O-001', name: 'Desk Seal', slug: 'desk-seal', description: 'A turned brass seal for the desk.', price: 780, images: ['/images/object-1.png'], material: 'Brass', stock: 9, collection: 'objects' },
  { sku: 'AU-O-002', name: 'Vanity Tray', slug: 'vanity-tray', description: 'A small tray for the objects you keep close.', price: 640, images: ['/images/object-2.png'], material: 'Brass', stock: 7, collection: 'objects' },
  { sku: 'AU-O-003', name: "Collector's Loupe", slug: 'collectors-loupe', description: 'A loupe made from the same materials as our jewellery.', price: 520, images: ['/images/object-3.png'], material: 'Brass', stock: 6, collection: 'objects' },
];

async function main() {
  console.log('Seeding AURUM database…');

  // Shipping methods
  await prisma.shippingMethod.upsert({
    where: { code: 'standard' },
    create: { code: 'standard', name: 'Standard (5–7 days)', baseCost: new Prisma.Decimal(0), estimatedDays: 7 },
    update: {},
  });
  await prisma.shippingMethod.upsert({
    where: { code: 'express' },
    create: { code: 'express', name: 'Express (2–3 days)', baseCost: new Prisma.Decimal(25), estimatedDays: 3 },
    update: {},
  });

  // Admin user
  const adminPassword = await bcrypt.hash('admin12345', 12);
  await prisma.user.upsert({
    where: { email: 'admin@aurum.luxury' },
    create: {
      email: 'admin@aurum.luxury',
      passwordHash: adminPassword,
      firstName: 'AURUM',
      lastName: 'Admin',
      role: 'ADMIN',
      emailVerified: true,
    },
    update: { role: 'ADMIN' },
  });

  // Collections
  const collectionIds = new Map<string, string>();
  for (const c of collections) {
    const row = await prisma.collection.upsert({
      where: { slug: c.slug },
      create: { ...c, isPublished: true },
      update: { ...c, isPublished: true },
    });
    collectionIds.set(c.slug, row.id);
  }

  // Products + collection links
  for (const p of products) {
    const { collection, ...fields } = p;
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      create: { ...fields, isPublished: true, weight: new Prisma.Decimal(5) },
      update: { ...fields, isPublished: true },
    });
    const collectionId = collectionIds.get(collection);
    if (collectionId) {
      await prisma.collectionProduct.upsert({
        where: { collectionId_productId: { collectionId, productId: product.id } },
        create: { collectionId, productId: product.id },
        update: {},
      });
    }
  }

  console.log(`Seeded ${collections.length} collections and ${products.length} products.`);
  console.log('Admin login → admin@aurum.luxury / admin12345');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
