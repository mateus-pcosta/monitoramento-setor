// Usuários, planilha local / Google Sheets e aparência.
import { api } from "../api.js";
import { limparUsuarios, opcoes, usuarios } from "../dados.js";
import { dataHora, plural } from "../formato.js";
import { $, $$, avisar, dadosAlterados, html, ocupado } from "../ui.js";

export const titulo = "Usuários e planilha";

export async function render(raiz) {
  const [pessoas, op, planilha] = await Promise.all([usuarios(true), opcoes(), api.get("/planilha")]);
  const tema = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const internos = pessoas.filter((p) => !p.externo);
  const externos = pessoas.filter((p) => p.externo);

  const ehUg = (p) => op.unidadesUg.includes(p.unidade);
  const tabela = (lista) => html`<div class="painel tabela-rolagem"><table class="tabela">
    <thead><tr><th>Nome</th><th>Unidade</th><th>Situação</th><th><span class="sr-only">Ações</span></th></tr></thead>
    <tbody>${lista.map((p) => html`<tr>
      <td>${p.nome}${ehUg(p) ? html`<span class="sub num">${p.codigoUg ? `UG ${p.codigoUg}` : "Sem código de UG"}</span>` : ""}</td>
      <td>${op.unidade[p.unidade].rotulo}${ehUg(p) && p.unidade !== "UG" ? " (UG)" : ""}</td>
      <td>${p.ativo ? html`<span class="selo ok">Ativo</span>` : html`<span class="selo">Inativo</span>`}</td>
      <td><div class="acoes" style="justify-content: flex-end">
        <button class="botao pequeno sutil" type="button" data-renomear="${p.id}" data-nome="${p.nome}">Renomear</button>
        ${ehUg(p) ? html`<button class="botao pequeno sutil" type="button" data-codigo="${p.id}" data-valor="${p.codigoUg ?? ""}">Código UG</button>` : ""}
        <button class="botao pequeno sutil" type="button" data-ativo="${p.id}" data-valor="${!p.ativo}">${p.ativo ? "Desativar" : "Reativar"}</button>
      </div></td>
    </tr>`)}</tbody></table></div>`;

  raiz.innerHTML = String(html`
    <header class="cabecalho"><div><h1 tabindex="-1">Usuários e planilha</h1>
      <p>Quem pode receber demandas e onde os tempos são gravados.</p></div></header>

    <div class="config-grade">
      <div class="pilha">
        <section aria-labelledby="t-equipe">
          <div class="secao-titulo"><h2 id="t-equipe">Equipe GEPAG</h2><span class="mudo">${plural(internos.length, "pessoa", "pessoas")}</span></div>
          ${internos.length ? tabela(internos) : html`<div class="painel vazio"><span>Ninguém cadastrado ainda. Use o formulário ao lado; dá para colar a lista de nomes de uma vez.</span></div>`}
        </section>
        <section aria-labelledby="t-externos">
          <div class="secao-titulo"><h2 id="t-externos">Unidades externas</h2><span class="mudo">SEAD, SEPLAN e demais UGs, só para atribuir demandas</span></div>
          ${tabela(externos)}
        </section>
      </div>

      <div class="pilha">
        <section class="painel painel-corpo" aria-labelledby="t-novo">
          <form class="pilha" style="gap: 14px" data-form-usuarios novalidate>
            <div><h2 id="t-novo">Adicionar usuários</h2>
              <p class="secundario pequeno" style="margin-top: 4px">Um nome por linha. Nomes já cadastrados são ignorados.
              Para UGs, cole no padrão do SIAFE, <span class="num">140102 - NOME DA UG</span>: o código fica guardado à parte.</p></div>
            <label class="campo"><span>Nomes</span><textarea name="nomes" rows="5" placeholder="Maria Souza&#10;João Lima&#10;ou, para UGs: 140102 - NOME DA UG"></textarea></label>
            <label class="campo"><span>Unidade</span><select name="unidade">
              ${op.unidadesDeUsuario.map((u) => html`<option value="${u.valor}">${u.rotulo}${op.unidadesUg.includes(u.valor) && u.valor !== "UG" ? " (UG)" : ""}</option>`)}
            </select></label>
            <div class="acoes"><button class="botao primario" type="submit">Adicionar</button></div>
          </form>
        </section>

        <section class="painel painel-corpo" aria-labelledby="t-planilha">
          <div class="pilha" style="gap: 14px">
            <div><h2 id="t-planilha">Planilha</h2>
              <p class="secundario pequeno" style="margin-top: 4px">Regravada sozinha a cada alteração e a cada 10 minutos (para atualizar os tempos que estão correndo).
              Abas: Resumo, Demandas, Histórico, Tempo por usuário, Tempo por unidade, Tempo por fase, Itens e Usuários.</p></div>
            <p class="pequeno"><span class="mudo">Arquivo:</span> <code>${planilha.caminho}</code></p>
            ${planilha.erro
              ? html`<p class="aviso prioridade">${planilha.erro}</p>`
              : html`<p class="pequeno mudo">${planilha.ultimaGravacao ? `Última gravação: ${dataHora(planilha.ultimaGravacao)}.` : "Ainda não gravada."}</p>`}
            <div class="acoes">
              <button class="botao" type="button" data-gravar>Gravar agora</button>
              <a class="botao sutil" href="/api/planilha/baixar" download>Baixar cópia</a>
            </div>
            <div>
              <h3 style="margin-bottom: 4px">Google Sheets</h3>
              <p class="pequeno secundario">${planilha.sheetsLigado && planilha.sheetsConfigurado
                ? (planilha.erroSheets ? html`<span class="aviso prioridade" style="display: block">${planilha.erroSheets}</span>`
                  : planilha.ultimoEnvioSheets ? `Ligado. Último envio: ${dataHora(planilha.ultimoEnvioSheets)}.` : "Ligado. Envia junto com a próxima gravação.")
                : "Desligado. Para a equipe acompanhar online, configure app.sheets no application.yml (passo a passo no README)."}</p>
            </div>
          </div>
        </section>

        <section class="painel painel-corpo" aria-labelledby="t-tema">
          <h2 id="t-tema">Aparência</h2>
          <div class="segmentos" role="group" aria-label="Tema" style="margin-top: 12px">
            <button type="button" data-tema="dark" aria-pressed="${tema === "dark"}">Escuro</button>
            <button type="button" data-tema="light" aria-pressed="${tema === "light"}">Claro</button>
          </div>
        </section>
      </div>
    </div>`);

  const alterou = () => {
    limparUsuarios();
    dadosAlterados();
  };

  $("[data-form-usuarios]", raiz).addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const criados = await ocupado(e.submitter, () => api.post("/usuarios/lote", { nomes: f.nomes.value, unidade: f.unidade.value }));
    if (criados) {
      avisar(criados.length ? `${plural(criados.length, "usuário adicionado", "usuários adicionados")}.` : "Nenhum nome novo para adicionar.",
        { tipo: criados.length ? "sucesso" : "info" });
      alterou();
    }
  });

  $$("[data-renomear]", raiz).forEach((b) => b.addEventListener("click", async () => {
    const nome = prompt("Novo nome:", b.dataset.nome);
    if (!nome || nome.trim() === b.dataset.nome) return;
    const ok = await ocupado(b, () => api.patch(`/usuarios/${b.dataset.renomear}`, { nome }));
    if (ok) alterou();
  }));

  $$("[data-codigo]", raiz).forEach((b) => b.addEventListener("click", async () => {
    const codigo = prompt("Código da UG no SIAFE (6 dígitos). Deixe vazio para remover:", b.dataset.valor);
    if (codigo === null || codigo.trim() === b.dataset.valor) return;
    const ok = await ocupado(b, () => api.patch(`/usuarios/${b.dataset.codigo}`, { codigoUg: codigo }));
    if (ok) alterou();
  }));

  $$("[data-ativo]", raiz).forEach((b) => b.addEventListener("click", async () => {
    const ok = await ocupado(b, () => api.patch(`/usuarios/${b.dataset.ativo}`, { ativo: b.dataset.valor === "true" }));
    if (ok) {
      avisar(ok.ativo ? `${ok.nome} reativado.` : `${ok.nome} desativado. Continua nos ciclos antigos, mas não aparece para novas atribuições.`);
      alterou();
    }
  }));

  $("[data-gravar]", raiz).addEventListener("click", async (e) => {
    const ok = await ocupado(e.currentTarget, () => api.post("/planilha/gravar"));
    if (ok) {
      avisar("Planilha gravada.", { tipo: "sucesso" });
      dadosAlterados();
    }
  });

  $$("[data-tema]", raiz).forEach((b) => b.addEventListener("click", () => {
    aplicarTema(b.dataset.tema);
    $$("[data-tema]", raiz).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }));
}

function aplicarTema(tema) {
  if (tema === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem("tema", tema);
  } catch {
    // sem armazenamento: o tema vale só nesta aba
  }
}
