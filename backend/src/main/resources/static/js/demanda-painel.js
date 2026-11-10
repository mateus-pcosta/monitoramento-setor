// Painel lateral de uma demanda: status, responsável, tempo para solução, itens, observação e histórico.
import { api } from "./api.js";
import { opcoes, usuarios } from "./dados.js";
import { atraso, dataHora, duracao, plural, prazoCronograma } from "./formato.js";
import { $, $$, abrirGaveta, avisar, avisarErro, dadosAlterados, fecharGaveta, html, ocupado, seloStatus } from "./ui.js";

/** Próximo passo mais comum para cada status (botão em destaque). */
const SUGESTAO = { PENDENTE: "EM_ANDAMENTO", EM_ANDAMENTO: "CONCLUIDA", CONCLUIDA: "EM_ANDAMENTO", VALIDADO: "EM_ANDAMENTO", ANULADO: "EM_ANDAMENTO" };
const ROTULO_SUGESTAO = { PENDENTE: "Iniciar (em andamento)", EM_ANDAMENTO: "Concluir", CONCLUIDA: "Reabrir", VALIDADO: "Reabrir (em andamento)", ANULADO: "Reabrir (em andamento)" };

/**
 * Status que podem ser escolhidos agora. Pendente é a demanda sem status: só volta a ele quem foi validado
 * ou anulado sem nunca ter sido iniciado. Antes de "Em andamento" (quando o tempo começa) só cabem Validado e Anulado.
 */
function permitidos(lista, t) {
  return lista.filter((s) => {
    if (s.valor === t.status) return false;
    if (s.valor === "PENDENTE") return !t.iniciadaEm && t.status !== "PENDENTE";
    return t.iniciadaEm || s.valor === "EM_ANDAMENTO" || s.valor === "VALIDADO" || s.valor === "ANULADO";
  });
}

/** Quem registrou a última observação neste navegador, para já vir escolhido na próxima. */
const CHAVE_AUTOR = "autorObservacao";

function autorSalvo() {
  try {
    return localStorage.getItem(CHAVE_AUTOR) ?? "";
  } catch {
    return "";
  }
}

function salvarAutor(id) {
  try {
    localStorage.setItem(CHAVE_AUTOR, id);
  } catch {
    // sem armazenamento: o autor só não vem preenchido da próxima vez
  }
}

export async function abrirDemanda(id, { encerrado = false } = {}) {
  let detalhe;
  let op;
  let pessoas;
  try {
    [detalhe, op, pessoas] = await Promise.all([api.get(`/demandas/${id}`), opcoes(), usuarios()]);
  } catch (e) {
    avisarErro(e);
    return;
  }
  abrirGaveta({
    rotulo: detalhe.tarefa.titulo,
    render: (gaveta) => desenhar(gaveta, detalhe, { op, pessoas, encerrado }),
  });
}

function desenhar(gaveta, detalhe, ctx) {
  const { op, pessoas, encerrado } = ctx;
  const t = detalhe.tarefa;
  const st = op.status[t.status];
  const sugerido = st.aguardando ? "EM_ANDAMENTO" : SUGESTAO[t.status];
  const rotuloSugerido = st.aguardando ? "Retomar (em andamento)" : ROTULO_SUGESTAO[t.status];
  const outros = permitidos(op.listaStatus, t).filter((s) => s.valor !== sugerido);
  const ativos = pessoas.filter((p) => p.ativo || p.id === t.responsavel?.id);
  const internos = ativos.filter((p) => !p.externo);
  const externos = ativos.filter((p) => p.externo);
  const abertos = detalhe.itens.filter((i) => !i.resolvido);
  const tipoPadrao = t.tipoItem ?? "OUTRO";
  const bloqueado = encerrado ? "disabled" : "";
  const autorPadrao = autorSalvo();
  const eventos = [
    ...detalhe.historico.map((p) => ({ em: p.inicio, periodo: p })),
    ...detalhe.observacoes.map((o) => ({ em: o.em, observacao: o })),
  ].sort((a, b) => (a.em < b.em ? 1 : a.em > b.em ? -1 : 0));

  gaveta.innerHTML = String(html`
    <header class="gaveta-topo">
      <div>
        <div class="materia">${op.fase[t.fase].rotulo}${t.numero ? ` · etapa ${t.numero}` : " · demanda avulsa"}</div>
        <h2>${t.titulo}</h2>
        <div class="acoes" style="margin-top: 10px">
          ${seloStatus(t.status, st.rotulo)}
          ${t.foraDoPrazo ? html`<span class="selo prioridade">Fora do prazo</span>` : ""}
          <span class="pequeno mudo">${st.encerrado ? `em ${dataHora(t.statusDesde)}` : `há ${duracao(t.minutosNoStatusAtual)}, desde ${dataHora(t.statusDesde)}`}</span>
        </div>
      </div>
      <button class="botao sutil pequeno" type="button" data-fechar aria-label="Fechar painel">Fechar</button>
    </header>

    <div class="gaveta-corpo">
      ${encerrado ? html`<p class="aviso" style="margin-top: 16px">O ciclo desta demanda está encerrado. Para alterar, reabra o ciclo na tela Ciclos.</p>` : ""}

      <section class="bloco" aria-labelledby="b-status">
        <div class="bloco-titulo"><h3 id="b-status">Status</h3></div>
        <div class="acoes">
          ${sugerido ? html`<button class="botao primario" type="button" data-status="${sugerido}" ${bloqueado}>${rotuloSugerido}</button>` : ""}
        </div>
        <div class="grade-status" role="group" aria-label="Mudar para">
          ${outros.map((s) => html`<button class="botao pequeno" type="button" data-status="${s.valor}" ${bloqueado}>${s.rotulo}</button>`)}
        </div>
        <label class="campo"><span>Nota (opcional)</span>
          <input data-nota placeholder="Ex.: chamado 1234 aberto na Logus" maxlength="250" ${bloqueado}></label>
        <details class="recolhivel">
          <summary>Registrar com outro horário</summary>
          <label class="campo"><span>Aconteceu em</span>
            <input type="datetime-local" data-quando ${bloqueado}>
            <small>Use quando esquecer de marcar na hora. Vale para mudança de status e de responsável.</small></label>
        </details>
      </section>

      <section class="bloco" aria-labelledby="b-resp">
        <div class="bloco-titulo"><h3 id="b-resp">Responsável</h3></div>
        <label class="campo"><span class="sr-only">Responsável</span>
          <select data-responsavel ${bloqueado}>
            <option value="">Sem responsável (${op.unidade[t.unidade].rotulo})</option>
            <optgroup label="GEPAG">${internos.map((p) => html`<option value="${p.id}" ${p.id === t.responsavel?.id ? "selected" : ""}>${p.nome}</option>`)}</optgroup>
            <optgroup label="Unidades externas">${externos.map((p) => html`<option value="${p.id}" ${p.id === t.responsavel?.id ? "selected" : ""}>${p.codigoUg ? `${p.codigoUg} - ` : ""}${p.nome}</option>`)}</optgroup>
          </select>
        </label>
        <p class="pequeno mudo">Trocar o responsável não zera a demanda: o tempo a partir de agora passa a contar para a nova pessoa.</p>
      </section>

      <section class="bloco" aria-labelledby="b-tempo">
        <div class="bloco-titulo"><h3 id="b-tempo">Tempo</h3></div>
        <dl class="numeros">
          <div><dt>Desde o início</dt><dd class="num">${t.iniciadaEm ? duracao(t.minutosTotais) : "Não iniciada"}</dd>
            ${t.iniciadaEm ? html`<dd class="sub">iniciada ${dataHora(t.iniciadaEm)}${t.concluidaEm ? `, encerrada ${dataHora(t.concluidaEm)}` : ""}</dd>` : ""}</div>
          ${t.prazoCronograma ? html`<div><dt>Prazo do cronograma</dt><dd class="num">${prazoCronograma(t.prazoCronograma).replace(/^até /, "")}</dd>
            <dd class="sub ${t.minutosAtrasoCronograma != null ? "alerta" : ""}">${textoAtrasoCronograma(t) || t.marcoCronograma}</dd></div>` : ""}
          <div><dt>Tempo para solução</dt><dd class="num">${t.prazoHoras ? duracao(t.prazoHoras * 60) : "Sem prazo"}</dd>
            ${textoPrazo(t) ? html`<dd class="sub ${t.foraDoPrazo ? "alerta" : ""}">${textoPrazo(t)}</dd>` : ""}</div>
        </dl>
        ${Object.keys(t.minutosPorStatus).length ? html`
          <ul class="por-status">
            ${op.listaStatus.filter((s) => t.minutosPorStatus[s.valor] && !s.encerrado).map((s) => html`
              <li><span>${seloStatus(s.valor, s.rotulo)}</span><b class="num">${duracao(t.minutosPorStatus[s.valor])}</b></li>`)}
          </ul>` : ""}
        <form class="acoes" data-form-prazo novalidate>
          <label class="campo" style="flex: 1 1 160px"><span>Tempo para solução (horas)</span>
            <input name="prazo" type="number" min="0.25" step="0.25" value="${t.prazoHoras ?? ""}" placeholder="Ex.: 8" ${bloqueado}></label>
          <button class="botao" type="submit" style="align-self: flex-end" ${bloqueado}>Salvar prazo</button>
        </form>
      </section>

      <section class="bloco" aria-labelledby="b-itens">
        <div class="bloco-titulo"><h3 id="b-itens">Itens para visualizar</h3>
          <span class="pequeno mudo">${detalhe.itens.length ? `${plural(abertos.length, "aberto", "abertos")} de ${detalhe.itens.length}` : ""}</span></div>
        ${detalhe.itens.length ? html`<ul class="itens">
          ${detalhe.itens.map((i) => html`<li class="${i.resolvido ? "resolvido" : ""}">
            <label><input type="checkbox" data-item="${i.id}" ${i.resolvido ? "checked" : ""} ${bloqueado}>
              <span>${i.identificador ? html`<b>${i.identificador}</b> ` : ""}${i.descricao}
                <small>${op.tipoItem[i.tipo].rotulo}${i.resolvido ? ` · resolvido ${dataHora(i.resolvidoEm)}` : ` · incluído ${dataHora(i.criadoEm)}`}</small></span></label>
            <button class="botao sutil pequeno" type="button" data-excluir-item="${i.id}" aria-label="Excluir item" ${bloqueado}>Excluir</button>
          </li>`)}
        </ul>` : html`<p class="pequeno mudo">${t.tipoItem
          ? `Liste aqui os casos desta etapa (${op.tipoItem[t.tipoItem].rotulo.toLowerCase()}) para a equipe acompanhar o que falta.`
          : "Se esta etapa tiver casos a acompanhar, liste-os aqui."}</p>`}
        <form class="pilha" style="gap: 10px" data-form-itens novalidate>
          <label class="campo"><span>Adicionar itens (um por linha)</span>
            <textarea name="texto" rows="3" placeholder="2026NE000123 - Empenho sem saldo&#10;Pode colar direto do Excel" ${bloqueado}></textarea></label>
          <div class="acoes">
            <select class="entrada" name="tipo" style="flex: 1 1 200px; width: auto" aria-label="Tipo dos itens" ${bloqueado}>
              ${op.tiposItem.map((o) => html`<option value="${o.valor}" ${o.valor === tipoPadrao ? "selected" : ""}>${o.rotulo}</option>`)}
            </select>
            <button class="botao" type="submit" ${bloqueado}>Adicionar</button>
          </div>
        </form>
      </section>

      <section class="bloco" aria-labelledby="b-obs">
        <div class="bloco-titulo"><h3 id="b-obs">Observação</h3>
          ${t.observacaoPor ? html`<span class="pequeno mudo">por ${t.observacaoPor}, ${dataHora(t.observacaoEm)}</span>` : ""}</div>
        <form class="pilha" style="gap: 10px" data-form-obs novalidate>
          <label class="campo"><span class="sr-only">Observação</span>
            <textarea name="obs" rows="3" maxlength="2000" placeholder="Aparece no Painel do ciclo, junto da demanda" ${bloqueado}>${t.observacao ?? ""}</textarea></label>
          <div class="acoes">
            <select class="entrada" name="autor" style="flex: 1 1 200px; width: auto" aria-label="Quem está registrando" ${bloqueado}>
              <option value="">Quem está registrando?</option>
              ${internos.filter((p) => p.ativo).map((p) => html`<option value="${p.id}" ${String(p.id) === autorPadrao ? "selected" : ""}>${p.nome}</option>`)}
            </select>
            <button class="botao" type="submit" ${bloqueado}>Salvar observação</button>
          </div>
          <p class="pequeno mudo">Cada alteração fica no histórico abaixo, com o nome de quem registrou.</p>
        </form>
      </section>

      <section class="bloco" aria-labelledby="b-hist">
        <div class="bloco-titulo"><h3 id="b-hist">Histórico</h3></div>
        ${eventos.length ? html`<ol class="historico">
          ${eventos.map(({ periodo: p, observacao: o }) => p ? html`<li>
            <div>${seloStatus(p.status, op.status[p.status].rotulo)}
              <span class="pequeno">${p.responsavel?.nome ?? "Sem responsável"}</span></div>
            <div class="pequeno mudo">${dataHora(p.inicio)}${op.status[p.status].encerrado ? "" : html` até ${p.fim ? dataHora(p.fim) : "agora"} · <b class="num">${duracao(p.minutos)}</b>`}</div>
            ${p.nota ? html`<div class="pequeno secundario">${p.nota}</div>` : ""}
          </li>` : html`<li class="evento-obs">
            <div><span class="selo">${o.texto ? "Observação" : "Observação apagada"}</span>
              <span class="pequeno">por ${o.autor}</span></div>
            <div class="pequeno mudo">${dataHora(o.em)}</div>
            ${o.texto ? html`<div class="pequeno secundario texto-obs">${o.texto}</div>` : ""}
          </li>`)}
        </ol>` : html`<p class="pequeno mudo">Nada registrado ainda. O tempo começa a contar quando a demanda é marcada como Em andamento.</p>`}
      </section>
    </div>
    ${t.avulsa && !encerrado ? html`<footer class="gaveta-rodape"><button class="botao sutil perigo pequeno" type="button" data-excluir>Excluir demanda avulsa</button></footer>` : ""}`);

  const atualizar = (novo) => {
    desenhar(gaveta, novo, ctx);
    dadosAlterados();
  };
  const quando = () => $("[data-quando]", gaveta).value || null;

  $("[data-fechar]", gaveta).addEventListener("click", () => fecharGaveta());

  $$("[data-status]", gaveta).forEach((b) => b.addEventListener("click", async () => {
    const novo = await ocupado(b, () => api.post(`/demandas/${t.id}/status`, {
      status: b.dataset.status, quando: quando(), nota: $("[data-nota]", gaveta).value,
    }));
    if (novo) {
      avisar(`Status: ${op.status[b.dataset.status].rotulo}.`, { tipo: "sucesso" });
      atualizar(novo);
    }
  }));

  $("[data-responsavel]", gaveta).addEventListener("change", async (e) => {
    const valor = e.target.value;
    const novo = await ocupado(e.target, () => api.post(`/demandas/${t.id}/responsavel`, {
      responsavelId: valor ? Number(valor) : null, quando: quando(),
    }));
    if (novo) {
      avisar(novo.tarefa.responsavel ? `Responsável: ${novo.tarefa.responsavel.nome}.` : "Responsável removido.", { tipo: "sucesso" });
      atualizar(novo);
    } else {
      e.target.value = t.responsavel?.id ?? "";
    }
  });

  $("[data-form-prazo]", gaveta).addEventListener("submit", async (e) => {
    e.preventDefault();
    const valor = e.target.prazo.value.trim();
    const corpo = valor ? { prazoHoras: Number(valor.replace(",", ".")) } : { limparPrazo: true };
    const novo = await ocupado(e.submitter, () => api.patch(`/demandas/${t.id}`, corpo));
    if (novo) {
      avisar(valor ? "Tempo para solução salvo." : "Prazo removido.", { tipo: "sucesso" });
      atualizar(novo);
    }
  });

  $("[data-form-obs]", gaveta).addEventListener("submit", async (e) => {
    e.preventDefault();
    const autor = e.target.autor.value;
    if (!autor) {
      avisar("Escolha quem está registrando a observação.", { tipo: "erro" });
      e.target.autor.focus();
      return;
    }
    salvarAutor(autor);
    const novo = await ocupado(e.submitter, () => api.patch(`/demandas/${t.id}`, { observacao: e.target.obs.value, autorId: Number(autor) }));
    if (novo) {
      avisar("Observação salva.", { tipo: "sucesso" });
      atualizar(novo);
    }
  });

  $("[data-form-itens]", gaveta).addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = await ocupado(e.submitter, () => api.post(`/demandas/${t.id}/itens`, { tipo: e.target.tipo.value, texto: e.target.texto.value }));
    if (ok) {
      avisar(`${plural(ok.length, "item incluído", "itens incluídos")}.`, { tipo: "sucesso" });
      recarregar(gaveta, t.id, ctx);
    }
  });

  $$("[data-item]", gaveta).forEach((c) => c.addEventListener("change", async () => {
    const ok = await ocupado(c, () => api.patch(`/itens/${c.dataset.item}`, { resolvido: c.checked }));
    if (ok) recarregar(gaveta, t.id, ctx);
    else c.checked = !c.checked;
  }));

  $$("[data-excluir-item]", gaveta).forEach((b) => b.addEventListener("click", async () => {
    if (!confirm("Excluir este item?")) return;
    const ok = await ocupado(b, async () => {
      await api.del(`/itens/${b.dataset.excluirItem}`);
      return true;
    });
    if (ok) recarregar(gaveta, t.id, ctx);
  }));

  $("[data-excluir]", gaveta)?.addEventListener("click", async (e) => {
    if (!confirm(`Excluir a demanda "${t.titulo}" e todo o histórico dela?`)) return;
    const ok = await ocupado(e.currentTarget, async () => {
      await api.del(`/demandas/${t.id}`);
      return true;
    });
    if (ok) {
      avisar("Demanda excluída.");
      fecharGaveta();
      dadosAlterados();
    }
  });
}

async function recarregar(gaveta, id, ctx) {
  try {
    desenhar(gaveta, await api.get(`/demandas/${id}`), ctx);
    dadosAlterados();
  } catch (e) {
    avisarErro(e);
  }
}

/** "Restam 2h" / "Estourou em 3h" / "Concluída dentro do prazo". */
/** "Atrasado conforme o cronograma: 2 dias e 4 h"; vazio se a demanda não está atrasada. */
export function textoAtrasoCronograma(t) {
  if (t.minutosAtrasoCronograma == null) return "";
  return t.status === "CONCLUIDA"
    ? `Concluída com atraso de ${atraso(t.minutosAtrasoCronograma)} conforme o cronograma`
    : `Atrasado conforme o cronograma: ${atraso(t.minutosAtrasoCronograma)}`;
}

export function textoPrazo(t) {
  if (!t.prazoHoras || !t.iniciadaEm || t.status === "VALIDADO" || t.status === "ANULADO") return "";
  const sobra = t.prazoHoras * 60 - t.minutosTotais;
  if (t.concluidaEm) return t.foraDoPrazo ? `Concluída ${duracao(-sobra)} depois do prazo` : "Concluída dentro do prazo";
  return t.foraDoPrazo ? `Passou do prazo há ${duracao(-sobra)}` : `Restam ${duracao(sobra)}`;
}
