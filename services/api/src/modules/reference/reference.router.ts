import { Router } from 'express';
import { prisma } from '../../db/prisma.js';

export const referenceRouter = Router();

referenceRouter.get('/countries', async (_req, res) => {
  const data = await prisma.referenceCountry.findMany({
    where: { isActive: true },
    orderBy: [{ nameEn: 'asc' }],
  });
  res.json({ data });
});

referenceRouter.get('/uz/regions', async (_req, res) => {
  const data = await prisma.referenceUzRegion.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
  });
  res.json({ data });
});

referenceRouter.get('/uz/districts', async (req, res) => {
  const regionId = String(req.query['regionId'] ?? '');
  const data = await prisma.referenceUzDistrict.findMany({
    where: { isActive: true, ...(regionId ? { regionId } : {}) },
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
  });
  res.json({ data });
});

referenceRouter.get('/uz/settlements', async (req, res) => {
  const districtId = String(req.query['districtId'] ?? '');
  const data = await prisma.referenceUzSettlement.findMany({
    where: { isActive: true, ...(districtId ? { districtId } : {}) },
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
  });
  res.json({ data });
});
