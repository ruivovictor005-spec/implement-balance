import * as React from 'react';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Implantação de Saldos',
  description: 'Converte o balancete de origem no arquivo de importação posicional do Domínio.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
