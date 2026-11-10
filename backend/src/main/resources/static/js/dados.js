// Dados de apoio usados por várias telas (rótulos e usuários), com cache simples.
import { api } from "./api.js";

let opcoesCache = null;
let usuariosCache = null;

/** Rótulos dos enums, já indexados: op.status.EM_ANDAMENTO.rotulo, op.fase.SEAD.rotulo... */
export async function opcoes() {
  if (!opcoesCache) {
    const o = await api.get("/opcoes");
    const indice = (lista) => Object.fromEntries(lista.map((x) => [x.valor, x]));
    opcoesCache = {
      ...o,
      status: indice(o.status),
      listaStatus: o.status,
      fase: indice(o.fases),
      unidade: indice(o.unidades),
      tipoItem: indice(o.tiposItem),
    };
  }
  return opcoesCache;
}

export async function usuarios(recarregar = false) {
  if (!usuariosCache || recarregar) usuariosCache = await api.get("/usuarios");
  return usuariosCache;
}

export function limparUsuarios() {
  usuariosCache = null;
}
