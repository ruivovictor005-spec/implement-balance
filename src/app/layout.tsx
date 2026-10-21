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
      <body>
        <nav className="menu">
          <span className="menu-marca">Implantação de Saldos</span>
          <a href="/">Minha mesa</a>
          <a href="/plano">Plano de contas</a>
          <a href="/concluidas">Concluídas</a>
          <a href="/sinonimos">Sinônimos</a>
          <a href="/painel">Painel</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
