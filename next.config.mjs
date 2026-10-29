/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pacotes só de servidor (usam fs/net): o Next os carrega em runtime em vez de empacotar.
  serverExternalPackages: ['pg', 'pg-connection-string', 'pgpass', '@electric-sql/pglite', 'drizzle-orm'],
  webpack: (config, { isServer, nextRuntime, webpack }) => {
    // O projeto importa com extensão `.js` apontando para arquivos `.ts`/`.tsx` (padrão NodeNext,
    // que o tsc e o vitest resolvem). O webpack do Next precisa da mesma regra para achar os módulos.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.jsx': ['.tsx', '.jsx'],
    };
    // No servidor, deixa o driver do Postgres fora do bundle (ele usa fs/net e só roda em produção).
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        'pg',
        'pg-native',
        'pgpass',
        'pg-connection-string',
      ];
    }
    // O runtime edge não tem os módulos do Node (`node:crypto`), e o Next compila o hook de
    // instrumentação para os dois runtimes. O banco embutido só roda no nodejs (ver
    // instrumentation.ts), então no bundle edge o módulo é ignorado.
    if (nextRuntime === 'edge') {
      config.plugins.push(
        new webpack.IgnorePlugin({ resourceRegExp: /instrumentation\.node(\.js)?$/ }),
      );
    }
    return config;
  },
};

export default nextConfig;
