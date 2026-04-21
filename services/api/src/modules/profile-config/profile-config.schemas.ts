import { z } from 'zod';

export const updateProfileFieldVisibilitySchema = z.object({
  key: z.string().min(1),
  isVisibleInCabinet: z.boolean(),
});

export const bulkUpdateProfileFieldVisibilitySchema = z.object({
  fields: z.array(
    z.object({
      key: z.string().min(1),
      isVisibleInCabinet: z.boolean(),
    })
  ).min(1),
});

export const profileFieldVisibilityResponseSchema = z.object({
  key: z.string(),
  sectionKey: z.string(),
  label: z.object({
    ru: z.string(),
    en: z.string(),
  }),
  type: z.string(),
  isVisibleInCabinet: z.boolean(),
  allowEventRequirement: z.boolean(),
  isCompositeRequirement: z.boolean(),
  usedInEventsCount: z.number(),
  usedInEvents: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
    })
  ).optional(),
});

export const profileFieldsListResponseSchema = z.object({
  data: z.array(profileFieldVisibilityResponseSchema),
});

export type UpdateProfileFieldVisibilityInput = z.infer<typeof updateProfileFieldVisibilitySchema>;
export type BulkUpdateProfileFieldVisibilityInput = z.infer<typeof bulkUpdateProfileFieldVisibilitySchema>;
