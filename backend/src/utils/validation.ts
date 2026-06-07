import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const idParamSchema = z.object({
  id: z.string().uuid('ID格式不正确'),
});

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid('项目ID格式不正确'),
});

export const validate = <T>(schema: z.ZodSchema<T>, data: any): T => {
  return schema.parse(data);
};

export const validateAsync = async <T>(schema: z.ZodSchema<T>, data: any): Promise<T> => {
  return schema.parseAsync(data);
};
