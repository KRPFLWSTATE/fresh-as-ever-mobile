import { z } from 'zod';

const urlOrEmpty = z.union([z.literal(''), z.string().url()]);

/** When env keys are populated, tolerate only well-formed URLs (plan § X / p1-env-zod-multi-flavor). */
export const appEnvSchema = z.object({
  supabaseUrl: urlOrEmpty,
  supabaseAnonKey: z.string(),
  apiBaseUrl: z.union([
    z.literal(''),
    z.string().regex(/^https?:\/\/.+/),
  ]),
  payHereReturnHost: z.union([z.literal(''), z.string().url()]).optional(),
});

export type ParsedAppEnv = z.infer<typeof appEnvSchema>;
