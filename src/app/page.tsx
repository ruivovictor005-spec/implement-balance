import * as React from 'react';
import { minhasImplantacoesAbertas } from './implantacao/acoes.js';
import { Mesa } from './implantacao/_componentes/Mesa.js';

export default async function Pagina() {
  const abertas = await minhasImplantacoesAbertas();
  return <Mesa abertas={abertas} />;
}
