// Painel do ciclo: todas as demandas por fase, com status, responsável, tempo e prazo.
import { api } from "../api.js";
import { abrirDemanda, textoAtrasoCronograma, textoPrazo } from "../demanda-painel.js";
import { opcoes, usuarios } from "../dados.js";
import { competencia, dataHora, duracao, plural } from "../formato.js";
import { $, $$, abrirGaveta, avisar, dadosAlterados, fecharGaveta, html, ocupado, seloStatus } from "../ui.js";

export const titulo = "Painel do ciclo";

const FILTROS = [
  ["", "Todas"],
  ["abertas", "Em aberto"],
  ["andamento", "Em andamento"],
  ["terceiros", "Aguardando terceiros"],
  ["prazo", "Fora do prazo"],
  ["cronograma", "Atrasadas no cronograma"],
];
const filtro = { situacao: "", responsavel: "" };

export async function render(raiz, params) {
  const cicloId = params.get("ciclo");
  const [detalhe, op, pessoas] = await Promise.all([
    cicloId ? api.get(`/ciclos/${cicloId}`) : api.get("/ciclos/atual"),
    opcoes(),
    usuarios(),
  ]);
  if (!detalhe) {
    desenharBoasVindas(raiz);
    return;
  }
  const c = detalhe.ciclo;
  const tarefas = detalhe.tarefas;

  raiz.innerHTML = String(html`
    <header class="cabecalho">
      <div><h1 tabindex="-1">${c.nome}</h1>
        <p>${c.competencia ? `Competência ${competencia(c.competencia)}. ` : ""}${c.encerrado
          ? `Encerrado em ${dataHora(c.encerradoEm)}, depois de ${duracao(c.minutosDecorridos)}.`
          : `Aberto há ${duracao(c.minutosDecorridos)}, desde ${dataHora(c.abertoEm)}.`}</p></div>
      ${c.encerrado ? "" : html`<button class="botao" type="button" data-nova>Nova demanda avulsa</button>`}
    </header>

    ${c.encerrado ? html`<p class="aviso" style="margin-bottom: 20px">Ciclo encerrado: os tempos estão congelados. Para registrar algo, reabra o ciclo em <a href="#/ciclos">Ciclos</a>.</p>` : ""}

    <div class="indicadores" style="margin-bottom: 24px">
      <div class="indicador"><span class="valor num">${c.encerradas}<small> de ${c.totalTarefas}</small></span><span class="rotulo">demandas encerradas</span></div>
      <div class="indicador"><span class="valor num">${c.emAndamento}</span><span class="rotulo">em andamento</span></div>
      <div class="indicador"><span class="valor num">${c.aguardandoTerceiros}</span><span class="rotulo">aguardando terceiros</span></div>
      <div class="indicador"><span class="valor num">${c.foraDoPrazo}</span><span class="rotulo">abertas fora do prazo</span></div>
      ${c.temCronograma ? html`<div class="indicador"><span class="valor num ${c.atrasadasCronograma ? "alerta" : ""}">${c.atrasadasCronograma}</span><span class="rotulo">atrasadas no cronograma</span></div>` : ""}
    </div>
    ${c.temCronograma ? "" : html`<p class="aviso" style="margin: -8px 0 20px">${c.competencia
      ? `Não há cronograma cadastrado para ${competencia(c.competencia)}: o atraso conforme o cronograma não é calculado.`
      : "Este ciclo não tem competência: informe-a em Ciclos para comparar as demandas com o cronograma."}</p>`}

    <div class="filtros" role="search">
      <div class="segmentos" role="group" aria-label="Situação">
        ${FILTROS.map(([v, r]) => html`<button type="button" data-filtro="${v}" aria-pressed="${filtro.situacao === v}">${r}</button>`)}
      </div>
      <label class="sr-only" for="f-resp">Responsável</label>
      <select id="f-resp" class="entrada">
        <option value="">Todos os responsáveis</option>
        <option value="nenhum" ${filtro.responsavel === "nenhum" ? "selected" : ""}>Sem responsável</option>
        ${pessoas.filter((p) => p.ativo).map((p) => html`<option value="${p.id}" ${String(p.id) === filtro.responsavel ? "selected" : ""}>${p.nome}</option>`)}
      </select>
    </div>
    <div data-fases></div>`);

  const desenharFases = () => {
    const visiveis = tarefas.filter((t) => passaFiltro(t, op));
    const alvo = $("[data-fases]", raiz);
    if (!visiveis.length) {
      alvo.innerHTML = String(html`<div class="painel vazio"><strong>Nenhuma demanda com esses filtros.</strong><span>Escolha "Todas" para ver o ciclo inteiro.</span></div>`);
      return;
    }
    alvo.innerHTML = String(html`${op.fases.map((f) => {
      const daFase = tarefas.filter((t) => t.fase === f.valor);
      const lista = visiveis.filter((t) => t.fase === f.valor);
      if (!lista.length) return "";
      const encerradas = daFase.filter((t) => op.status[t.status].encerrado).length;
      const fim = encerradas === daFase.length && daFase.length
        ? daFase.map((t) => t.concluidaEm).filter(Boolean).sort().at(-1) : null;
      return html`<section class="fase" aria-labelledby="fase-${f.valor}">
        <div class="secao-titulo">
          <h2 id="fase-${f.valor}">${f.rotulo}</h2>
          <span class="mudo">${fim ? `Encerrada em ${dataHora(fim)}` : `${encerradas} de ${daFase.length} encerradas`}</span>
        </div>
        <ul class="painel lista">${lista.map((t) => linhaDemanda(t, op))}</ul>
      </section>`;
    })}`);
    $$("[data-abrir]", alvo).forEach((b) => b.addEventListener("click", () => abrirDemanda(Number(b.dataset.abrir), { encerrado: c.encerrado })));
  };

  $$("[data-filtro]", raiz).forEach((b) => b.addEventListener("click", () => {
    filtro.situacao = b.dataset.filtro;
    $$("[data-filtro]", raiz).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    desenharFases();
  }));
  $("#f-resp", raiz).addEventListener("change", (e) => {
    filtro.responsavel = e.target.value;
    desenharFases();
  });
  $("[data-nova]", raiz)?.addEventListener("click", () => novaDemanda(c, op, pessoas));
  desenharFases();
}

function passaFiltro(t, op) {
  const st = op.status[t.status];
  if (filtro.responsavel === "nenhum" && t.responsavel) return false;
  if (filtro.responsavel && filtro.responsavel !== "nenhum" && String(t.responsavel?.id) !== filtro.responsavel) return false;
  switch (filtro.situacao) {
    case "abertas": return !st.encerrado;
    case "andamento": return t.status === "EM_ANDAMENTO";
    case "terceiros": return Boolean(st.aguardando);
    case "prazo": return t.foraDoPrazo && !st.encerrado;
    case "cronograma": return t.minutosAtrasoCronograma != null && !st.encerrado;
    default: return true;
  }
}

export function linhaDemanda(t, op, { mostrarFase = false } = {}) {
  const st = op.status[t.status];
  const prazo = textoPrazo(t);
  const atrasado = textoAtrasoCronograma(t);
  return html`
    <li class="demanda ${st.encerrado ? "encerrada" : ""}">
      <button class="abrir" type="button" data-abrir="${t.id}">
        <span class="titulo">${t.numero ? html`<span class="numero">${t.numero}</span>` : ""}${t.titulo}${t.opcional ? html` <span class="mudo">(se necessário)</span>` : ""}</span>
        <span class="info">
          ${mostrarFase ? html`<span>${op.fase[t.fase].rotulo}</span>` : ""}
          ${st.aguardando
            ? html`<span>Com ${op.unidade[st.aguardando].rotulo}${t.responsavel ? html`<span class="mudo"> · acompanha: ${t.responsavel.nome}</span>` : ""}</span>`
            : html`<span class="${t.responsavel ? "" : "mudo"}">${t.responsavel?.nome ?? `Sem responsável (${op.unidade[t.unidade].rotulo})`}</span>`}
          ${t.iniciadaEm ? html`<span class="num">Total ${duracao(t.minutosTotais)}</span>` : ""}
          ${prazo ? html`<span class="${t.foraDoPrazo ? "alerta" : ""}">${prazo}</span>` : ""}
          ${t.itensTotal ? html`<span>${plural(t.itensAbertos, "item aberto", "itens abertos")}</span>` : ""}
        </span>
        ${atrasado ? html`<span class="atraso-linha ${st.encerrado ? "encerrado" : ""}">${atrasado}</span>` : ""}
        ${t.observacao ? html`<span class="obs-linha"><span class="texto-obs">${t.observacao}</span>${t.observacaoPor
          ? html`<span class="mudo"> · ${t.observacaoPor}, ${dataHora(t.observacaoEm)}</span>` : ""}</span>` : ""}
      </button>
      <div class="lado">
        ${seloStatus(t.status, st.rotulo)}
        <span class="desde num">${st.encerrado ? dataHora(t.statusDesde) : `há ${duracao(t.minutosNoStatusAtual)}`}</span>
      </div>
    </li>`;
}

function desenharBoasVindas(raiz) {
  raiz.innerHTML = String(html`
    <header class="cabecalho"><div><h1 tabindex="-1">Monitoramento GEPAG</h1>
      <p>Acompanhe quanto tempo cada etapa da folha leva, com quem está cada demanda e quanto tempo se espera pela SEAD, SEPLAN, Logus e processos SEI.</p></div></header>
    <section class="painel boas-vindas">
      <h2>Comece abrindo o primeiro ciclo</h2>
      <ol>
        <li>Cadastre a equipe em <a href="#/config">Usuários e planilha</a>. SEAD, SEPLAN e UG já vêm cadastradas para receber demandas (todas são unidades gestoras; SEAD e SEPLAN ficam à parte por terem status próprios).</li>
        <li>Abra o ciclo: as etapas do roteiro (SEAD, tratamento, agendamentos) são criadas como demandas pendentes.</li>
        <li>Em cada demanda, atribua o responsável e mude o status conforme o trabalho anda. O tempo é contado sozinho.</li>
      </ol>
      <form class="grade-campos" data-form-ciclo novalidate>
        <label class="campo"><span>Nome do ciclo</span><input name="nome" required placeholder="Folha outubro/2026"></label>
        <label class="campo"><span>Competência</span><input name="competencia" type="month"></label>
        <div class="acoes" style="grid-column: 1 / -1"><button class="botao primario" type="submit">Abrir ciclo</button></div>
      </form>
    </section>`);
  ligarFormCiclo($("[data-form-ciclo]", raiz));
}

/** Formulário de novo ciclo (usado aqui e na tela Ciclos). */
export function ligarFormCiclo(form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = await ocupado(e.submitter, () => api.post("/ciclos", { nome: form.nome.value, competencia: form.competencia.value }));
    if (ok) {
      avisar(`Ciclo "${ok.ciclo.nome}" aberto com ${ok.tarefas.length} demandas.`, { tipo: "sucesso" });
      location.hash = "#/";
      dadosAlterados();
    }
  });
}

function novaDemanda(ciclo, op, pessoas) {
  abrirGaveta({
    rotulo: "Nova demanda avulsa",
    render: (gaveta) => {
      gaveta.innerHTML = String(html`
        <header class="gaveta-topo"><div><h2>Nova demanda avulsa</h2>
          <p>Para algo fora do roteiro, como um chamado extra ou um reprocessamento. Entra no fim da fase escolhida.</p></div>
          <button class="botao sutil pequeno" type="button" data-fechar>Fechar</button></header>
        <form class="gaveta-corpo" data-form novalidate>
          <div class="bloco">
            <label class="campo"><span>Descrição</span><input name="titulo" required data-foco-inicial placeholder="Ex.: Reprocessar arquivo da UG 123"></label>
            <label class="campo"><span>Fase</span><select name="fase">${op.fases.map((f) => html`<option value="${f.valor}">${f.rotulo}</option>`)}</select></label>
            <label class="campo"><span>Responsável</span><select name="responsavel">
              <option value="">Sem responsável</option>
              ${pessoas.filter((p) => p.ativo).map((p) => html`<option value="${p.id}">${p.nome}${p.externo ? " (externo)" : ""}</option>`)}
            </select></label>
            <label class="campo"><span>Tempo para solução (horas, opcional)</span><input name="prazo" type="number" min="0.25" step="0.25"></label>
            <div class="acoes"><button class="botao primario" type="submit">Criar demanda</button></div>
          </div>
        </form>`);
      $("[data-fechar]", gaveta).addEventListener("click", () => fecharGaveta());
      $("[data-form]", gaveta).addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.target;
        const nova = await ocupado(e.submitter, () => api.post(`/ciclos/${ciclo.id}/demandas`, {
          titulo: f.titulo.value,
          fase: f.fase.value,
          responsavelId: f.responsavel.value ? Number(f.responsavel.value) : null,
          prazoHoras: f.prazo.value ? Number(f.prazo.value) : null,
        }));
        if (nova) {
          avisar("Demanda criada.", { tipo: "sucesso" });
          fecharGaveta(true);
          dadosAlterados();
          abrirDemanda(nova.tarefa.id);
        }
      });
    },
  });
}
