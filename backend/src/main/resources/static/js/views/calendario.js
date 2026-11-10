// Calendário: datas do cronograma (Portaria + fluxo interno GEPAG), feriados e o que está atrasado no ciclo.
import { api } from "../api.js";
import { abrirDemanda, textoAtrasoCronograma } from "../demanda-painel.js";
import { competencia, nomeMes } from "../formato.js";
import { $, $$, html } from "../ui.js";

export const titulo = "Calendário";

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_NA_CELULA = 3;
const MAX_ATRASADAS = 8;
const CAMADAS = [
  ["folha", "SIAPE-FOLHA"],
  ["gepag", "Fluxo interno GEPAG"],
  ["ppf", "SIAPE-PPF"],
];
const CHAVE_CAMADAS = "calendarioCamadas";
const TIPO_FERIADO = { FERIADO: "Feriado", PONTO_FACULTATIVO: "Ponto facultativo", FERIADO_MUNICIPAL: "Feriado municipal" };

/** Dia escolhido na grade; sobrevive aos redesenhos automáticos da tela. */
let diaEscolhido = null;
const camadas = lerCamadas();

const p2 = (n) => String(n).padStart(2, "0");
const isoDia = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const dm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");

function lerCamadas() {
  const padrao = { folha: true, gepag: true, ppf: true };
  try {
    return { ...padrao, ...JSON.parse(localStorage.getItem(CHAVE_CAMADAS) ?? "{}") };
  } catch {
    return padrao;
  }
}

function salvarCamadas() {
  try {
    localStorage.setItem(CHAVE_CAMADAS, JSON.stringify(camadas));
  } catch {
    // sem armazenamento: as camadas voltam todas ligadas na próxima visita
  }
}

export async function render(raiz, params) {
  const [anos, atual] = await Promise.all([api.get("/cronograma/anos"), api.get("/ciclos/atual")]);
  const hoje = new Date();
  const mes = /^\d{4}-\d{2}$/.test(params.get("mes") ?? "") ? params.get("mes")
    : atual?.ciclo.competencia ?? `${hoje.getFullYear()}-${p2(hoje.getMonth() + 1)}`;
  const [ano, m] = mes.split("-").map(Number);
  const crono = anos.includes(ano) ? await api.get(`/cronograma/${ano}`) : null;
  const itens = crono ? montarItens(crono) : new Map();
  const semExpediente = new Map((crono?.feriados ?? []).map((f) => [f.data, f]));
  const folha = crono?.folha.find((f) => f.competencia === mes);
  const ppf = crono?.ppf.find((f) => f.competencia === mes);
  const alertas = (crono?.alertas ?? []).filter((a) => a.competencia === mes || (!a.competencia && a.subsistema === "PPF"));
  const janela = new Set([...(folha ? diasUteis(folha.processamento, folha.limiteGepag, semExpediente) : [])]);
  const atrasadas = (atual?.tarefas ?? []).filter((t) => t.minutosAtrasoCronograma != null && t.status !== "CONCLUIDA");
  if (!diaEscolhido?.startsWith(mes)) diaEscolhido = isoDia(hoje).startsWith(mes) ? isoDia(hoje) : null;

  const anterior = new Date(ano, m - 2, 1);
  const seguinte = new Date(ano, m, 1);
  const linkMes = (d) => `#/calendario?mes=${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
  const mesHoje = `${hoje.getFullYear()}-${p2(hoje.getMonth() + 1)}`;

  raiz.innerHTML = String(html`
    <header class="cabecalho">
      <div><h1 tabindex="-1">Calendário</h1>
        <p>Datas da Portaria SEFAZ-PI/GASEC nº 6/2026 (SIAPE-FOLHA e SIAPE-PPF), a janela interna da GEPAG e os dias sem expediente.
          Os prazos das fases do ciclo saem daqui.</p></div>
      <div class="acoes cal-nav">
        <a class="botao pequeno" href="${linkMes(anterior)}" aria-label="Mês anterior">‹</a>
        <strong class="cal-mes">${nomeMes(m - 1)} de ${ano}</strong>
        <a class="botao pequeno" href="${linkMes(seguinte)}" aria-label="Mês seguinte">›</a>
        ${mes === mesHoje ? "" : html`<a class="botao pequeno sutil" href="#/calendario?mes=${mesHoje}">Hoje</a>`}
      </div>
    </header>

    ${crono ? "" : html`<p class="aviso" style="margin-bottom: 20px">Não há cronograma cadastrado para ${ano}. ${anos.length
      ? `Anos disponíveis: ${anos.join(", ")}.` : ""}</p>`}

    <div class="filtros" role="group" aria-label="Camadas do calendário">
      ${CAMADAS.map(([v, r]) => html`<label class="cal-camada ${v}"><input type="checkbox" data-camada="${v}" ${camadas[v] ? "checked" : ""}> ${r}</label>`)}
    </div>

    <div class="colunas">
      <section aria-label="Mês">
        <div class="painel cal-grade" role="grid" aria-label="${nomeMes(m - 1)} de ${ano}">
          ${SEMANA.map((s) => html`<div class="cal-semana" role="columnheader">${s}</div>`)}
          ${diasDaGrade(ano, m).map((d) => celula(d, m, { itens, semExpediente, janela, hoje }))}
        </div>
        <div data-dia></div>
        <ol class="painel lista cal-agenda" aria-label="Agenda do mês">${agenda(ano, m, itens, semExpediente)}</ol>
        <div class="legenda-status cal-legenda">
          <span><i class="marco"></i>Marco (transmissão SEAD / integração PPF)</span>
          <span><i class="gepag"></i>Fluxo interno GEPAG</span>
          <span><i class="financeiro"></i>OB e crédito</span>
          <span><i class="feriado"></i>Sem expediente</span>
        </div>
      </section>

      <aside class="pilha" style="gap: 20px">
        ${folha ? resumoFolha(folha, alertas.filter((a) => a.subsistema === "FOLHA")) : ""}
        ${atual ? html`<section class="painel painel-corpo" aria-labelledby="c-atrasos">
          <h2 id="c-atrasos" class="cal-titulo">Atrasadas no cronograma</h2>
          <p class="pequeno mudo">${atual.ciclo.nome}${atual.ciclo.competencia ? ` · ${competencia(atual.ciclo.competencia)}` : ""}</p>
          ${!atual.ciclo.temCronograma
            ? html`<p class="pequeno mudo">O ciclo não tem competência com cronograma cadastrado.</p>`
            : atrasadas.length
              ? html`<ul class="cal-atrasos">${atrasadas.slice(0, MAX_ATRASADAS).map((t) => html`<li><button class="botao link" type="button" data-abrir="${t.id}">${t.titulo}</button>
                  <span class="pequeno alerta">${textoAtrasoCronograma(t).replace("Atrasado conforme o cronograma: ", "")}</span></li>`)}</ul>
                ${atrasadas.length > MAX_ATRASADAS ? html`<p class="pequeno" style="margin-top: 10px"><a href="#/">Mais ${atrasadas.length - MAX_ATRASADAS} no Painel do ciclo</a> (filtro "Atrasadas no cronograma")</p>` : ""}`
              : html`<p class="pequeno mudo">Nenhuma demanda aberta passou do prazo do cronograma.</p>`}
        </section>` : ""}
        ${ppf ? resumoPpf(ppf, alertas.filter((a) => a.subsistema === "PPF")) : ""}
        ${feriadosDoMes(crono, mes)}
      </aside>
    </div>`);

  const desenharDia = () => {
    const alvo = $("[data-dia]", raiz);
    $$("[data-dia-iso]", raiz).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.diaIso === diaEscolhido)));
    alvo.innerHTML = diaEscolhido ? String(detalheDia(diaEscolhido, itens, semExpediente)) : "";
  };
  $$("[data-dia-iso]", raiz).forEach((b) => b.addEventListener("click", () => {
    diaEscolhido = b.dataset.diaIso;
    desenharDia();
  }));
  $$("[data-camada]", raiz).forEach((c) => c.addEventListener("change", () => {
    camadas[c.dataset.camada] = c.checked;
    salvarCamadas();
    aplicarCamadas(raiz);
  }));
  $$("[data-abrir]", raiz).forEach((b) => b.addEventListener("click", () =>
    abrirDemanda(Number(b.dataset.abrir), { encerrado: atual?.ciclo.encerrado })));
  aplicarCamadas(raiz);
  desenharDia();
}

/** Esconde os itens das camadas desligadas (sem redesenhar a tela). */
function aplicarCamadas(raiz) {
  CAMADAS.forEach(([v]) => raiz.classList.toggle(`sem-${v}`, !camadas[v]));
}

// ---------- Itens de cada dia ----------

function montarItens(crono) {
  const itens = new Map();
  const add = (data, item) => {
    if (!data) return;
    if (!itens.has(data)) itens.set(data, []);
    itens.get(data).push(item);
  };
  for (const e of crono.eventos) {
    add(e.data, {
      camada: e.subsistema === "PPF" ? "ppf" : "folha",
      classe: classeEvento(e.tipo),
      texto: e.texto,
      hora: e.hora,
      detalhe: `${e.subsistema === "PPF" ? "SIAPE-PPF" : "SIAPE-FOLHA"} · competência ${competencia(e.competencia)}`,
    });
  }
  for (const f of crono.folha) {
    const comp = `competência ${competencia(f.competencia)}`;
    add(f.processamento, { camada: "gepag", classe: "gepag", texto: "Processamento estimado (1º dia GEPAG)",
      detalhe: `SIAPE-FOLHA · ${comp} · prazo do Tratamento SEFAZ` });
    add(f.limiteGepag, { camada: "gepag", classe: "gepag", texto: "Limite GEPAG",
      detalhe: `SIAPE-FOLHA · ${comp} · prazo dos agendamentos · ${f.diasUteisGepag} dias úteis GEPAG, margem ${f.margem}` });
  }
  for (const p of crono.ppf) {
    const comp = `competência ${competencia(p.competencia)}`;
    add(p.processamento, { camada: "ppf", classe: "gepag", texto: "PPF: processamento estimado (1º dia GEPAG)", detalhe: `SIAPE-PPF · ${comp}` });
    add(p.limiteGepag, { camada: "ppf", classe: "gepag", texto: "PPF: limite GEPAG", detalhe: `SIAPE-PPF · ${comp}` });
  }
  for (const lista of itens.values()) lista.sort((a, b) => ordem(a) - ordem(b));
  return itens;
}

function classeEvento(tipo) {
  if (tipo === "TRANSMISSAO_SEAD" || tipo === "INTEGRACAO_PPF") return "marco";
  if (tipo === "EXECUCAO_FAIXA_1" || tipo === "EXECUCAO_OB" || tipo === "CREDITO") return "financeiro";
  return "oficial";
}

function ordem(item) {
  return { marco: 0, gepag: 1, financeiro: 2, oficial: 3 }[item.classe] + (item.camada === "ppf" ? 10 : 0);
}

/** Dias úteis de `inicio` a `fim` (inclusive), sem fins de semana e dias sem expediente. */
function diasUteis(inicio, fim, semExpediente) {
  const dias = [];
  for (let d = new Date(`${inicio}T00:00`); isoDia(d) <= fim; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6 && !semExpediente.has(isoDia(d))) dias.push(isoDia(d));
  }
  return dias;
}

// ---------- Grade ----------

function diasDaGrade(ano, m) {
  const primeiro = new Date(ano, m - 1, 1);
  const inicio = new Date(ano, m - 1, 1 - primeiro.getDay());
  const ultimo = new Date(ano, m, 0);
  const total = Math.ceil((primeiro.getDay() + ultimo.getDate()) / 7) * 7;
  return Array.from({ length: total }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
}

function celula(d, m, { itens, semExpediente, janela, hoje }) {
  const iso = isoDia(d);
  if (d.getMonth() !== m - 1) return html`<div class="cal-dia fora" role="gridcell" aria-hidden="true"></div>`;
  const lista = itens.get(iso) ?? [];
  const feriado = semExpediente.get(iso);
  const classes = ["cal-dia",
    d.getDay() === 0 || d.getDay() === 6 ? "fds" : "",
    feriado ? "sem-expediente" : "",
    janela.has(iso) ? "janela" : "",
    iso === isoDia(hoje) ? "hoje" : ""].filter(Boolean).join(" ");
  const rotulo = `${d.getDate()} de ${nomeMes(d.getMonth())}${feriado ? `, ${feriado.nome}` : ""}${lista.length ? `, ${lista.length} evento(s)` : ""}`;
  return html`<div class="${classes}" role="gridcell">
    <button type="button" class="cal-botao" data-dia-iso="${iso}" aria-label="${rotulo}" aria-pressed="false">
      <span class="cal-numero num">${d.getDate()}</span>
      ${feriado ? html`<span class="cal-feriado">${feriado.nome}</span>` : ""}
      ${lista.slice(0, MAX_NA_CELULA).map((i) => html`<span class="cal-item ${i.classe} c-${i.camada}">${i.hora ? `${i.hora} ` : ""}${resumir(i.texto)}</span>`)}
      ${lista.length > MAX_NA_CELULA ? html`<span class="cal-mais">+${lista.length - MAX_NA_CELULA} mais</span>` : ""}
    </button>
  </div>`;
}

/** Tira a numeração da Portaria ("6 - ", "1 – ") para caber na célula. */
function resumir(texto) {
  return texto.replace(/^\d+\s*[–-]\s*/, "");
}

function linhaItem(i) {
  return html`<li class="cal-linha c-${i.camada}"><i class="${i.classe}" aria-hidden="true"></i>
    <div><span>${i.hora ? html`<b class="num">${i.hora}</b> ` : ""}${i.texto}</span><span class="sub">${i.detalhe}</span></div></li>`;
}

function detalheDia(iso, itens, semExpediente) {
  const d = new Date(`${iso}T00:00`);
  const lista = itens.get(iso) ?? [];
  const feriado = semExpediente.get(iso);
  return html`<section class="painel painel-corpo cal-detalhe" aria-live="polite">
    <h2 class="cal-titulo">${SEMANA[d.getDay()]}, ${d.getDate()} de ${nomeMes(d.getMonth())}</h2>
    ${feriado ? html`<p class="aviso revisar">${TIPO_FERIADO[feriado.tipo] ?? "Sem expediente"}: ${feriado.nome}</p>` : ""}
    ${lista.length ? html`<ul class="cal-linhas">${lista.map(linhaItem)}</ul>` : html`<p class="pequeno mudo">Nada no cronograma neste dia.</p>`}
  </section>`;
}

/** No celular a grade dá lugar a esta lista com os dias que têm algo. */
function agenda(ano, m, itens, semExpediente) {
  const dias = [];
  for (let d = new Date(ano, m - 1, 1); d.getMonth() === m - 1; d.setDate(d.getDate() + 1)) {
    const iso = isoDia(d);
    const lista = itens.get(iso) ?? [];
    const feriado = semExpediente.get(iso);
    if (!lista.length && !feriado) continue;
    dias.push(html`<li class="cal-agenda-dia">
      <div class="cal-agenda-data"><b class="num">${d.getDate()}</b><span>${SEMANA[d.getDay()]}</span></div>
      <ul class="cal-linhas">
        ${feriado ? html`<li class="cal-linha"><i class="feriado" aria-hidden="true"></i><div><span>${feriado.nome}</span><span class="sub">${TIPO_FERIADO[feriado.tipo]}</span></div></li>` : ""}
        ${lista.map(linhaItem)}
      </ul></li>`);
  }
  return dias.length ? dias : html`<li class="vazio"><span>Nada no cronograma neste mês.</span></li>`;
}

// ---------- Lateral ----------

function resumoFolha(f, alertas) {
  const semFolga = f.margem === 0;
  return html`<section class="painel painel-corpo" aria-labelledby="c-folha">
    <h2 id="c-folha" class="cal-titulo">SIAPE-FOLHA · ${competencia(f.competencia)}</h2>
    <dl class="cal-resumo">
      <div><dt>Transmissão SEAD</dt><dd>${dm(f.transmissao.slice(0, 10))} às 11h</dd></div>
      <div><dt>Processamento estimado</dt><dd>${dm(f.processamento)}</dd></div>
      <div><dt>Período GEPAG</dt><dd>${dm(f.processamento)} a ${dm(f.limiteGepag)} · ${f.diasUteisGepag} dias úteis</dd></div>
      <div><dt>Limite GEPAG</dt><dd>${dm(f.limiteGepag)}</dd></div>
      <div><dt>Execução Faixa 1</dt><dd>${dm(f.faixa1)}</dd></div>
      <div><dt>Margem</dt><dd class="${semFolga ? "alerta" : ""}">${f.situacao}</dd></div>
    </dl>
    <h3 class="cal-subtitulo">Prazos no Painel do ciclo</h3>
    <ul class="cal-prazos pequeno">
      <li><b>Etapa SEAD:</b> até ${dm(f.transmissao.slice(0, 10))} às 11h (transmissão)</li>
      <li><b>Tratamento SEFAZ:</b> até ${dm(f.processamento)} (processamento estimado)</li>
      <li><b>Agendamentos:</b> até ${dm(f.limiteGepag)} (limite GEPAG)</li>
    </ul>
    ${alertas.map((a) => html`<p class="aviso revisar pequeno">${a.texto}</p>`)}
  </section>`;
}

function resumoPpf(p, alertas) {
  return html`<section class="painel painel-corpo" aria-labelledby="c-ppf">
    <h2 id="c-ppf" class="cal-titulo">SIAPE-PPF · ${competencia(p.competencia)}</h2>
    <p class="pequeno mudo">Só para consulta: o PPF não gera atraso nas demandas.</p>
    <dl class="cal-resumo">
      <div><dt>Integração PPF/SIAFE</dt><dd>${p.integracao ? dm(p.integracao) : "Não publicada"}</dd></div>
      ${p.processamento ? html`<div><dt>Período GEPAG</dt><dd>${dm(p.processamento)} a ${dm(p.limiteGepag)} · ${p.diasUteisGepag} dias úteis</dd></div>` : ""}
      <div><dt>Execução PPF</dt><dd>${dm(p.execucao)}</dd></div>
      <div><dt>Pagamento</dt><dd>${dm(p.pagamento)}</dd></div>
    </dl>
    ${p.nota ? html`<p class="pequeno mudo">${p.nota}</p>` : ""}
    ${alertas.map((a) => html`<p class="aviso revisar pequeno">${a.texto}</p>`)}
  </section>`;
}

function feriadosDoMes(crono, mes) {
  const lista = (crono?.feriados ?? []).filter((f) => f.data.startsWith(mes));
  if (!lista.length) return "";
  return html`<section class="painel painel-corpo" aria-labelledby="c-feriados">
    <h2 id="c-feriados" class="cal-titulo">Sem expediente no mês</h2>
    <ul class="cal-linhas">${lista.map((f) => html`<li class="cal-linha"><i class="feriado" aria-hidden="true"></i>
      <div><span><b class="num">${dm(f.data)}</b> ${f.nome}</span><span class="sub">${TIPO_FERIADO[f.tipo]}</span></div></li>`)}</ul>
  </section>`;
}
