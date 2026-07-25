const { z } = require('zod');

const envSchema = z
  .object({
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().int().positive().default(3080),
    HOST: z.string().default('localhost'),
    POSTGRES_HOST: z.string().default('localhost'),
    POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
    POSTGRES_DB: z.string().min(1).default('lemefy'),
    POSTGRES_USER: z.string().min(1).default('lemefy'),
    POSTGRES_PASSWORD: z.string().min(1).default('lemefy_password'),
    MEILI_HOST: z.string().url().or(z.string().default('http://localhost:7700')),
    MEILI_MASTER_KEY: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    DOMAIN_CLIENT: z.string().url().optional(),
    DOMAIN_SERVER: z.string().url().optional(),
  })
  .passthrough();

const parse = () => {
  try {
    const result = envSchema.parse(process.env);
    Object.assign(process.env, result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[config] Invalid environment variables:');
      for (const issue of error.issues) {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      }
    }
    throw error;
  }
};

module.exports = { parse };
