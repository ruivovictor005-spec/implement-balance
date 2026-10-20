import * as React from 'react';
import { Tela } from './Tela.js';

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Tela id={Number(id)} />;
}
