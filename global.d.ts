declare module "prisma/config" {
  export interface PrismaDatasourceConfig {
    url: string;
  }

  export interface PrismaMigrationsConfig {
    path?: string;
  }

  export interface PrismaConfig {
    schema?: string;
    migrations?: PrismaMigrationsConfig;
    engine?: "classic" | "json";
    datasource?: PrismaDatasourceConfig;
  }

  export function defineConfig(config: PrismaConfig): PrismaConfig;
  export function env(name: string, fallback?: string): string;
}
