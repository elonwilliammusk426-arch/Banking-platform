const requiredInProduction = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_MFA_SECRET', 'MFA_ENCRYPTION_KEY', 'DATA_ENCRYPTION_KEY'] as const;

export function validateEnvironment(config: Record<string, unknown>) {
  if (config.NODE_ENV === 'production') {
    for (const key of requiredInProduction) {
      const value = String(config[key] ?? '');
      if (value.length < 32 && key !== 'DATABASE_URL') throw new Error(`${key} must be at least 32 characters`);
      if (!value || value.includes('replace-with')) throw new Error(`${key} must be configured with a non-placeholder value`);
    }
  }
  return config;
}
