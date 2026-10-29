import * as React from 'react';
import type { ReactNode } from 'react';
import './globals.css';
import { auth } from '../acesso/auth.js';
import { BarraTopo } from './_componentes/BarraTopo.js';

export const metadata = {
  title: 'Implement Balance',
  description: 'Converte o balancete de origem no arquivo de importação posicional do Domínio (leiaute 19).',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const sessao = await auth();
  const usuario = sessao?.user
    ? { nome: sessao.user.name ?? null, papel: (sessao as { papel?: string }).papel ?? 'usuario' }
    : null;
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <BarraTopo usuario={usuario} />
        {children}
      </body>
    </html>
  );
}
