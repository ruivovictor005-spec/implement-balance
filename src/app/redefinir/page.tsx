'use client';
import * as React from 'react';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { redefinirAcao } from '../recuperar/acoes.js';

export default function Redefinir() {
  return (
    <Suspense>
      <RedefinirForm />
    </Suspense>
  );
}

function RedefinirForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);

  async function redefinir(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await redefinirAcao(email, codigo, senha);
    setEnviando(false);
    if (r.erro) setErro(r.erro);
    else setFeito(true);
  }

  return (
    <main className="home">
      <h1>
        <span className="marca-glow">Implement Balance</span>
      </h1>
      <p className="sub">Defina uma nova senha com o código do e-mail.</p>
      <section className="cartao" style={{ maxWidth: 440 }}>
        <h2>Redefinir senha</h2>
        {feito ? (
          <>
            <div className="reconhecido">Senha redefinida. Já pode entrar com a nova senha.</div>
            <p className="sub" style={{ margin: '14px 0 0' }}>
              <a href="/entrar">Ir para entrar</a>
            </p>
          </>
        ) : (
          <form onSubmit={redefinir}>
            <label htmlFor="email">E-mail corporativo</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label htmlFor="codigo" style={{ marginTop: 12 }}>Código recebido por e-mail</label>
            <input id="codigo" type="text" inputMode="numeric" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
            <label htmlFor="senha" style={{ marginTop: 12 }}>Nova senha (mínimo 8 caracteres)</label>
            <input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" required />
            {erro && <div className="erro">{erro}</div>}
            <div className="linha-acoes">
              <button type="submit" disabled={enviando}>{enviando ? 'Salvando…' : 'Redefinir senha'}</button>
            </div>
          </form>
        )}
        <p className="sub" style={{ margin: '14px 0 0' }}>
          <a href="/recuperar">Pedir um novo código</a> · <a href="/entrar">Entrar</a>
        </p>
      </section>
    </main>
  );
}
