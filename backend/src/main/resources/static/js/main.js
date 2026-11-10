import { api } from "./api.js";
import { $, $$, blocoErro, esqueleto, eventos, fecharGaveta, gavetaAberta, html } from "./ui.js";
import * as calendario from "./views/calendario.js";
import * as ciclos from "./views/ciclos.js";
import * as config from "./views/config.js";
import * as equipes from "./views/equipes.js";
import * as painel from "./views/painel.js";
import * as relatorios from "./views/relatorios.js";

const ROTAS = { "": painel, equipes, calendario, relatorios, ciclos, config };

const conteudo = $("#conteudo");
let limparTela = null;
let rotaAtual = null;
let consultaAtual = null;
let geracao = 0;

function lerRota() {
  const [caminho, consulta = ""] = location.hash.replace(/^#\/?/, "").split("?");
  return { nome: ROTAS[caminho] ? caminho : "", consulta, params: new URLSearchParams(consulta) };
}

async function navegar({ manterRolagem = false } = {}) {
  const { nome, consulta, params } = lerRota();
  const tela = ROTAS[nome];
  const mesmaTela = rotaAtual === nome && consultaAtual === consulta;
  rotaAtual = nome;
  consultaAtual = consulta;
  const minhaGeracao = ++geracao;
  const rolagem = window.scrollY;

  if (typeof limparTela === "function") limparTela();
  limparTela = null;
  if (!mesmaTela) fecharGaveta(true);

  $$("[data-rota]").forEach((a) => {
    if (a.dataset.rota === nome) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.title = `${tela.titulo} | Monitoramento GEPAG`;

  // A tela desenha num contêiner que já está no documento (as telas consultam elementos dele depois).
  // Ao recarregar a mesma tela, o conteúdo antigo fica visível até o novo ficar pronto.
  const destino = document.createElement("div");
  if (manterRolagem) {
    destino.hidden = true;
    conteudo.append(destino);
  } else {
    destino.innerHTML = String(html`<div class="painel">${esqueleto(5)}</div>`);
    conteudo.replaceChildren(destino);
  }
  try {
    const limpar = await tela.render(destino, params);
    if (minhaGeracao !== geracao) {
      if (typeof limpar === "function") limpar();
      destino.remove();
      return;
    }
    conteudo.replaceChildren(destino);
    destino.hidden = false;
    limparTela = limpar;
  } catch (e) {
    if (minhaGeracao !== geracao) {
      destino.remove();
      return;
    }
    destino.innerHTML = String(html`<div class="painel">${blocoErro(e.message)}</div>`);
    conteudo.replaceChildren(destino);
    destino.hidden = false;
    $("[data-recarregar]", destino)?.addEventListener("click", () => navegar());
  }
  if (manterRolagem) window.scrollTo(0, rolagem);
  else if (!mesmaTela) {
    window.scrollTo(0, 0);
    $("h1", conteudo)?.focus?.();
  }
}

// ---------- Navegação: andamento do ciclo atual ----------

async function atualizarNavegacao() {
  try {
    const atual = await api.get("/ciclos/atual");
    const bloco = $("[data-nav-ciclo]");
    bloco.hidden = !atual;
    const espera = atual && !atual.ciclo.encerrado ? atual.ciclo.aguardandoTerceiros : 0;
    $$("[data-contador-espera]").forEach((el) => {
      el.textContent = espera;
      el.hidden = espera === 0;
    });
    if (!atual) return;
    const c = atual.ciclo;
    const progresso = c.totalTarefas ? c.encerradas / c.totalTarefas : 0;
    $("[data-nav-ciclo-texto]").innerHTML = String(html`<b>${c.nome}</b><br>${c.encerradas} de ${c.totalTarefas} demandas encerradas`);
    $("[data-nav-ciclo-barra]").style.width = `${(progresso * 100).toFixed(1)}%`;
  } catch {
    // a navegação continua funcionando sem os números
  }
}

eventos.addEventListener("dados", () => {
  atualizarNavegacao();
  const tela = ROTAS[lerRota().nome];
  if (tela.recarregarAoAlterar !== false) navegar({ manterRolagem: true });
});

// Os tempos correm sozinhos: a cada minuto a tela é redesenhada (se ninguém estiver editando),
// o que também traz as alterações feitas por colegas.
setInterval(() => {
  const tela = ROTAS[lerRota().nome];
  const editando = document.activeElement?.matches?.("input, textarea, select");
  if (document.visibilityState !== "visible" || gavetaAberta() || editando || tela.recarregarAoAlterar === false) return;
  atualizarNavegacao();
  navegar({ manterRolagem: true });
}, 60000);

window.addEventListener("hashchange", () => navegar());
navegar();
atualizarNavegacao();
