package br.com.gepag.domain;

/** Grandes blocos do ciclo da folha, na ordem em que acontecem. */
public enum Fase implements Rotulado {
    SEAD("Etapa SEAD", "Transmissão, cadastros e relatórios até zerar as inconsistências.", Unidade.SEAD),
    TRATAMENTO("Tratamento SEFAZ", "Mapeamentos orçamentários, rubricas e tipos de arquivo, e compliance dos relatórios.", Unidade.GEPAG),
    AGENDAMENTO_ORCAMENTARIO("Agendamento orçamentário", "Fechamento e contabilização dos arquivos orçamentários e tratamento das pendências.", Unidade.GEPAG),
    AGENDAMENTO_COLABORADOR("Agendamento colaborador", "Fechamento, PDs provisórias e contabilização.", Unidade.GEPAG),
    AGENDAMENTO_CREDITO("Agendamento crédito", "Fechamento, contabilização e PDs pendentes.", Unidade.GEPAG);

    private final String rotulo;
    private final String descricao;
    private final Unidade unidade;

    Fase(String rotulo, String descricao, Unidade unidade) {
        this.rotulo = rotulo;
        this.descricao = descricao;
        this.unidade = unidade;
    }

    @Override
    public String rotulo() {
        return rotulo;
    }

    public String descricao() {
        return descricao;
    }

    /** Unidade que executa as etapas da fase quando não há responsável atribuído. */
    public Unidade unidade() {
        return unidade;
    }
}
