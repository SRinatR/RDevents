import { z } from 'zod';

export const profileFieldVisibilityPatchSchema = z.object({
  isVisibleInCabinet: z.boolean(),
});

export const profileFieldVisibilityBulkPatchSchema = z.object({
  items: z.array(z.object({
    key: z.string().trim().min(1),
    isVisibleInCabinet: z.boolean(),
  })).min(1),
});
