// Quem está com o quê: demandas abertas por responsável e o que está parado esperando outras unidades.
import { api } from "../api.js";
import { abrirDemanda } from "../demanda-painel.js";
import { opcoes, usuarios } from "../dados.js";
import { duracao, plural } from "../formato.js";
import { $$, html, seloStatus } from "../ui.js";

export const titulo = "Quem está com o quê";

export async function render(raiz, params) {
  const cicloId = params.get("ciclo");
  const [detalhe, op, pessoas] = await Promise.all([
    cicloId ? api.get(`/ciclos/${cicloId}`) : api.get("/ciclos/atual"),
    opcoes(),
    usuarios(),
  ]);
  if (!detalhe) {
    raiz.innerHTML = String(html`<header class="cabecalho"><div><h1 tabindex="-1">Quem está com o quê</h1></div></header>
      <div class="painel vazio"><strong>Nenhum ciclo aberto.</strong><span>Abra um ciclo no <a href="#/">Painel</a>.</span></div>`);
    return;
  }
  const c = detalhe.ciclo;
  const abertas = detalhe.tarefas.filter((t) => !op.status[t.status].encerrado);
  const iniciadas = abertas.filter((t) => t.status !== "PENDENTE");
  // Demanda em "Aguardando ..." está com a outra unidade: sai do cartão da pessoa e vai para o da unidade.
  const comAPessoa = abertas.filter((t) => !op.status[t.status].aguardando);
  const doResponsavel = (id) => comAPessoa.filter((t) => t.responsavel?.id === id);
  const acompanhando = (id) => abertas.filter((t) => op.status[t.status].aguardando && t.responsavel?.id === id).length;

  const internos = pessoas.filter((p) => !p.externo && p.ativo);
  const comDemanda = internos.filter((p) => doResponsavel(p.id).length);
  const livres = internos.filter((p) => !doResponsavel(p.id).length);
  const externos = pessoas.filter((p) => p.externo && doResponsavel(p.id).length);
  const semResponsavel = iniciadas.filter((t) => !t.responsavel && !op.status[t.status].aguardando);

  // Espera por unidade externa, a mais antiga primeiro
  const esperas = Object.values(abertas.filter((t) => op.status[t.status].aguardando).reduce((acc, t) => {
    const u = op.status[t.status].aguardando;
    (acc[u] ??= { unidade: u, tarefas: [] }).tarefas.push(t);
    return acc;
  }, {})).map((g) => ({ ...g, maior: Math.max(...g.tarefas.map((t) => t.minutosNoStatusAtual)) }))
    .sort((a, b) => b.maior - a.maior);

  raiz.innerHTML = String(html`
    <header class="cabecalho"><div><h1 tabindex="-1">Quem está com o quê</h1>
      <p>${c.nome}: ${plural(abertas.length, "demanda aberta", "demandas abertas")}, ${plural(iniciadas.length, "já iniciada", "já iniciadas")}.
      Demandas pendentes que ainda não começaram aparecem só com o responsável.</p></div></header>

    ${esperas.length ? html`
      <section style="margin-bottom: 28px" aria-labelledby="t-espera">
        <div class="secao-titulo"><h2 id="t-espera">Aguardando outras unidades</h2></div>
        <div class="cartoes">${esperas.map((g) => cartao({
          titulo: `Aguardando ${op.unidade[g.unidade].rotulo}`,
          resumo: `${plural(g.tarefas.length, "demanda", "demandas")} · a mais antiga há ${duracao(g.maior)}`,
          tarefas: g.tarefas, op, alerta: true, mostrarQuemAcompanha: true,
        }))}</div>
      </section>` : ""}

    <section style="margin-bottom: 28px" aria-labelledby="t-gepag">
      <div class="secao-titulo"><h2 id="t-gepag">Equipe GEPAG</h2>
        ${livres.length ? html`<span class="mudo">Sem demandas com a pessoa: ${livres.map((p) => p.nome).join(", ")}</span>` : ""}</div>
      ${comDemanda.length ? html`<div class="cartoes">${comDemanda.map((p) => cartao({
        titulo: p.nome, resumo: resumoPessoa(doResponsavel(p.id), acompanhando(p.id)), tarefas: doResponsavel(p.id), op,
      }))}</div>` : html`<div class="painel vazio"><span>${internos.length
        ? "Ninguém da GEPAG tem demanda aberta atribuída neste ciclo."
        : html`Cadastre a equipe em <a href="#/config">Usuários e planilha</a> para atribuir demandas.`}</span></div>`}
    </section>

    ${externos.length ? html`
      <section style="margin-bottom: 28px" aria-labelledby="t-ext">
        <div class="secao-titulo"><h2 id="t-ext">Unidades externas responsáveis</h2></div>
        <div class="cartoes">${externos.map((p) => cartao({
          titulo: p.nome, resumo: resumoPessoa(doResponsavel(p.id)), tarefas: doResponsavel(p.id), op,
        }))}</div>
      </section>` : ""}

    ${semResponsavel.length ? html`
      <section aria-labelledby="t-sem">
        <div class="secao-titulo"><h2 id="t-sem">Iniciadas sem responsável</h2></div>
        <div class="cartoes">${cartao({ titulo: "Sem responsável", resumo: plural(semResponsavel.length, "demanda", "demandas"), tarefas: semResponsavel, op, alerta: true })}</div>
      </section>` : ""}`);

  $$("[data-abrir]", raiz).forEach((b) => b.addEventListener("click", () => abrirDemanda(Number(b.dataset.abrir), { encerrado: c.encerrado })));
}

function resumoPessoa(tarefas, acompanhando = 0) {
  const andamento = tarefas.filter((t) => t.status !== "PENDENTE").length;
  return `${plural(tarefas.length, "demanda", "demandas")}${andamento ? `, ${andamento} em andamento` : ""}`
    + (acompanhando ? ` · acompanha ${acompanhando} com outras unidades` : "");
}

function cartao({ titulo, resumo, tarefas, op, alerta = false, mostrarQuemAcompanha = false }) {
  const ordenadas = [...tarefas].sort((a, b) => (a.status === "PENDENTE") - (b.status === "PENDENTE") || b.minutosNoStatusAtual - a.minutosNoStatusAtual);
  return html`<article class="painel cartao ${alerta ? "espera" : ""}">
    <header><h3>${titulo}</h3><span class="pequeno mudo">${resumo}</span></header>
    <ul class="lista">${ordenadas.map((t) => html`<li>
      <button class="mini-demanda" type="button" data-abrir="${t.id}">
        <span class="titulo">${t.titulo}</span>
        <span class="info">${seloStatus(t.status, op.status[t.status].rotulo)}
          <span class="num">${t.status === "PENDENTE" && !t.iniciadaEm ? op.fase[t.fase].rotulo : `há ${duracao(t.minutosNoStatusAtual)}`}</span>
          ${t.foraDoPrazo ? html`<span class="selo prioridade">Fora do prazo</span>` : ""}
          ${mostrarQuemAcompanha && t.responsavel ? html`<span class="mudo">acompanha: ${t.responsavel.nome}</span>` : ""}</span>
      </button></li>`)}</ul>
  </article>`;
}
