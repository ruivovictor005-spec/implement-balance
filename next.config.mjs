/** @type {import('next').NextConfig} */
const nextConfig = {
  // O projeto importa com extensão `.js` apontando para arquivos `.ts`/`.tsx` (padrão NodeNext,
  // que o tsc e o vitest resolvem). O webpack do Next precisa da mesma regra para achar os módulos.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
