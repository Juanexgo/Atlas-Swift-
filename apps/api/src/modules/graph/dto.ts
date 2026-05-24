/**
 * DTOs are zod schemas — same source-of-truth as the rest of Atlas.
 * We adapt at the controller boundary with a thin parse step rather
 * than re-deriving class-validator decorators.
 */
import { z } from 'zod';
import { NodeKindSchema, EdgeKindSchema, NodeStatusSchema } from '@atlas/types';

export const CreateNodeDtoSchema = z.object({
  id: z.string().optional(),
  kind: NodeKindSchema,
  title: z.string().min(1),
  body: z.string().default(''),
  x: z.number().default(0),
  y: z.number().default(0),
  weight: z.number().min(0).max(1).default(0.5),
  tags: z.array(z.string()).default([]),
  status: NodeStatusSchema.default('active'),
  projectId: z.string().nullable().default(null),
});
export type CreateNodeDto = z.infer<typeof CreateNodeDtoSchema>;

export const UpdateNodeDtoSchema = CreateNodeDtoSchema.partial();
export type UpdateNodeDto = z.infer<typeof UpdateNodeDtoSchema>;

export const CreateEdgeDtoSchema = z.object({
  id: z.string().optional(),
  source: z.string(),
  target: z.string(),
  kind: EdgeKindSchema.default('link'),
  strength: z.number().min(0).max(1).default(0.5),
});
export type CreateEdgeDto = z.infer<typeof CreateEdgeDtoSchema>;
