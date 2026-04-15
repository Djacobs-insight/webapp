import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
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
