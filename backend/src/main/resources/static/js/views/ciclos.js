// Ciclos da folha: abrir, encerrar, reabrir e excluir.
import { api } from "../api.js";
import { competencia, dataHora, duracao } from "../formato.js";
import { $$, avisar, dadosAlterados, html, ocupado } from "../ui.js";
import { ligarFormCiclo } from "./painel.js";

export const titulo = "Ciclos";

export async function render(raiz) {
  const lista = await api.get("/ciclos");
  const aberto = lista.find((c) => !c.encerrado);

  raiz.innerHTML = String(html`
    <header class="cabecalho"><div><h1 tabindex="-1">Ciclos</h1>
      <p>Cada ciclo cria uma demanda para cada etapa do roteiro. Responsáveis e tempos para solução são copiados do ciclo anterior.</p></div></header>

    <div class="colunas">
      <section aria-labelledby="t-lista">
        <div class="secao-titulo"><h2 id="t-lista">Todos os ciclos</h2></div>
        ${lista.length ? html`<div class="painel tabela-rolagem"><table class="tabela">
          <thead><tr><th>Ciclo</th><th>Período</th><th class="num">Demandas</th><th><span class="sr-only">Ações</span></th></tr></thead>
          <tbody>${lista.map((c) => html`<tr>
            <td><a href="#/?ciclo=${c.id}">${c.nome}</a>
              <label class="sub competencia-ciclo"><span class="sr-only">Competência de ${c.nome}</span>
                <input class="entrada" type="month" value="${c.competencia ?? ""}" data-competencia="${c.id}" title="Competência (define os prazos do cronograma)"></label></td>
            <td>${dataHora(c.abertoEm)}${c.encerrado ? html` a ${dataHora(c.encerradoEm)}` : html` <span class="selo lampada">Aberto</span>`}<span class="sub">${duracao(c.minutosDecorridos)}</span></td>
            <td class="num">${c.encerradas} de ${c.totalTarefas}<span class="sub">encerradas</span></td>
            <td><div class="acoes" style="justify-content: flex-end; flex-wrap: nowrap">
              <a class="botao pequeno sutil" href="#/relatorios?ciclo=${c.id}">Tempos</a>
              ${c.encerrado
                ? html`<button class="botao pequeno" type="button" data-reabrir="${c.id}">Reabrir</button>`
                : html`<button class="botao pequeno" type="button" data-encerrar="${c.id}" data-abertas="${c.totalTarefas - c.encerradas}">Encerrar</button>`}
              <button class="botao pequeno sutil perigo" type="button" data-excluir="${c.id}" data-nome="${c.nome}">Excluir</button>
            </div></td>
          </tr>`)}</tbody></table></div>`
          : html`<div class="painel vazio"><span>Nenhum ciclo ainda.</span></div>`}
      </section>

      <section class="painel painel-corpo" aria-labelledby="t-novo">
        <form class="pilha" style="gap: 14px" data-form-ciclo novalidate>
          <h2 id="t-novo">Abrir novo ciclo</h2>
          ${aberto ? html`<p class="aviso">"${aberto.nome}" ainda está aberto. Pode abrir outro mesmo assim; o painel mostra sempre o aberto mais recente.</p>` : ""}
          <label class="campo"><span>Nome</span><input name="nome" required placeholder="Folha novembro/2026"></label>
          <label class="campo"><span>Competência</span><input name="competencia" type="month"></label>
          <div class="acoes"><button class="botao primario" type="submit">Abrir ciclo</button></div>
        </form>
      </section>
    </div>`);

  ligarFormCiclo(raiz.querySelector("[data-form-ciclo]"));

  $$("[data-encerrar]", raiz).forEach((b) => b.addEventListener("click", async () => {
    const abertas = Number(b.dataset.abertas);
    if (abertas && !confirm(`Ainda há ${abertas} demanda(s) aberta(s). Encerrar assim mesmo? Os tempos param de contar agora.`)) return;
    const ok = await ocupado(b, () => api.post(`/ciclos/${b.dataset.encerrar}/encerrar?forcar=${abertas > 0}`));
    if (ok) {
      avisar(`Ciclo "${ok.nome}" encerrado.`, { tipo: "sucesso" });
      dadosAlterados();
    }
  }));
  $$("[data-competencia]", raiz).forEach((campo) => campo.addEventListener("change", async () => {
    const ok = await ocupado(null, () => api.patch(`/ciclos/${campo.dataset.competencia}`, { competencia: campo.value }));
    if (ok) {
      avisar(ok.competencia ? `Competência: ${competencia(ok.competencia)}.` : "Competência removida.", { tipo: "sucesso" });
      dadosAlterados();
    }
  }));
  $$("[data-reabrir]", raiz).forEach((b) => b.addEventListener("click", async () => {
    const ok = await ocupado(b, () => api.post(`/ciclos/${b.dataset.reabrir}/reabrir`));
    if (ok) {
      avisar(`Ciclo "${ok.nome}" reaberto. Os tempos voltam a contar até agora.`, { tipo: "sucesso" });
      dadosAlterados();
    }
  }));
  $$("[data-excluir]", raiz).forEach((b) => b.addEventListener("click", async () => {
    if (!confirm(`Excluir o ciclo "${b.dataset.nome}" com todas as demandas e históricos? Não dá para desfazer.`)) return;
    const ok = await ocupado(b, async () => {
      await api.del(`/ciclos/${b.dataset.excluir}`);
      return true;
    });
    if (ok) {
      avisar("Ciclo excluído.");
      dadosAlterados();
    }
  }));
}
