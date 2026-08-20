import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { toNumber } from '../utils/validators';
import { ApiError } from '../utils/apiError';

const STATUS_MAP: Record<string, string> = {
  PENDING: 'pending',
  DISPATCHED: 'dispatched',
  DELIVERED: 'delivered',
  RETURNED: 'returned',
  CANCELLED: 'cancelled',
};

export async function listOrders(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();

  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { lineItems: true } } },
  });

  res.json({
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: STATUS_MAP[o.status],
      total: toNumber(o.total),
      createdAt: o.createdAt,
      itemCount: o._count.lineItems,
    })),
  });
}

export async function getOrder(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();

  const order = await prisma.order.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: { lineItems: true, shippingMethod: true },
  });
  if (!order) throw ApiError.notFound('Order not found');

  const eta = new Date(order.createdAt);
  eta.setDate(eta.getDate() + order.shippingMethod.estimatedDays);

  res.json({
    id: order.id,
    orderNumber: order.orderNumber,
    status: STATUS_MAP[order.status],
    createdAt: order.createdAt,
    subtotal: toNumber(order.subtotal),
    tax: toNumber(order.taxAmount),
    shipping: toNumber(order.shippingCost),
    total: toNumber(order.total),
    trackingNumber: order.trackingNumber ?? undefined,
    estimatedDelivery: eta.toISOString().slice(0, 10),
    shippingAddress: order.shippingAddress,
    notes: order.notes ?? undefined,
    lineItems: order.lineItems.map((li) => ({
      productId: li.productId,
      productName: li.productName,
      image: li.image ?? undefined,
      quantity: li.quantity,
      priceAtPurchase: toNumber(li.priceAtPurchase),
      variant: li.variant ?? undefined,
    })),
  });
}
