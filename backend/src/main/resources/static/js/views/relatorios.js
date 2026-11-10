// Tempos do ciclo: por usuário, por unidade, por fase e por demanda.
import { api } from "../api.js";
import { barrasHorizontais } from "../charts.js";
import { abrirDemanda, textoPrazo } from "../demanda-painel.js";
import { opcoes } from "../dados.js";
import { dataHora, duracao, horas, plural } from "../formato.js";
import { $, $$, html, seloStatus } from "../ui.js";

export const titulo = "Tempos e relatórios";

export async function render(raiz, params) {
  const [lista, op] = await Promise.all([api.get("/ciclos"), opcoes()]);
  if (!lista.length) {
    raiz.innerHTML = String(html`<header class="cabecalho"><div><h1 tabindex="-1">Tempos e relatórios</h1></div></header>
      <div class="painel vazio"><strong>Ainda não há ciclos.</strong><span>Abra um ciclo no <a href="#/">Painel</a>.</span></div>`);
    return;
  }
  const escolhido = params.get("ciclo") ?? String((lista.find((c) => !c.encerrado) ?? lista[0]).id);
  const r = await api.get(`/ciclos/${escolhido}/relatorio`);
  const c = r.ciclo;
  const pessoas = r.porUsuario.filter((u) => !u.externo);
  const gepag = r.porUnidade.find((u) => u.unidade === "GEPAG");
  const externo = r.porUnidade.filter((u) => u.unidade !== "GEPAG").reduce((s, u) => s + u.minutos, 0);

  raiz.innerHTML = String(html`
    <header class="cabecalho">
      <div><h1 tabindex="-1">Tempos e relatórios</h1>
        <p>Tempo corrido de cada período, separado por quem estava com a demanda. ${c.encerrado ? "Ciclo encerrado: números finais." : "Ciclo em andamento: os números crescem até o encerramento."}</p></div>
      <div class="acoes">
        <label class="sr-only" for="sel-ciclo">Ciclo</label>
        <select id="sel-ciclo" class="entrada" style="width: auto">
          ${lista.map((x) => html`<option value="${x.id}" ${String(x.id) === escolhido ? "selected" : ""}>${x.nome}${x.encerrado ? " (encerrado)" : ""}</option>`)}
        </select>
        <a class="botao" href="/api/planilha/baixar" download>Baixar planilha</a>
      </div>
    </header>

    <div class="indicadores" style="margin-bottom: 24px">
      <div class="indicador"><span class="valor num">${duracao(c.minutosDecorridos)}</span><span class="rotulo">duração do ciclo</span></div>
      <div class="indicador"><span class="valor num">${duracao(gepag?.minutosAndamento ?? 0)}</span><span class="rotulo">GEPAG em andamento</span></div>
      <div class="indicador"><span class="valor num">${duracao(externo)}</span><span class="rotulo">com outras unidades</span></div>
      <div class="indicador"><span class="valor num">${r.porDemanda.filter((t) => t.foraDoPrazo).length}</span><span class="rotulo">demandas fora do prazo</span></div>
    </div>

    <div class="graficos">
      <section class="painel grafico">
        <header><h2>Tempo em andamento por pessoa</h2><p>Só o tempo com a demanda "Em andamento" sob a responsabilidade da pessoa.</p></header>
        <div data-g-pessoas></div>
      </section>
      <section class="painel grafico">
        <header><h2>Tempo por unidade</h2><p>Em andamento (unidade responsável) somado à espera por ela (status "Aguardando").</p></header>
        <div data-g-unidades></div>
        <div class="legenda-status">
          <span><i style="background: var(--serie)"></i>GEPAG</span>
          <span><i style="background: var(--revisar)"></i>Outras unidades</span>
        </div>
      </section>
      <section class="painel grafico" style="grid-column: 1 / -1">
        <header><h2>Duração de cada fase</h2><p>Do primeiro início ao último encerramento da fase.</p></header>
        <div data-g-fases></div>
        <div class="legenda-status">
          <span><i style="background: var(--ok)"></i>Encerrada</span>
          <span><i style="background: var(--lampada)"></i>Em andamento</span>
        </div>
      </section>
    </div>

    <section style="margin-top: 28px" aria-labelledby="t-usuarios">
      <div class="secao-titulo"><h2 id="t-usuarios">Por usuário</h2>
        <span class="mudo">"Aguardando terceiros" é só acompanhamento: a demanda estava com outra unidade, então esse tempo não entra no "Em andamento" da pessoa e conta para a unidade aguardada.</span></div>
      ${r.porUsuario.length ? html`<div class="painel tabela-rolagem"><table class="tabela">
        <thead><tr><th>Usuário</th><th class="num">Em andamento</th><th class="num">Aguardando terceiros</th><th class="num">Demandas</th><th class="num">Concluídas</th></tr></thead>
        <tbody>${r.porUsuario.map((u) => html`<tr>
          <td>${u.nome}<span class="sub">${u.externo ? op.unidade[u.unidade].rotulo : "GEPAG"}</span></td>
          <td class="num">${duracao(u.minutosAndamento)}<span class="sub">${horas(u.minutosAndamento)}</span></td>
          <td class="num">${duracao(u.minutosAguardando)}</td>
          <td class="num">${u.demandas}</td>
          <td class="num">${u.concluidas}</td>
        </tr>`)}</tbody></table></div>`
        : html`<div class="painel vazio"><span>Nenhum tempo registrado com responsável neste ciclo.</span></div>`}
    </section>

    <section style="margin-top: 28px" aria-labelledby="t-demandas">
      <div class="secao-titulo"><h2 id="t-demandas">Por demanda</h2></div>
      <div class="painel tabela-rolagem"><table class="tabela">
        <thead><tr><th>Demanda</th><th>Responsável</th><th>Status</th><th class="num">Total</th><th class="num">Em andamento</th><th class="num">Aguardando</th><th>Prazo</th></tr></thead>
        <tbody>${r.porDemanda.map((t) => {
          const aguardando = Object.entries(t.minutosPorStatus).filter(([s]) => op.status[s].aguardando).reduce((s, [, m]) => s + m, 0);
          return html`<tr>
            <td><button class="botao sutil pequeno link" type="button" data-abrir="${t.id}">${t.titulo}</button><span class="sub">${op.fase[t.fase].rotulo}${t.numero ? ` · etapa ${t.numero}` : ""}</span></td>
            <td>${t.responsavel?.nome ?? html`<span class="mudo">—</span>`}</td>
            <td>${seloStatus(t.status, op.status[t.status].rotulo)}</td>
            <td class="num">${t.iniciadaEm ? duracao(t.minutosTotais) : "—"}${t.iniciadaEm ? html`<span class="sub">desde ${dataHora(t.iniciadaEm)}</span>` : ""}</td>
            <td class="num">${t.minutosPorStatus.EM_ANDAMENTO ? duracao(t.minutosPorStatus.EM_ANDAMENTO) : "—"}</td>
            <td class="num">${aguardando ? duracao(aguardando) : "—"}</td>
            <td>${t.prazoHoras ? html`${duracao(t.prazoHoras * 60)}<span class="sub ${t.foraDoPrazo ? "alerta" : ""}">${textoPrazo(t)}</span>` : html`<span class="mudo">—</span>`}</td>
          </tr>`;
        })}</tbody></table></div>
    </section>`);

  $("#sel-ciclo", raiz).addEventListener("change", (e) => {
    location.hash = `#/relatorios?ciclo=${e.target.value}`;
  });
  $$("[data-abrir]", raiz).forEach((b) => b.addEventListener("click", () => abrirDemanda(Number(b.dataset.abrir), { encerrado: c.encerrado })));

  const alvoPessoas = $("[data-g-pessoas]", raiz);
  const comTempo = pessoas.filter((u) => u.minutosAndamento > 0);
  if (comTempo.length) {
    barrasHorizontais(alvoPessoas, comTempo.map((u) => ({
      rotulo: u.nome,
      valor: u.minutosAndamento,
      cor: "var(--serie)",
      dica: `${u.nome}\n${duracao(u.minutosAndamento)} em andamento\n${plural(u.demandas, "demanda", "demandas")}, ${u.concluidas} concluídas`,
    })), { formatar: duracao, descricao: "Tempo em andamento por pessoa" });
  } else {
    alvoPessoas.innerHTML = String(html`<p class="secundario pequeno">Ninguém da GEPAG registrou tempo em andamento neste ciclo.</p>`);
  }

  const alvoUnidades = $("[data-g-unidades]", raiz);
  if (r.porUnidade.length) {
    barrasHorizontais(alvoUnidades, r.porUnidade.map((u) => ({
      rotulo: op.unidade[u.unidade].rotulo,
      valor: u.minutos,
      cor: u.unidade === "GEPAG" ? "var(--serie)" : "var(--revisar)",
      dica: `${op.unidade[u.unidade].rotulo}\n${duracao(u.minutos)} no total\n${duracao(u.minutosAndamento)} em andamento, ${duracao(u.minutosEspera)} com demanda aguardando`,
    })), { formatar: duracao, descricao: "Tempo por unidade" });
  } else {
    alvoUnidades.innerHTML = String(html`<p class="secundario pequeno">Nenhum tempo registrado ainda.</p>`);
  }

  const fases = r.porFase.filter((f) => f.minutos > 0);
  const alvoFases = $("[data-g-fases]", raiz);
  if (fases.length) {
    barrasHorizontais(alvoFases, fases.map((f) => ({
      rotulo: op.fase[f.fase].rotulo,
      valor: f.minutos,
      cor: f.fim ? "var(--ok)" : "var(--lampada)",
      dica: `${op.fase[f.fase].rotulo}\n${duracao(f.minutos)}${f.fim ? " (encerrada)" : " (em andamento)"}\n${f.encerradas} de ${f.demandas} demandas encerradas`,
    })), { formatar: duracao, descricao: "Duração de cada fase" });
  } else {
    alvoFases.innerHTML = String(html`<p class="secundario pequeno">Nenhuma fase iniciada.</p>`);
  }
}
