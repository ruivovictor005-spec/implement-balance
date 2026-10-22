'use client';
import * as React from 'react';
import { useState } from 'react';
import { pedirCodigoAcao } from './acoes.js';

export default function Recuperar() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);

  async function pedir(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    await pedirCodigoAcao(nome, email);
    setEnviando(false);
    setFeito(true);
  }

  return (
    <main className="home">
      <h1>
        <span className="marca-glow">Implement Balance</span>
      </h1>
      <p className="sub">Recupere o acesso à sua conta.</p>
      <section className="cartao" style={{ maxWidth: 440 }}>
        <h2>Esqueci a senha</h2>
        {feito ? (
          <>
            <div className="reconhecido">
              Se o nome e o e-mail baterem com uma conta, enviamos um código de recuperação para o
              e-mail. Use-o na próxima tela.
            </div>
            <p className="sub" style={{ margin: '14px 0 0' }}>
              <a href={`/redefinir?email=${encodeURIComponent(email)}`}>Já tenho o código → redefinir senha</a>
            </p>
          </>
        ) : (
          <form onSubmit={pedir}>
            <p className="sub" style={{ marginTop: 0 }}>
              Informe o <strong>nome completo</strong> (exatamente como no cadastro) e o e-mail
              corporativo. Enviaremos um código para o seu e-mail.
            </p>
            <label htmlFor="nome">Nome completo</label>
            <input id="nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} required />
            <label htmlFor="email" style={{ marginTop: 12 }}>E-mail corporativo</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <div className="linha-acoes">
              <button type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar código'}</button>
            </div>
          </form>
        )}
        <p className="sub" style={{ margin: '14px 0 0' }}>
          <a href="/entrar">Voltar para entrar</a>
        </p>
      </section>
    </main>
  );
}
