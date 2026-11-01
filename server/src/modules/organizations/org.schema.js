import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().trim().min(2, 'Organization name must be at least 2 characters').max(100),
  slug: z.string().trim().toLowerCase().min(2).max(100).optional(),
  contactEmail: z.string().trim().email('Invalid contact email').toLowerCase().optional(),
});

export const updateOrgSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100)
    .optional(),
  contactEmail: z.string().trim().email('Invalid contact email').toLowerCase().optional(),
  isActive: z.boolean().optional(),
});

export const inviteMemberSchema = z.object({
  email: z
    .string({ required_error: 'User email is required' })
    .trim()
    .email('Invalid email address')
    .toLowerCase(),
  role: z
    .enum(['owner', 'admin', 'member'], {
      errorMap: () => ({ message: "Role must be 'owner', 'admin', or 'member'" }),
    })
    .default('member'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member'], {
    errorMap: () => ({ message: "Role must be 'owner', 'admin', or 'member'" }),
  }),
});
