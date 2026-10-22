'use client';
import * as React from 'react';
import { useState } from 'react';
import { entrarAcao } from './acoes.js';

export default function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await entrarAcao(email, senha);
    setEnviando(false);
    if (r.erro) setErro(r.erro);
  }

  return (
    <main className="home">
      <h1>
        <span className="marca-glow">Implement Balance</span>
      </h1>
      <p className="sub">Entre com seu e-mail corporativo e senha.</p>
      <section className="cartao" style={{ maxWidth: 420 }}>
        <h2>Entrar</h2>
        <form onSubmit={entrar}>
          <label htmlFor="email">E-mail corporativo</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          <label htmlFor="senha" style={{ marginTop: 12 }}>Senha</label>
          <input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
          {erro && <div className="erro">{erro}</div>}
          <div className="linha-acoes">
            <button type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
          </div>
        </form>
        <p className="sub" style={{ margin: '14px 0 0' }}>
          <a href="/cadastro">Criar conta</a> · <a href="/recuperar">Esqueci a senha</a>
        </p>
      </section>
    </main>
  );
}
