import { z } from 'zod';

const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').optional(),
    firstName: z.string().trim().min(1, 'First name is required').optional(),
    lastName: z.string().trim().min(1, 'Last name is required').optional(),
    email: z
      .string({ required_error: 'Email is required' })
      .trim()
      .email('Invalid email address')
      .toLowerCase(),
    password: passwordSchema,
    organizationName: z.string().trim().min(1).optional(),
  })
  .refine(
    (data) => (data.firstName && data.lastName) || (data.name && data.name.trim().length > 0),
    {
      message: 'Either name or both firstName and lastName must be provided',
      path: ['name'],
    }
  );

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address')
    .toLowerCase(),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  currentPassword: z.string().optional(),
  newPassword: passwordSchema.optional(),
});
