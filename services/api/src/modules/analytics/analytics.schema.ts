import { z } from "zod";

export const getAnalyticsQuerySchema = {
  query: z.object({
    startDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    endDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    departmentId: z.string().uuid().optional(),
  }),
};
