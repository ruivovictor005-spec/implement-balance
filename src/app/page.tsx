import * as React from 'react';
import { minhaImplantacaoAberta } from './implantacao/acoes.js';
import { Mesa } from './implantacao/_componentes/Mesa.js';

export default async function Pagina() {
  const aberta = await minhaImplantacaoAberta();
  return <Mesa aberta={aberta} />;
}
