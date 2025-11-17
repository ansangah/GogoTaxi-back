import { z } from 'zod';
export const SignUpSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(64),
    name: z.string().min(1).max(30)
});
export const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(64)
});
