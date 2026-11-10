// Peças de interface compartilhadas: template seguro, avisos, painel lateral, selos.

class Seguro {
  constructor(valor) {
    this.valor = valor;
  }
  toString() {
    return this.valor;
  }
}

export function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function renderizar(valor) {
  if (valor instanceof Seguro) return valor.valor;
  if (Array.isArray(valor)) return valor.map(renderizar).join("");
  if (valor === null || valor === undefined || valor === false) return "";
  return esc(valor);
}

/** Template HTML que escapa toda interpolação, exceto outros templates `html`. */
export function html(partes, ...valores) {
  let saida = "";
  partes.forEach((parte, i) => {
    saida += parte + (i < valores.length ? renderizar(valores[i]) : "");
  });
  return new Seguro(saida);
}

export function cru(texto) {
  return new Seguro(texto);
}

export const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
export const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

// ---------- Eventos de dados ----------

export const eventos = new EventTarget();

/** Avisa a navegação e a tela atual de que algo mudou no servidor. */
export function dadosAlterados() {
  eventos.dispatchEvent(new Event("dados"));
}

// ---------- Avisos (toasts) ----------

export function avisar(mensagem, { tipo = "info", acao, duracao = 4500 } = {}) {
  const area = $("#toasts");
  const el = document.createElement("div");
  el.className = `toast ${tipo}`;
  el.setAttribute("role", tipo === "erro" ? "alert" : "status");
  el.innerHTML = String(html`<span>${mensagem}</span>${acao ? html`<button type="button">${acao.rotulo}</button>` : ""}`);
  if (acao) {
    $("button", el).addEventListener("click", () => {
      acao.executar();
      el.remove();
    });
  }
  area.append(el);
  while (area.children.length > 3) area.firstElementChild.remove();
  setTimeout(() => el.remove(), tipo === "erro" ? duracao * 2 : duracao);
}

export function avisarErro(erro) {
  avisar(erro?.message || String(erro), { tipo: "erro" });
}

/** Desabilita o botão enquanto a ação roda; mostra erro em aviso. */
export async function ocupado(botao, acao) {
  if (botao) {
    botao.disabled = true;
    botao.setAttribute("aria-busy", "true");
  }
  try {
    return await acao();
  } catch (e) {
    avisarErro(e);
    return undefined;
  } finally {
    if (botao) {
      botao.disabled = false;
      botao.removeAttribute("aria-busy");
    }
  }
}

// ---------- Painel lateral ----------

let gavetaAtual = null;

export function abrirGaveta({ rotulo, render }) {
  fecharGaveta(true);
  const veu = document.createElement("div");
  veu.className = "veu";
  const gaveta = document.createElement("aside");
  gaveta.className = "gaveta";
  gaveta.setAttribute("role", "dialog");
  gaveta.setAttribute("aria-modal", "true");
  gaveta.setAttribute("aria-label", rotulo);
  gaveta.tabIndex = -1;
  document.body.append(veu, gaveta);
  const focoAnterior = document.activeElement;

  const aoTeclar = (e) => {
    if (e.key === "Escape") fecharGaveta();
    if (e.key === "Tab") prenderFoco(e, gaveta);
  };
  veu.addEventListener("click", () => fecharGaveta());
  document.addEventListener("keydown", aoTeclar);
  gavetaAtual = { veu, gaveta, aoTeclar, focoAnterior };

  render(gaveta);
  requestAnimationFrame(() => {
    veu.classList.add("aberto");
    gaveta.classList.add("aberta");
    ($("[data-foco-inicial]", gaveta) || gaveta).focus();
  });
  return gaveta;
}

export function gavetaAberta() {
  return gavetaAtual !== null;
}

export function fecharGaveta(imediato = false) {
  if (!gavetaAtual) return;
  const { veu, gaveta, aoTeclar, focoAnterior } = gavetaAtual;
  gavetaAtual = null;
  document.removeEventListener("keydown", aoTeclar);
  const remover = () => {
    veu.remove();
    gaveta.remove();
  };
  if (imediato) {
    remover();
    return;
  }
  veu.classList.remove("aberto");
  gaveta.classList.remove("aberta");
  setTimeout(remover, 250);
  if (focoAnterior && document.contains(focoAnterior)) focoAnterior.focus();
}

function prenderFoco(evento, container) {
  const focaveis = $$("a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])", container)
    .filter((el) => el.offsetParent !== null);
  if (!focaveis.length) return;
  const primeiro = focaveis[0];
  const ultimo = focaveis[focaveis.length - 1];
  if (evento.shiftKey && document.activeElement === primeiro) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && document.activeElement === ultimo) {
    evento.preventDefault();
    primeiro.focus();
  }
}

// ---------- Selos e indicadores ----------

const CLASSE_STATUS = { PENDENTE: "", EM_ANDAMENTO: "lampada", ANULADO: "", VALIDADO: "ok", CONCLUIDA: "ok" };

/** Pendente e anulado neutros, em andamento em destaque, aguardando terceiros em laranja, validado e concluído em verde. */
export function classeStatus(status) {
  return CLASSE_STATUS[status] ?? "revisar";
}

export function seloStatus(status, rotulo) {
  return html`<span class="selo ${classeStatus(status)}">${rotulo}</span>`;
}

export function esqueleto(linhas = 4) {
  return html`<div class="esqueleto" aria-busy="true" aria-label="Carregando">${Array.from({ length: linhas }, () => html`<i></i>`)}</div>`;
}

export function blocoErro(mensagem) {
  return html`<div class="vazio"><strong>Não foi possível carregar.</strong><span>${mensagem}</span>
    <button class="botao pequeno" type="button" data-recarregar>Tentar de novo</button></div>`;
}
