'use client';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { sair } from './sessao-acoes.js';

const LINKS: { href: string; rotulo: string }[] = [
  { href: '/', rotulo: 'Início' },
  { href: '/plano', rotulo: 'Plano de contas' },
  { href: '/concluidas', rotulo: 'Concluídas' },
  { href: '/sinonimos', rotulo: 'Sinônimos' },
];

const ativo = (href: string, caminho: string): boolean =>
  href === '/' ? caminho === '/' : caminho.startsWith(href);

const primeiroNome = (nome: string | null): string =>
  nome && nome.trim() !== '' ? nome.trim().split(/\s+/)[0] : 'Conta';

// Barra superior do app: marca "Implement Balance" + navegação (quando logado) + usuário/sair.
export function BarraTopo({ usuario }: { usuario: { nome: string | null } | null }) {
  const caminho = usePathname() ?? '/';
  return (
    <nav className="menu">
      <span className="menu-marca">
        <span className="mark" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5.5" width="18" height="3" rx="1.5" fill="#fff" />
            <rect x="3" y="10.5" width="12" height="3" rx="1.5" fill="#fff" opacity="0.82" />
            <rect x="3" y="15.5" width="15" height="3" rx="1.5" fill="#fff" opacity="0.58" />
          </svg>
        </span>
        <span className="marca-nome">
          Implement Balance
          <small>Leiaute 19 · Domínio</small>
        </span>
      </span>
      {usuario &&
        LINKS.map((l) => (
          <a key={l.href} href={l.href} className={ativo(l.href, caminho) ? 'ativo' : undefined}>
            {l.rotulo}
          </a>
        ))}
      <span className="menu-espaco" />
      {usuario ? (
        <>
          <span className="menu-usuario" title={usuario.nome ?? undefined}>
            {primeiroNome(usuario.nome)}
          </span>
          <form action={sair} style={{ margin: 0 }}>
            <button type="submit" className="menu-sair">
              Sair
            </button>
          </form>
        </>
      ) : (
        <span className="menu-tag">balancete → TXT</span>
      )}
    </nav>
  );
}
