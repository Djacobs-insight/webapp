import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_FACEBOOK_ID: z.string().optional(),
  AUTH_FACEBOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(env: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      "Invalid environment variables: " + JSON.stringify(parsed.error.format())
    );
  }
  return parsed.data;
}
