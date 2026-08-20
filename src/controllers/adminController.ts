import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { toNumber } from '../utils/validators';
import { ApiError } from '../utils/apiError';
import { uploadImageToS3 } from '../services/imageService';
import { sendShippingUpdateEmail } from '../services/emailService';

const STATUS_MAP: Record<string, string> = {
  PENDING: 'pending',
  DISPATCHED: 'dispatched',
  DELIVERED: 'delivered',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
};

export async function stats(_req: Request, res: Response) {
  const [orders, products, customers, paidOrders, lowStock] = await Promise.all([
    prisma.order.count(),
    prisma.product.count(),
    prisma.user.count(),
    prisma.order.findMany({ where: { paidAt: { not: null } }, select: { total: true } }),
    prisma.product.count({ where: { stock: { lte: 2 } } }),
  ]);
  const revenue = paidOrders.reduce((sum, o) => sum + toNumber(o.total), 0);
  res.json({
    orders,
    products,
    customers,
    revenue: Math.round(revenue * 100) / 100,
    lowStock,
  });
}

export async function listAllOrders(req: Request, res: Response) {
  const status = (req.query.status as string | undefined)?.toUpperCase();
  const orders = await prisma.order.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { lineItems: true } } },
    take: 200,
  });
  res.json({
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: STATUS_MAP[o.status],
      total: toNumber(o.total),
      customer: o.guestEmail ?? o.userId ?? 'account',
      itemCount: o._count.lineItems,
      createdAt: o.createdAt,
      paid: Boolean(o.paidAt),
    })),
  });
}

const orderUpdateSchema = z.object({
  status: z.enum(['PENDING', 'DISPATCHED', 'DELIVERED', 'RETURNED', 'CANCELLED']).optional(),
  trackingNumber: z.string().optional(),
});

export async function updateOrder(req: Request, res: Response) {
  const data = orderUpdateSchema.parse(req.body);
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { user: true } });
  if (!order) throw ApiError.notFound('Order not found');

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: data.status,
      trackingNumber: data.trackingNumber,
      dispatchedAt: data.status === 'DISPATCHED' ? new Date() : order.dispatchedAt,
      deliveredAt: data.status === 'DELIVERED' ? new Date() : order.deliveredAt,
    },
  });

  if (data.status === 'DISPATCHED' && data.trackingNumber) {
    const to = order.user?.email ?? order.guestEmail;
    if (to) await sendShippingUpdateEmail(to, order.orderNumber, data.trackingNumber);
  }

  res.json({ order: { id: updated.id, status: STATUS_MAP[updated.status] } });
}

const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  story: z.string().optional(),
  price: z.number().nonnegative(),
  cost: z.number().nonnegative().optional(),
  images: z.array(z.string()).default([]),
  material: z.string().optional(),
  color: z.string().optional(),
  stoneType: z.string().optional(),
  weight: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative().default(0),
  isNew: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  collectionSlugs: z.array(z.string()).optional(),
});

export async function createProduct(req: Request, res: Response) {
  const data = productSchema.parse(req.body);
  const { collectionSlugs, ...fields } = data;

  const product = await prisma.product.create({
    data: {
      ...fields,
      collections: collectionSlugs
        ? {
            create: await Promise.all(
              collectionSlugs.map(async (slug) => {
                const collection = await prisma.collection.findUnique({ where: { slug } });
                if (!collection) throw ApiError.badRequest(`Unknown collection: ${slug}`);
                return { collectionId: collection.id };
              })
            ),
          }
        : undefined,
    },
  });
  res.status(201).json({ product: { id: product.id, slug: product.slug } });
}

export async function updateProduct(req: Request, res: Response) {
  const data = productSchema.partial().parse(req.body);
  const { collectionSlugs, ...fields } = data;
  const product = await prisma.product.update({ where: { id: req.params.id }, data: fields });
  res.json({ product: { id: product.id, slug: product.slug } });
}

export async function deleteProduct(req: Request, res: Response) {
  await prisma.product.delete({ where: { id: req.params.id } });
  res.json({ message: 'Product deleted' });
}

export async function uploadProductImage(req: Request, res: Response) {
  const file = req.file;
  if (!file) throw ApiError.badRequest('No file provided');
  const url = await uploadImageToS3(file.buffer, file.originalname, file.mimetype);
  res.json({ imageUrl: url });
}

/* ============================================================
   Dashboard — KPIs, revenue trend, top pieces, alerts
   ============================================================ */
export async function dashboard(_req: Request, res: Response) {
  const [orderCount, productCount, customerCount, paidOrders, lowStock, recent, lineItems] =
    await Promise.all([
      prisma.order.count(),
      prisma.product.count(),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.order.findMany({
        where: { paidAt: { not: null } },
        select: { total: true, createdAt: true },
      }),
      prisma.product.findMany({
        where: { stock: { lte: 2 } },
        orderBy: { stock: 'asc' },
        select: { name: true, sku: true, stock: true },
        take: 8,
      }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: { _count: { select: { lineItems: true } } },
      }),
      prisma.orderLineItem.findMany({
        where: { order: { paidAt: { not: null } } },
        select: { productName: true, quantity: true, priceAtPurchase: true, productId: true },
      }),
    ]);

  const revenue = paidOrders.reduce((s, o) => s + toNumber(o.total), 0);
  const aov = paidOrders.length ? revenue / paidOrders.length : 0;

  // Revenue by month for the last 12 months.
  const now = new Date();
  const series: { label: string; value: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const value = paidOrders
      .filter((o) => o.createdAt >= d && o.createdAt < next)
      .reduce((s, o) => s + toNumber(o.total), 0);
    series.push({ label: d.toLocaleString('en', { month: 'short' }), value: Math.round(value / 1000) });
  }

  // Top pieces by units sold.
  const byProduct = new Map<string, { name: string; sku: string; sold: number; revenue: number }>();
  for (const li of lineItems) {
    const key = li.productId;
    const cur = byProduct.get(key) ?? { name: li.productName, sku: '', sold: 0, revenue: 0 };
    cur.sold += li.quantity;
    cur.revenue += toNumber(li.priceAtPurchase) * li.quantity;
    byProduct.set(key, cur);
  }
  const top = [...byProduct.values()].sort((a, b) => b.sold - a.sold).slice(0, 5);

  res.json({
    stats: {
      revenue: Math.round(revenue * 100) / 100,
      orders: orderCount,
      customers: customerCount,
      products: productCount,
      aov: Math.round(aov * 100) / 100,
      lowStock: lowStock.length,
    },
    revenueSeries: series,
    topProducts: top,
    inventoryAlerts: lowStock,
    recentOrders: recent.map((o) => ({
      orderNumber: o.orderNumber,
      customer: o.guestEmail ?? o.guestFirstName ?? (o.userId ? 'Account' : 'Guest'),
      status: STATUS_MAP[o.status],
      total: toNumber(o.total),
      items: o._count.lineItems,
      date: o.createdAt,
    })),
  });
}

/* ============================================================
   Products — full catalogue (published + draft), searchable
   ============================================================ */
export async function listProducts(req: Request, res: Response) {
  const search = (req.query.search as string | undefined)?.trim();
  const rows = await prisma.product.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    include: { collections: { include: { collection: true } } },
    take: 200,
  });
  res.json({
    products: rows.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      slug: p.slug,
      category: p.collections[0]?.collection.slug ?? '—',
      price: toNumber(p.price),
      stock: p.stock,
      image: p.images[0] ?? null,
      isPublished: p.isPublished,
    })),
  });
}

export async function getProduct(req: Request, res: Response) {
  const p = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { collections: { include: { collection: true } } },
  });
  if (!p) throw ApiError.notFound('Product not found');
  res.json({
    id: p.id,
    sku: p.sku,
    name: p.name,
    slug: p.slug,
    description: p.description,
    story: p.story ?? '',
    price: toNumber(p.price),
    cost: toNumber(p.cost),
    images: p.images,
    material: p.material ?? '',
    color: p.color ?? '',
    stoneType: p.stoneType ?? '',
    weight: toNumber(p.weight),
    stock: p.stock,
    isNew: p.isNew,
    isPublished: p.isPublished,
    collectionSlugs: p.collections.map((c) => c.collection.slug),
  });
}

/* ============================================================
   Collections / Customers / Order detail
   ============================================================ */
export async function listCollections(_req: Request, res: Response) {
  const rows = await prisma.collection.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: true } } },
  });
  res.json({
    collections: rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      image: c.image,
      productCount: c._count.products,
      isPublished: c.isPublished,
      sortOrder: c.sortOrder,
    })),
  });
}

export async function listCustomers(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    where: { role: 'CUSTOMER' },
    orderBy: { createdAt: 'desc' },
    include: { orders: { select: { total: true, createdAt: true, paidAt: true } } },
    take: 200,
  });
  res.json({
    customers: users.map((u) => {
      const paid = u.orders.filter((o) => o.paidAt);
      const spent = paid.reduce((s, o) => s + toNumber(o.total), 0);
      const last = u.orders.reduce<Date | null>(
        (acc, o) => (!acc || o.createdAt > acc ? o.createdAt : acc),
        null
      );
      return {
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        orders: u.orders.length,
        spent: Math.round(spent * 100) / 100,
        last,
        joined: u.createdAt,
      };
    }),
  });
}

export async function getOrderDetail(req: Request, res: Response) {
  const o = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { lineItems: true, shippingMethod: true, user: true },
  });
  if (!o) throw ApiError.notFound('Order not found');
  res.json({
    id: o.id,
    orderNumber: o.orderNumber,
    status: STATUS_MAP[o.status],
    createdAt: o.createdAt,
    paid: Boolean(o.paidAt),
    customer: o.user ? `${o.user.firstName} ${o.user.lastName}` : o.guestFirstName ?? 'Guest',
    email: o.user?.email ?? o.guestEmail,
    subtotal: toNumber(o.subtotal),
    tax: toNumber(o.taxAmount),
    shipping: toNumber(o.shippingCost),
    total: toNumber(o.total),
    trackingNumber: o.trackingNumber ?? '',
    notes: o.notes ?? '',
    shippingAddress: o.shippingAddress,
    shippingMethod: o.shippingMethod.name,
    lineItems: o.lineItems.map((li) => ({
      productName: li.productName,
      image: li.image,
      quantity: li.quantity,
      priceAtPurchase: toNumber(li.priceAtPurchase),
      variant: li.variant,
    })),
  });
}
