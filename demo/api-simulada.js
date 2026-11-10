// Demonstração (GitHub Pages): substitui o servidor por esta API simulada no navegador.
// Reproduz as regras do back-end (Tarefa, CicloService, TarefaService, UsuarioService, RelatorioService,
// Cronogramas) e guarda os dados no localStorage de quem está testando. Nada é enviado a lugar nenhum.

const CHAVE = "gepag-demo-v1";

// ---------- Enums (mesma ordem e rótulos do back-end) ----------

const UNIDADES = {
  GEPAG: { rotulo: "GEPAG", ug: false },
  SEAD: { rotulo: "SEAD", ug: true },
  SEPLAN: { rotulo: "SEPLAN", ug: true },
  UG: { rotulo: "Outra UG", ug: true },
  LOGUS: { rotulo: "Logus", ug: false },
  SEI: { rotulo: "Processo SEI", ug: false },
};
const COM_USUARIOS = ["GEPAG", "SEAD", "UG", "SEPLAN"];

const STATUS = {
  PENDENTE: { rotulo: "Pendente", aguardando: null },
  EM_ANDAMENTO: { rotulo: "Em andamento", aguardando: null },
  ANULADO: { rotulo: "Anulado", aguardando: null },
  VALIDADO: { rotulo: "Validado", aguardando: null },
  AGUARDANDO_SEAD: { rotulo: "Aguardando SEAD", aguardando: "SEAD" },
  AGUARDANDO_SEPLAN: { rotulo: "Aguardando SEPLAN", aguardando: "SEPLAN" },
  AGUARDANDO_LOGUS: { rotulo: "Aguardando Logus", aguardando: "LOGUS" },
  AGUARDANDO_SEI: { rotulo: "Aguardando processo SEI", aguardando: "SEI" },
  CONCLUIDA: { rotulo: "Concluído", aguardando: null },
};
const encerrado = (s) => s === "CONCLUIDA" || s === "VALIDADO" || s === "ANULADO";
const semExecucao = (s) => s === "VALIDADO" || s === "ANULADO";
const aguardandoTerceiro = (s) => STATUS[s].aguardando != null;

const FASES = {
  SEAD: { rotulo: "Etapa SEAD", descricao: "Transmissão, cadastros e relatórios até zerar as inconsistências.", unidade: "SEAD" },
  TRATAMENTO: { rotulo: "Tratamento SEFAZ", descricao: "Mapeamentos orçamentários, rubricas e tipos de arquivo, e compliance dos relatórios.", unidade: "GEPAG" },
  AGENDAMENTO_ORCAMENTARIO: { rotulo: "Agendamento orçamentário", descricao: "Fechamento e contabilização dos arquivos orçamentários e tratamento das pendências.", unidade: "GEPAG" },
  AGENDAMENTO_COLABORADOR: { rotulo: "Agendamento colaborador", descricao: "Fechamento, PDs provisórias e contabilização.", unidade: "GEPAG" },
  AGENDAMENTO_CREDITO: { rotulo: "Agendamento crédito", descricao: "Fechamento, contabilização e PDs pendentes.", unidade: "GEPAG" },
};
const ORDEM_FASES = Object.keys(FASES);

const TIPOS_ITEM = {
  INCONSISTENCIA: "Inconsistência",
  SC: "SC",
  EMPENHO_PROVISORIO: "Empenho provisório",
  DOCUMENTO_PENDENTE: "Documento pendente (NP, NE, NL)",
  PD_PROVISORIA: "PD provisória",
  PD_PENDENTE: "PD pendente",
  OUTRO: "Outro",
};

// [etapa, fase, número, título, tipo de item, opcional]
const ETAPAS = [
  ["SEAD_TRANSMISSAO", "SEAD", "1", "Transmissão dos arquivos", null, false],
  ["SEAD_CADASTROS", "SEAD", "2", "Resolver cadastros", null, false],
  ["SEAD_RELATORIOS", "SEAD", "3", "Enviar os relatórios", null, false],
  ["SEAD_INCONSISTENCIAS", "SEAD", "4", "Zerar inconsistências (encerra a etapa SEAD)", "INCONSISTENCIA", false],
  ["TRAT_MAPEAMENTOS", "TRATAMENTO", "1", "Resolver mapeamentos orçamentários", "INCONSISTENCIA", false],
  ["TRAT_RUBRICAS", "TRATAMENTO", "2", "Resolver problemas de rubricas, tipo de arquivo e outros", "OUTRO", false],
  ["TRAT_COMPLIANCE", "TRATAMENTO", "3", "Compliance: verificar se os relatórios estão ok", "OUTRO", false],
  ["ORC_FECHAMENTO", "AGENDAMENTO_ORCAMENTARIO", "1", "Agendar fechamento dos arquivos orçamentários", null, false],
  ["ORC_CONTABILIZACAO", "AGENDAMENTO_ORCAMENTARIO", "2", "Contabilização dos arquivos orçamentários", null, false],
  ["ORC_PENDENTES", "AGENDAMENTO_ORCAMENTARIO", "3", "Resolver arquivos pendentes de contabilização (NP, NE e NL)", "DOCUMENTO_PENDENTE", false],
  ["ORC_PROVISORIOS", "AGENDAMENTO_ORCAMENTARIO", "3.1", "Contabilizar os documentos provisórios", "EMPENHO_PROVISORIO", false],
  ["ORC_SC", "AGENDAMENTO_ORCAMENTARIO", "3.2", "Fazer SC para os casos sem orçamento", "SC", true],
  ["COL_FECHAMENTO", "AGENDAMENTO_COLABORADOR", "1", "Agendar fechamento", null, false],
  ["COL_PDS", "AGENDAMENTO_COLABORADOR", "2", "Verificar e contabilizar PDs provisórias", "PD_PROVISORIA", false],
  ["COL_CONTABILIZACAO", "AGENDAMENTO_COLABORADOR", "3", "Rodar a contabilização", null, true],
  ["CRED_FECHAMENTO", "AGENDAMENTO_CREDITO", "1", "Agendar fechamento", null, false],
  ["CRED_CONTABILIZACAO", "AGENDAMENTO_CREDITO", "2", "Agendar contabilização", null, true],
  ["CRED_PDS", "AGENDAMENTO_CREDITO", "3", "Verificar PDs pendentes", "PD_PENDENTE", false],
];
const ETAPA = Object.fromEntries(ETAPAS.map(([id, fase, numero, titulo, tipoItem, opcional], i) =>
  [id, { fase, numero, titulo, tipoItem, opcional, ordinal: i }]));

const MARCOS = {
  SEAD: "Transmissão da SEAD",
  TRATAMENTO: "Processamento estimado (1º dia GEPAG)",
  OUTRAS: "Limite GEPAG",
};

// ---------- Erros e relógio ----------

class ErroDeRegra extends Error {}

const p2 = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
const data = (s) => {
  const [dia, hora = "00:00:00"] = s.split("T");
  const [a, m, d] = dia.split("-").map(Number);
  const [h, mi, se = 0] = hora.split(":").map(Number);
  return new Date(a, m - 1, d, h, mi, se);
};
const minutosEntre = (de, ate) => Math.max(0, Math.trunc((data(ate) - data(de)) / 60000));
const diferenca = (de, ate) => Math.trunc((data(ate) - data(de)) / 60000);

/** Durante a montagem dos dados de exemplo, o "agora" é fixado em cada passo. */
let agoraFixo = null;
const agora = () => agoraFixo ?? iso(new Date());
const referencia = (c) => c.encerradoEm ?? agora();

function momento(informado) {
  const ag = agora();
  if (!informado) return ag;
  const valor = informado.length === 16 ? `${informado}:00` : informado.slice(0, 19);
  if (data(valor) > new Date(data(ag).getTime() + 60000)) throw new ErroDeRegra("O horário informado está no futuro.");
  return valor;
}

const vazio = (s) => s == null || String(s).trim() === "";
const normalizar = (s) => (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

// ---------- Cronograma ----------

let cronograma = null;

async function carregarCronograma() {
  if (!cronograma) {
    const resposta = await fetch(new URL("./cronograma-2026.json", import.meta.url));
    cronograma = await resposta.json();
  }
  return cronograma;
}

function folha(competencia) {
  if (!cronograma || !/^\d{4}-\d{2}$/.test(competencia ?? "") || Number(competencia.slice(0, 4)) !== cronograma.ano) return null;
  return cronograma.folha.find((f) => f.competencia === competencia) ?? null;
}

const diaSeguinte = (dia) => {
  const d = data(`${dia}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return iso(d);
};

function prazoCronograma(t, ciclo) {
  const f = folha(ciclo.competencia);
  if (!f) return null;
  if (t.fase === "SEAD") return f.transmissao;
  if (t.fase === "TRATAMENTO") return diaSeguinte(f.processamento);
  return diaSeguinte(f.limiteGepag);
}

const marco = (fase) => (fase === "SEAD" ? MARCOS.SEAD : fase === "TRATAMENTO" ? MARCOS.TRATAMENTO : MARCOS.OUTRAS);

// ---------- Banco no navegador ----------

let db = null;

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(db));
  } catch {
    // sem armazenamento (janela anônima bloqueada): a demonstração funciona até recarregar a página
  }
}

function carregar() {
  try {
    db = JSON.parse(localStorage.getItem(CHAVE) ?? "null");
  } catch {
    db = null;
  }
  if (!db) {
    db = { seq: 0, usuarios: [], ciclos: [] };
    montarExemplo();
    salvar();
  }
}

const novoId = () => ++db.seq;
const usuario = (id) => db.usuarios.find((u) => u.id === id) ?? null;
const externo = (u) => u.unidade !== "GEPAG";

function buscarUsuario(id) {
  const u = usuario(Number(id));
  if (!u) throw Object.assign(new ErroDeRegra("Usuário não encontrado."), { status: 404 });
  return u;
}

function buscarCiclo(id) {
  const c = db.ciclos.find((x) => x.id === Number(id));
  if (!c) throw Object.assign(new ErroDeRegra("Ciclo não encontrado."), { status: 404 });
  return c;
}

function buscarTarefa(id) {
  for (const c of db.ciclos) {
    const t = c.tarefas.find((x) => x.id === Number(id));
    if (t) return { t, c };
  }
  throw Object.assign(new ErroDeRegra("Demanda não encontrada."), { status: 404 });
}

function editavel(id) {
  const r = buscarTarefa(id);
  if (r.c.encerradoEm) throw new ErroDeRegra("O ciclo desta demanda está encerrado. Reabra-o em Ciclos para alterar.");
  return r;
}

function buscarItem(id) {
  for (const c of db.ciclos) {
    for (const t of c.tarefas) {
      const i = t.itens.find((x) => x.id === Number(id));
      if (i) {
        editavel(t.id);
        return { i, t };
      }
    }
  }
  throw Object.assign(new ErroDeRegra("Item não encontrado."), { status: 404 });
}

const ordenarTarefas = (c) => c.tarefas.sort((a, b) => a.ordem - b.ordem || a.id - b.id);
const ciclosOrdenados = () => [...db.ciclos].sort((a, b) => (a.abertoEm < b.abertoEm ? 1 : a.abertoEm > b.abertoEm ? -1 : b.id - a.id));

// ---------- Regras da demanda (Tarefa.java) ----------

function novaTarefa(ciclo, { etapa = null, fase, titulo, unidade, ordem, numero = null, opcional = false }, quando) {
  return {
    id: novoId(), cicloId: ciclo.id, etapa, fase, numero, ordem, titulo, unidade, opcional,
    responsavelId: null, status: "PENDENTE", statusDesde: quando, criadaEm: quando, iniciadaEm: null, concluidaEm: null,
    prazoHoras: null, observacao: null, intervalos: [], itens: [], observacoes: [],
  };
}

const periodoAberto = (t) => (t.intervalos.length && !t.intervalos.at(-1).fim ? t.intervalos.at(-1) : null);

function validarMomento(t, quando) {
  const limite = t.intervalos.length ? t.intervalos.at(-1).inicio : t.criadaEm;
  if (quando < limite) throw new ErroDeRegra("O horário informado é anterior ao último registro da demanda.");
}

function mudarStatus(t, novo, quando, nota) {
  if (novo === t.status) throw new ErroDeRegra(`A demanda já está em "${STATUS[novo].rotulo}".`);
  if (novo === "PENDENTE" && t.iniciadaEm) {
    throw new ErroDeRegra('Depois de iniciada, a demanda não volta para Pendente. Use "Em andamento" ou um dos status "Aguardando".');
  }
  if (!t.iniciadaEm && novo !== "EM_ANDAMENTO" && novo !== "PENDENTE" && !semExecucao(novo)) {
    throw new ErroDeRegra('Marque "Em andamento" primeiro: o tempo da demanda começa a contar a partir dele.');
  }
  validarMomento(t, quando);
  const aberto = periodoAberto(t);
  if (aberto) aberto.fim = quando;
  if (!t.iniciadaEm && novo === "EM_ANDAMENTO") t.iniciadaEm = quando;
  t.concluidaEm = encerrado(novo) ? quando : null;
  t.status = novo;
  t.statusDesde = quando;
  if (novo !== "PENDENTE") {
    t.intervalos.push({ id: novoId(), status: novo, responsavelId: t.responsavelId, inicio: quando, fim: encerrado(novo) ? quando : null, nota });
  }
}

function atribuir(t, novoId_, quando) {
  if ((t.responsavelId ?? null) === (novoId_ ?? null)) return;
  const aberto = periodoAberto(t);
  if (aberto) {
    validarMomento(t, quando);
    aberto.fim = quando;
    const nota = novoId_ == null ? "Responsável removido" : `Responsável: ${usuario(novoId_).nome}`;
    t.intervalos.push({ id: novoId(), status: t.status, responsavelId: novoId_, inicio: quando, fim: null, nota });
  }
  t.responsavelId = novoId_;
}

function alterarObservacao(t, texto, autorId, quando) {
  const novo = vazio(texto) ? null : texto.trim();
  if (novo === (t.observacao ?? null)) return;
  t.observacao = novo;
  t.observacoes.push({ id: novoId(), texto: novo, autorId, em: quando });
}

const minutosIntervalo = (p, ag) => minutosEntre(p.inicio, p.fim ?? ag);

function unidadeDoTempo(p, t) {
  if (aguardandoTerceiro(p.status)) return STATUS[p.status].aguardando;
  const u = usuario(p.responsavelId);
  return u ? u.unidade : t.unidade;
}

const minutosTotais = (t, ag) => (t.iniciadaEm ? minutosEntre(t.iniciadaEm, t.concluidaEm ?? ag) : 0);
const minutosNoStatusAtual = (t, ag) => (encerrado(t.status) ? 0 : minutosEntre(t.statusDesde, ag));

function minutosPorStatus(t, ag) {
  const soma = {};
  for (const s of Object.keys(STATUS)) {
    for (const p of t.intervalos) if (p.status === s) soma[s] = (soma[s] ?? 0) + minutosIntervalo(p, ag);
  }
  return soma;
}

function limitePrazo(t) {
  if (t.prazoHoras == null || !t.iniciadaEm) return null;
  return iso(new Date(data(t.iniciadaEm).getTime() + Math.round(t.prazoHoras * 60) * 60000));
}

function foraDoPrazo(t, ag) {
  const limite = limitePrazo(t);
  if (!limite || semExecucao(t.status)) return false;
  return (t.concluidaEm ?? ag) > limite;
}

function atrasoCronograma(t, c, ag) {
  const prazo = prazoCronograma(t, c);
  if (!prazo || semExecucao(t.status)) return null;
  const minutos = diferenca(prazo, t.status === "CONCLUIDA" ? t.concluidaEm : ag);
  return minutos > 0 ? minutos : null;
}

// ---------- Visões (Visoes.java) ----------

function usuarioView(u) {
  return u ? { id: u.id, nome: u.nome, unidade: u.unidade, codigoUg: u.codigoUg ?? null, externo: externo(u), ativo: u.ativo } : null;
}

function tarefaView(t, c, ag) {
  const ultima = t.observacoes.at(-1);
  return {
    id: t.id, cicloId: c.id, etapa: t.etapa, fase: t.fase, numero: t.numero, titulo: t.titulo, unidade: t.unidade,
    opcional: t.opcional, avulsa: t.etapa == null, responsavel: usuarioView(usuario(t.responsavelId)), status: t.status,
    statusDesde: t.statusDesde, iniciadaEm: t.iniciadaEm, concluidaEm: t.concluidaEm, prazoHoras: t.prazoHoras,
    limitePrazo: limitePrazo(t), foraDoPrazo: foraDoPrazo(t, ag), minutosTotais: minutosTotais(t, ag),
    minutosNoStatusAtual: minutosNoStatusAtual(t, ag), minutosPorStatus: minutosPorStatus(t, ag),
    tipoItem: t.etapa ? ETAPA[t.etapa].tipoItem : null, itensAbertos: t.itens.filter((i) => !i.resolvidoEm).length,
    itensTotal: t.itens.length, observacao: t.observacao, observacaoPor: ultima ? usuario(ultima.autorId)?.nome ?? null : null,
    observacaoEm: ultima ? ultima.em : null, prazoCronograma: prazoCronograma(t, c), marcoCronograma: marco(t.fase),
    minutosAtrasoCronograma: atrasoCronograma(t, c, ag),
  };
}

const itemView = (i) => ({ id: i.id, tipo: i.tipo, identificador: i.identificador, descricao: i.descricao,
  criadoEm: i.criadoEm, resolvidoEm: i.resolvidoEm, resolvido: i.resolvidoEm != null });

function tarefaDetalhe(t, c) {
  const ag = referencia(c);
  return {
    tarefa: tarefaView(t, c, ag),
    historico: t.intervalos.map((p) => ({ id: p.id, status: p.status, responsavel: usuarioView(usuario(p.responsavelId)),
      unidadeDoTempo: unidadeDoTempo(p, t), inicio: p.inicio, fim: p.fim, minutos: minutosIntervalo(p, ag), nota: p.nota })),
    itens: t.itens.map(itemView),
    observacoes: t.observacoes.map((o) => ({ id: o.id, texto: o.texto, autor: usuario(o.autorId)?.nome ?? "", em: o.em })),
  };
}

function cicloView(c, ag = referencia(c)) {
  const ts = c.tarefas;
  return {
    id: c.id, nome: c.nome, competencia: c.competencia, abertoEm: c.abertoEm, encerradoEm: c.encerradoEm,
    encerrado: c.encerradoEm != null, minutosDecorridos: minutosEntre(c.abertoEm, ag), totalTarefas: ts.length,
    encerradas: ts.filter((t) => encerrado(t.status)).length,
    emAndamento: ts.filter((t) => t.status === "EM_ANDAMENTO").length,
    aguardandoTerceiros: ts.filter((t) => aguardandoTerceiro(t.status)).length,
    foraDoPrazo: ts.filter((t) => !encerrado(t.status) && foraDoPrazo(t, ag)).length,
    temCronograma: folha(c.competencia) != null,
    atrasadasCronograma: ts.filter((t) => !encerrado(t.status) && atrasoCronograma(t, c, ag) != null).length,
  };
}

function cicloDetalhe(c, ag = referencia(c)) {
  ordenarTarefas(c);
  return { ciclo: cicloView(c, ag), tarefas: c.tarefas.map((t) => tarefaView(t, c, ag)) };
}

// ---------- Ciclos (CicloService.java) ----------

function criarCiclo(nome, competencia) {
  if (vazio(nome)) throw new ErroDeRegra('Dê um nome ao ciclo, por exemplo "Folha outubro/2026".');
  const ag = agora();
  const anterior = ciclosOrdenados()[0];
  const anteriores = Object.fromEntries((anterior?.tarefas ?? []).filter((t) => t.etapa).map((t) => [t.etapa, t]));
  const ciclo = { id: novoId(), nome: nome.trim(), competencia: vazio(competencia) ? null : competencia.trim(), abertoEm: ag, encerradoEm: null, tarefas: [] };
  for (const [id, info] of Object.entries(ETAPA)) {
    const t = novaTarefa(ciclo, { etapa: id, fase: info.fase, titulo: info.titulo, unidade: FASES[info.fase].unidade,
      ordem: info.ordinal * 10, numero: info.numero, opcional: info.opcional }, ag);
    const ant = anteriores[id];
    if (ant) {
      t.prazoHoras = ant.prazoHoras;
      const resp = usuario(ant.responsavelId);
      if (resp?.ativo) atribuir(t, resp.id, ag);
    }
    ciclo.tarefas.push(t);
  }
  db.ciclos.push(ciclo);
  return cicloDetalhe(ciclo, ag);
}

function encerrarCiclo(id, forcar) {
  const c = buscarCiclo(id);
  if (c.encerradoEm) throw new ErroDeRegra("O ciclo já está encerrado.");
  const abertas = c.tarefas.filter((t) => !encerrado(t.status)).length;
  if (abertas > 0 && !forcar) {
    throw new ErroDeRegra(abertas === 1
      ? "Ainda há 1 demanda aberta. Conclua, valide, anule ou encerre assim mesmo."
      : `Ainda há ${abertas} demandas abertas. Conclua, valide, anule ou encerre assim mesmo.`);
  }
  c.encerradoEm = agora();
  return cicloView(c, c.encerradoEm);
}

function criarAvulsa(cicloId, { fase, titulo, unidade, responsavelId, prazoHoras }) {
  const c = buscarCiclo(cicloId);
  if (c.encerradoEm) throw new ErroDeRegra("O ciclo está encerrado. Reabra-o para incluir demandas.");
  if (!fase) throw new ErroDeRegra("Escolha a fase da demanda.");
  if (vazio(titulo)) throw new ErroDeRegra("Descreva a demanda.");
  const daFase = c.tarefas.filter((t) => t.fase === fase).map((t) => t.ordem);
  const ordem = (daFase.length ? Math.max(...daFase) : ORDEM_FASES.indexOf(fase) * 1000) + 1;
  const ag = agora();
  const t = novaTarefa(c, { fase, titulo: titulo.trim(), unidade: unidade ?? FASES[fase].unidade, ordem }, ag);
  if (responsavelId != null) atribuir(t, buscarUsuario(responsavelId).id, ag);
  if (prazoHoras != null && prazoHoras > 0) t.prazoHoras = prazoHoras;
  c.tarefas.push(t);
  return tarefaDetalhe(t, c);
}

// ---------- Demandas (TarefaService.java) ----------

function atualizarTarefa(id, { titulo, prazoHoras, limparPrazo, observacao, autorId }) {
  const { t, c } = editavel(id);
  if (!vazio(titulo)) t.titulo = titulo.trim();
  if (limparPrazo) t.prazoHoras = null;
  else if (prazoHoras != null) {
    if (prazoHoras <= 0) throw new ErroDeRegra("O tempo para solução precisa ser maior que zero.");
    t.prazoHoras = Number(prazoHoras);
  }
  if (observacao != null) {
    if (autorId == null) throw new ErroDeRegra("Escolha quem está registrando a observação.");
    const autor = buscarUsuario(autorId);
    if (externo(autor) || !autor.ativo) throw new ErroDeRegra("A observação precisa ser registrada por alguém ativo da GEPAG.");
    alterarObservacao(t, observacao, autor.id, agora());
  }
  return tarefaDetalhe(t, c);
}

function adicionarItens(id, tipo, texto) {
  const { t } = editavel(id);
  const tipoFinal = tipo ?? (t.etapa && ETAPA[t.etapa].tipoItem) ?? "OUTRO";
  const ag = agora();
  const criados = [];
  for (const linhaBruta of (texto ?? "").split(/\r?\n/)) {
    if (vazio(linhaBruta)) continue;
    const linha = linhaBruta.trim();
    const sep = linha.match(/\s*(?:\t|;|\s-\s)\s*/);
    const item = {
      id: novoId(), tipo: tipoFinal,
      identificador: sep ? linha.slice(0, sep.index) : null,
      descricao: sep ? linha.slice(sep.index + sep[0].length) : linha,
      criadoEm: ag, resolvidoEm: null,
    };
    t.itens.push(item);
    criados.push(itemView(item));
  }
  if (!criados.length) throw new ErroDeRegra("Escreva pelo menos um item (um por linha).");
  return criados;
}

// ---------- Usuários (UsuarioService.java) ----------

function listarUsuarios() {
  return [...db.usuarios]
    .sort((a, b) => externo(a) - externo(b) || normalizar(a.nome).localeCompare(normalizar(b.nome)))
    .map(usuarioView);
}

function validarUnidade(unidade) {
  if (!COM_USUARIOS.includes(unidade)) throw new ErroDeRegra("Escolha a unidade: GEPAG, SEAD, SEPLAN ou outra UG.");
  return unidade;
}

function validarNome(nome, idAtual) {
  if (vazio(nome)) throw new ErroDeRegra("Informe o nome.");
  const limpo = nome.trim();
  if (db.usuarios.some((u) => u.id !== idAtual && normalizar(u.nome) === normalizar(limpo))) {
    throw new ErroDeRegra(`Já existe um usuário chamado "${limpo}".`);
  }
  return limpo;
}

function validarCodigo(codigo, dono) {
  const limpo = codigo.trim();
  if (!limpo) return null;
  if (!UNIDADES[dono.unidade].ug) throw new ErroDeRegra("Só UGs têm código (SEAD, SEPLAN ou outra UG).");
  if (!/^\d{6}$/.test(limpo)) throw new ErroDeRegra("O código da UG tem 6 dígitos, por exemplo 140102.");
  if (db.usuarios.some((u) => u.id !== dono.id && u.codigoUg === limpo)) throw new ErroDeRegra(`Já existe uma UG com o código ${limpo}.`);
  return limpo;
}

function criarUsuario(nome, unidade, codigoUg = null) {
  const u = { id: novoId(), nome: validarNome(nome, null), unidade: validarUnidade(unidade), codigoUg, ativo: true };
  db.usuarios.push(u);
  return u;
}

function criarVarios(texto, unidade) {
  validarUnidade(unidade);
  const nomes = db.usuarios.map((u) => normalizar(u.nome));
  const codigos = db.usuarios.map((u) => u.codigoUg).filter(Boolean);
  const criados = [];
  for (const linha of (texto ?? "").split(/\r?\n/)) {
    let nome = linha.trim();
    let codigo = null;
    const m = nome.match(/^(\d{6})\s*(?:-|–|;|\t)\s*(.+)$/);
    if (UNIDADES[unidade].ug && m) {
      codigo = m[1];
      nome = m[2].trim();
    }
    if (!nome || nomes.includes(normalizar(nome)) || (codigo && codigos.includes(codigo))) continue;
    nomes.push(normalizar(nome));
    if (codigo) codigos.push(codigo);
    const u = { id: novoId(), nome, unidade, codigoUg: codigo, ativo: true };
    db.usuarios.push(u);
    criados.push(usuarioView(u));
  }
  return criados;
}

function atualizarUsuario(id, { nome, unidade, codigoUg, ativo }) {
  const u = buscarUsuario(id);
  if (nome != null) u.nome = validarNome(nome, u.id);
  if (unidade != null) u.unidade = validarUnidade(unidade);
  if (codigoUg != null) u.codigoUg = validarCodigo(codigoUg, u);
  if (ativo != null) u.ativo = ativo;
  return usuarioView(u);
}

// ---------- Relatório (RelatorioService.java) ----------

function relatorio(c) {
  const ag = referencia(c);
  ordenarTarefas(c);

  const porPessoa = new Map();
  for (const t of c.tarefas) {
    for (const p of t.intervalos) {
      const u = usuario(p.responsavelId);
      if (!u) continue;
      const r = porPessoa.get(u.id) ?? { u, andamento: 0, aguardando: 0, demandas: new Set() };
      if (p.status === "EM_ANDAMENTO") r.andamento += minutosIntervalo(p, ag);
      else if (aguardandoTerceiro(p.status)) r.aguardando += minutosIntervalo(p, ag);
      r.demandas.add(t.id);
      porPessoa.set(u.id, r);
    }
  }
  const porUsuario = [...porPessoa.values()].map(({ u, andamento, aguardando, demandas }) => ({
    usuarioId: u.id, nome: u.nome, unidade: u.unidade, externo: externo(u), minutosAndamento: andamento,
    minutosAguardando: aguardando, demandas: demandas.size,
    concluidas: c.tarefas.filter((t) => t.status === "CONCLUIDA" && t.responsavelId === u.id).length,
  })).sort((a, b) => a.externo - b.externo || b.minutosAndamento - a.minutosAndamento);

  const somaUnidade = {};
  for (const t of c.tarefas) {
    for (const p of t.intervalos) {
      if (p.status === "PENDENTE" || encerrado(p.status)) continue;
      const s = (somaUnidade[unidadeDoTempo(p, t)] ??= [0, 0]);
      s[aguardandoTerceiro(p.status) ? 1 : 0] += minutosIntervalo(p, ag);
    }
  }
  const porUnidade = Object.entries(somaUnidade)
    .map(([unidade, [andamento, espera]]) => ({ unidade, minutos: andamento + espera, minutosAndamento: andamento, minutosEspera: espera }))
    .sort((a, b) => b.minutos - a.minutos);

  const porFase = [];
  for (const fase of ORDEM_FASES) {
    const ts = c.tarefas.filter((t) => t.fase === fase);
    if (!ts.length) continue;
    const inicios = ts.map((t) => t.iniciadaEm).filter(Boolean).sort();
    const todas = ts.every((t) => encerrado(t.status));
    const fim = todas ? ts.map((t) => t.concluidaEm).filter(Boolean).sort().at(-1) ?? null : null;
    const inicio = inicios[0] ?? null;
    porFase.push({ fase, inicio, fim, minutos: inicio ? minutosEntre(inicio, fim ?? ag) : 0, demandas: ts.length,
      encerradas: ts.filter((t) => encerrado(t.status)).length, foraDoPrazo: ts.filter((t) => foraDoPrazo(t, ag)).length });
  }

  return { ciclo: cicloView(c, ag), porUsuario, porUnidade, porFase, porDemanda: c.tarefas.map((t) => tarefaView(t, c, ag)) };
}

// ---------- Rotas ----------

const opcoes = () => ({
  status: Object.entries(STATUS).map(([valor, s]) => ({ valor, rotulo: s.rotulo, aguardando: s.aguardando, encerrado: encerrado(valor) })),
  fases: Object.entries(FASES).map(([valor, f]) => ({ valor, rotulo: f.rotulo, descricao: f.descricao, unidade: f.unidade })),
  unidades: Object.entries(UNIDADES).map(([valor, u]) => ({ valor, rotulo: u.rotulo })),
  unidadesDeUsuario: COM_USUARIOS.map((valor) => ({ valor, rotulo: UNIDADES[valor].rotulo })),
  unidadesUg: Object.keys(UNIDADES).filter((u) => UNIDADES[u].ug),
  tiposItem: Object.entries(TIPOS_ITEM).map(([valor, rotulo]) => ({ valor, rotulo })),
});

const PLANILHA = {
  caminho: "Demonstração: a planilha só é gerada no sistema instalado.",
  ultimaGravacao: null, erro: null, sheetsLigado: false, sheetsConfigurado: false, ultimoEnvioSheets: null, erroSheets: null,
};

const ROTAS = [
  ["GET", /^\/opcoes$/, () => opcoes()],
  ["GET", /^\/usuarios$/, () => listarUsuarios()],
  ["POST", /^\/usuarios$/, (_, b) => usuarioView(criarUsuario(b.nome, b.unidade))],
  ["POST", /^\/usuarios\/lote$/, (_, b) => criarVarios(b.nomes, b.unidade)],
  ["PATCH", /^\/usuarios\/(\d+)$/, ([id], b) => atualizarUsuario(id, b)],
  ["GET", /^\/planilha$/, () => PLANILHA],
  ["POST", /^\/planilha\/gravar$/, () => {
    throw new ErroDeRegra("Na demonstração não há planilha: ela é gerada só no sistema instalado.");
  }],
  ["GET", /^\/cronograma\/anos$/, () => [cronograma.ano]],
  ["GET", /^\/cronograma\/(\d{4})$/, ([ano]) => {
    if (Number(ano) !== cronograma.ano) throw Object.assign(new ErroDeRegra(`Não há cronograma cadastrado para ${ano}.`), { status: 404 });
    return cronograma;
  }],
  ["GET", /^\/ciclos$/, () => ciclosOrdenados().map((c) => cicloView(c))],
  ["GET", /^\/ciclos\/atual$/, () => {
    const c = ciclosOrdenados().find((x) => !x.encerradoEm) ?? ciclosOrdenados()[0];
    return c ? cicloDetalhe(c) : null;
  }],
  ["GET", /^\/ciclos\/(\d+)$/, ([id]) => cicloDetalhe(buscarCiclo(id))],
  ["POST", /^\/ciclos$/, (_, b) => criarCiclo(b.nome, b.competencia)],
  ["PATCH", /^\/ciclos\/(\d+)$/, ([id], b) => {
    const c = buscarCiclo(id);
    if (!vazio(b.nome)) c.nome = b.nome.trim();
    if (b.competencia != null) c.competencia = vazio(b.competencia) ? null : b.competencia.trim();
    return cicloView(c);
  }],
  ["POST", /^\/ciclos\/(\d+)\/encerrar$/, ([id], _, q) => encerrarCiclo(id, q.get("forcar") === "true")],
  ["POST", /^\/ciclos\/(\d+)\/reabrir$/, ([id]) => {
    const c = buscarCiclo(id);
    c.encerradoEm = null;
    return cicloView(c);
  }],
  ["DELETE", /^\/ciclos\/(\d+)$/, ([id]) => {
    const c = buscarCiclo(id);
    db.ciclos = db.ciclos.filter((x) => x !== c);
    return null;
  }],
  ["POST", /^\/ciclos\/(\d+)\/demandas$/, ([id], b) => criarAvulsa(id, b)],
  ["GET", /^\/ciclos\/(\d+)\/relatorio$/, ([id]) => relatorio(buscarCiclo(id))],
  ["GET", /^\/demandas\/(\d+)$/, ([id]) => {
    const { t, c } = buscarTarefa(id);
    return tarefaDetalhe(t, c);
  }],
  ["POST", /^\/demandas\/(\d+)\/status$/, ([id], b) => {
    if (!b.status) throw new ErroDeRegra("Escolha o novo status.");
    const { t, c } = editavel(id);
    mudarStatus(t, b.status, momento(b.quando), vazio(b.nota) ? null : b.nota.trim());
    return tarefaDetalhe(t, c);
  }],
  ["POST", /^\/demandas\/(\d+)\/responsavel$/, ([id], b) => {
    const { t, c } = editavel(id);
    atribuir(t, b.responsavelId == null ? null : buscarUsuario(b.responsavelId).id, momento(b.quando));
    return tarefaDetalhe(t, c);
  }],
  ["PATCH", /^\/demandas\/(\d+)$/, ([id], b) => atualizarTarefa(id, b)],
  ["DELETE", /^\/demandas\/(\d+)$/, ([id]) => {
    const { t, c } = editavel(id);
    if (t.etapa) throw new ErroDeRegra('Etapas do roteiro não podem ser excluídas. Use o status "Validado" ou "Anulado".');
    c.tarefas = c.tarefas.filter((x) => x !== t);
    return null;
  }],
  ["POST", /^\/demandas\/(\d+)\/itens$/, ([id], b) => adicionarItens(id, b.tipo, b.texto)],
  ["PATCH", /^\/itens\/(\d+)$/, ([id], b) => {
    const { i } = buscarItem(id);
    i.resolvidoEm = b.resolvido ? agora() : null;
    return itemView(i);
  }],
  ["DELETE", /^\/itens\/(\d+)$/, ([id]) => {
    const { i, t } = buscarItem(id);
    t.itens = t.itens.filter((x) => x !== i);
    return null;
  }],
];

/** Mesmo contrato do requisitar() de api.js: devolve o JSON ou lança Error com a mensagem pronta. */
export async function requisitar(metodo, caminho, corpo) {
  await carregarCronograma();
  if (!db) carregar();
  const [rota, consulta = ""] = caminho.split("?");
  for (const [m, padrao, acao] of ROTAS) {
    const achou = m === metodo && rota.match(padrao);
    if (!achou) continue;
    try {
      // Cópia profunda: as telas nunca recebem referências ao "banco".
      const resultado = structuredClone(acao(achou.slice(1), corpo ?? {}, new URLSearchParams(consulta)) ?? null);
      if (metodo !== "GET") salvar();
      return resultado;
    } catch (e) {
      if (!(e instanceof ErroDeRegra)) console.error(e);
      // Desfaz alterações parciais: recarrega o último estado salvo.
      db = null;
      carregar();
      throw new Error(e instanceof ErroDeRegra ? e.message : "Erro inesperado na demonstração.");
    }
  }
  throw new Error(`A demonstração não tem a rota ${metodo} ${rota}.`);
}

/** Apaga os dados desta demonstração e volta ao exemplo inicial. */
export function recomecar() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // nada a apagar
  }
  db = null;
}

// ---------- Dados de exemplo ----------

function montarExemplo() {
  const base = new Date();
  base.setMinutes(0, 0, 0);
  const em = (horasAtras) => iso(new Date(base.getTime() - horasAtras * 3600000));
  const no = (horasAtras, acao) => {
    agoraFixo = em(horasAtras);
    try {
      acao();
    } finally {
      agoraFixo = null;
    }
  };

  const sead = criarUsuario("SEAD", "SEAD", null);
  criarUsuario("SEPLAN", "SEPLAN", null);
  criarUsuario("UG", "UG", null);
  criarVarios("140102 - SECRETARIA DE EXEMPLO\n140201 - FUNDO DE EXEMPLO", "UG");
  const [ana, bruno, carla, diego, elisa] = ["Ana Exemplo", "Bruno Exemplo", "Carla Exemplo", "Diego Exemplo", "Elisa Exemplo"]
    .map((n) => criarUsuario(n, "GEPAG"));

  const mes = new Date(base.getFullYear(), base.getMonth(), 1);
  const anterior = new Date(mes.getFullYear(), mes.getMonth() - 1, 1);
  const comp = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
  const nomeMes = (d) => d.toLocaleDateString("pt-BR", { month: "long" });
  const tarefa = (c, etapa) => c.tarefas.find((t) => t.etapa === etapa);
  const pessoas = [sead, sead, sead, sead, ana, bruno, carla, diego, diego, ana, ana, ana, elisa, elisa, elisa, carla, carla, bruno];

  // Ciclo anterior, encerrado: tudo concluído, com uma espera pela SEAD e outra pela Logus.
  no(24 * 30, () => {
    const { ciclo } = criarCiclo(`Folha ${nomeMes(anterior)}/${anterior.getFullYear()}`, comp(anterior));
    const c = buscarCiclo(ciclo.id);
    c.tarefas.forEach((t, i) => atribuir(t, pessoas[i].id, agora()));
  });
  const velho = db.ciclos[0];
  velho.tarefas.forEach((t, i) => {
    const inicio = 24 * 29 - i * 4;
    no(inicio, () => mudarStatus(t, "EM_ANDAMENTO", agora(), null));
    if (i === 5) {
      no(inicio - 1, () => mudarStatus(t, "AGUARDANDO_LOGUS", agora(), "Chamado aberto na Logus"));
      no(inicio - 4, () => mudarStatus(t, "EM_ANDAMENTO", agora(), null));
    }
    if (i === 13) {
      no(inicio - 1, () => mudarStatus(t, "AGUARDANDO_SEAD", agora(), "PDs dependem de ajuste na SEAD"));
      no(inicio - 3, () => mudarStatus(t, "EM_ANDAMENTO", agora(), null));
    }
    no(inicio - 5, () => mudarStatus(t, "CONCLUIDA", agora(), null));
  });
  no(24 * 25, () => {
    velho.encerradoEm = agora();
  });

  // Ciclo atual, em andamento.
  no(96, () => {
    const { ciclo } = criarCiclo(`Folha ${nomeMes(mes)}/${mes.getFullYear()}`, comp(mes));
    const c = buscarCiclo(ciclo.id);
    tarefa(c, "TRAT_MAPEAMENTOS").prazoHoras = 8;
    tarefa(c, "TRAT_RUBRICAS").prazoHoras = 6;
  });
  const c = db.ciclos[1];
  const passo = (etapa, horas, status, nota = null) => no(horas, () => mudarStatus(tarefa(c, etapa), status, agora(), nota));

  passo("SEAD_TRANSMISSAO", 95, "EM_ANDAMENTO");
  passo("SEAD_TRANSMISSAO", 90, "CONCLUIDA", "Arquivos recebidos");
  passo("SEAD_CADASTROS", 90, "EM_ANDAMENTO");
  passo("SEAD_RELATORIOS", 90, "EM_ANDAMENTO");
  passo("SEAD_RELATORIOS", 72, "CONCLUIDA");
  passo("SEAD_CADASTROS", 70, "CONCLUIDA");
  passo("SEAD_INCONSISTENCIAS", 70, "EM_ANDAMENTO");
  no(69, () => adicionarItens(tarefa(c, "SEAD_INCONSISTENCIAS").id, null,
    "0012 - Servidor sem lotação\n0045 - Rubrica sem natureza\n0078 - CPF divergente"));
  no(60, () => tarefa(c, "SEAD_INCONSISTENCIAS").itens.forEach((i) => { i.resolvidoEm = agora(); }));
  passo("SEAD_INCONSISTENCIAS", 52, "CONCLUIDA", "Inconsistências zeradas");

  passo("TRAT_MAPEAMENTOS", 48, "EM_ANDAMENTO");
  no(47, () => adicionarItens(tarefa(c, "TRAT_MAPEAMENTOS").id, null, "1.1.01 - Rubrica nova sem mapeamento\n3.2.10 - Natureza alterada"));
  passo("TRAT_MAPEAMENTOS", 44, "AGUARDANDO_SEPLAN", "Dotação a confirmar com a SEPLAN");
  passo("TRAT_MAPEAMENTOS", 30, "EM_ANDAMENTO");
  passo("TRAT_MAPEAMENTOS", 27, "CONCLUIDA");
  passo("TRAT_RUBRICAS", 46, "EM_ANDAMENTO");
  passo("TRAT_RUBRICAS", 43, "AGUARDANDO_LOGUS", "Chamado 4821 aberto na Logus");
  no(42, () => alterarObservacao(tarefa(c, "TRAT_RUBRICAS"), "Arquivo com tipo errado. Aguardando retorno do chamado na Logus.", bruno.id, agora()));
  passo("TRAT_COMPLIANCE", 20, "EM_ANDAMENTO");
  passo("ORC_SC", 10, "VALIDADO", "Não houve caso sem orçamento");
  passo("COL_PDS", 8, "EM_ANDAMENTO");
  no(7, () => adicionarItens(tarefa(c, "COL_PDS").id, null, "PD 2026PD000311 - Valor divergente\nPD 2026PD000327 - Sem empenho"));
  passo("COL_PDS", 5, "AGUARDANDO_SEAD", "Valores a confirmar com a SEAD");
  no(4, () => alterarObservacao(tarefa(c, "COL_PDS"), "Duas PDs provisórias com valor diferente do relatório.", elisa.id, agora()));
}
