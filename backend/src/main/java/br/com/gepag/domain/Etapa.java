package br.com.gepag.domain;

/**
 * Roteiro fixo do ciclo. Cada ciclo novo cria uma demanda para cada etapa, nesta ordem.
 * Para mudar o roteiro, edite esta lista (os ciclos antigos guardam a cópia do título).
 */
public enum Etapa {
    SEAD_TRANSMISSAO(Fase.SEAD, "1", "Transmissão dos arquivos", null, false),
    SEAD_CADASTROS(Fase.SEAD, "2", "Resolver cadastros", null, false),
    SEAD_RELATORIOS(Fase.SEAD, "3", "Enviar os relatórios", null, false),
    SEAD_INCONSISTENCIAS(Fase.SEAD, "4", "Zerar inconsistências (encerra a etapa SEAD)", TipoItem.INCONSISTENCIA, false),

    TRAT_MAPEAMENTOS(Fase.TRATAMENTO, "1", "Resolver mapeamentos orçamentários", TipoItem.INCONSISTENCIA, false),
    TRAT_RUBRICAS(Fase.TRATAMENTO, "2", "Resolver problemas de rubricas, tipo de arquivo e outros", TipoItem.OUTRO, false),
    TRAT_COMPLIANCE(Fase.TRATAMENTO, "3", "Compliance: verificar se os relatórios estão ok", TipoItem.OUTRO, false),

    ORC_FECHAMENTO(Fase.AGENDAMENTO_ORCAMENTARIO, "1", "Agendar fechamento dos arquivos orçamentários", null, false),
    ORC_CONTABILIZACAO(Fase.AGENDAMENTO_ORCAMENTARIO, "2", "Contabilização dos arquivos orçamentários", null, false),
    ORC_PENDENTES(Fase.AGENDAMENTO_ORCAMENTARIO, "3", "Resolver arquivos pendentes de contabilização (NP, NE e NL)", TipoItem.DOCUMENTO_PENDENTE, false),
    ORC_PROVISORIOS(Fase.AGENDAMENTO_ORCAMENTARIO, "3.1", "Contabilizar os documentos provisórios", TipoItem.EMPENHO_PROVISORIO, false),
    ORC_SC(Fase.AGENDAMENTO_ORCAMENTARIO, "3.2", "Fazer SC para os casos sem orçamento", TipoItem.SC, true),

    COL_FECHAMENTO(Fase.AGENDAMENTO_COLABORADOR, "1", "Agendar fechamento", null, false),
    COL_PDS(Fase.AGENDAMENTO_COLABORADOR, "2", "Verificar e contabilizar PDs provisórias", TipoItem.PD_PROVISORIA, false),
    COL_CONTABILIZACAO(Fase.AGENDAMENTO_COLABORADOR, "3", "Rodar a contabilização", null, true),

    CRED_FECHAMENTO(Fase.AGENDAMENTO_CREDITO, "1", "Agendar fechamento", null, false),
    CRED_CONTABILIZACAO(Fase.AGENDAMENTO_CREDITO, "2", "Agendar contabilização", null, true),
    CRED_PDS(Fase.AGENDAMENTO_CREDITO, "3", "Verificar PDs pendentes", TipoItem.PD_PENDENTE, false);

    private final Fase fase;
    private final String numero;
    private final String titulo;
    private final TipoItem tipoItem;
    private final boolean opcional;

    Etapa(Fase fase, String numero, String titulo, TipoItem tipoItem, boolean opcional) {
        this.fase = fase;
        this.numero = numero;
        this.titulo = titulo;
        this.tipoItem = tipoItem;
        this.opcional = opcional;
    }

    public Fase fase() {
        return fase;
    }

    public String numero() {
        return numero;
    }

    public String titulo() {
        return titulo;
    }

    /** Tipo sugerido para a lista de itens a visualizar; nulo quando a etapa não costuma ter lista. */
    public TipoItem tipoItem() {
        return tipoItem;
    }

    /** Etapa que só acontece "caso necessário": pode ser marcada como Validado. */
    public boolean opcional() {
        return opcional;
    }
}
