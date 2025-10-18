import { z } from 'zod';

// Stack schemas
export const StackPRSchema = z.object({
  number: z.number().int().positive(),
  order: z.number().int().nonnegative(),
});

export const StackSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  prs: z.array(StackPRSchema),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateStackSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  prs: z.array(StackPRSchema),
});

export const UpdateStackSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  prs: z.array(StackPRSchema).optional(),
});

// Config schemas
export const ConfigureGithubSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  token: z.string().min(1),
});

export const GithubConfigSchema = z.object({
  owner: z.string(),
  repo: z.string(),
});

// Error schema
export const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
});
