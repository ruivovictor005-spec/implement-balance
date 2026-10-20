/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pacotes só de servidor (usam fs/net): o Next os carrega em runtime em vez de empacotar.
  serverExternalPackages: ['pg', 'pg-connection-string', 'pgpass', '@electric-sql/pglite'],
  webpack: (config, { isServer }) => {
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
    return config;
  },
};

export default nextConfig;
