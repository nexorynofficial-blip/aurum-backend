import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { ApiError } from '@/utils/apiError';

export async function getProfile(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
  });
  res.json({ user });
}

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

export async function updateProfile(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const data = updateSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data,
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  res.json({ user });
}

// ---- Addresses ----
const addressSchema = z.object({
  label: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zipCode: z.string().min(1),
  country: z.string().min(1),
  isDefault: z.boolean().optional(),
});

export async function listAddresses(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const addresses = await prisma.address.findMany({
    where: { userId: req.user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  res.json({ addresses });
}

export async function createAddress(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const data = addressSchema.parse(req.body);
  if (data.isDefault) {
    await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
  }
  const address = await prisma.address.create({ data: { ...data, userId: req.user.id } });
  res.status(201).json({ address });
}

export async function updateAddress(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const data = addressSchema.partial().parse(req.body);
  const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!existing) throw ApiError.notFound('Address not found');
  if (data.isDefault) {
    await prisma.address.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } });
  }
  const address = await prisma.address.update({ where: { id: existing.id }, data });
  res.json({ address });
}

export async function deleteAddress(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await prisma.address.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ message: 'Address removed' });
}
