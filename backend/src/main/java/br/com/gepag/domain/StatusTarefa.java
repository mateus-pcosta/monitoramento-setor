package br.com.gepag.domain;

/** Na ordem em que aparecem na interface. Toda demanda nasce Pendente. */
public enum StatusTarefa implements Rotulado {
    PENDENTE("Pendente", null),
    EM_ANDAMENTO("Em andamento", null),
    ANULADO("Anulado", null),
    VALIDADO("Validado", null),
    AGUARDANDO_SEAD("Aguardando SEAD", Unidade.SEAD),
    AGUARDANDO_SEPLAN("Aguardando SEPLAN", Unidade.SEPLAN),
    AGUARDANDO_LOGUS("Aguardando Logus", Unidade.LOGUS),
    AGUARDANDO_SEI("Aguardando processo SEI", Unidade.SEI),
    CONCLUIDA("Concluído", null);

    private final String rotulo;
    private final Unidade aguardando;

    StatusTarefa(String rotulo, Unidade aguardando) {
        this.rotulo = rotulo;
        this.aguardando = aguardando;
    }

    @Override
    public String rotulo() {
        return rotulo;
    }

    /** Unidade externa da qual a demanda depende neste status; nulo se não é um status de espera. */
    public Unidade aguardando() {
        return aguardando;
    }

    public boolean aguardandoTerceiro() {
        return aguardando != null;
    }

    /** Concluído, validado ou anulado: o relógio da demanda para. */
    public boolean encerrado() {
        return this == CONCLUIDA || this == VALIDADO || this == ANULADO;
    }

    /**
     * Validado e anulado encerram sem que a demanda precise ser executada: não marcam início
     * nem contam para o tempo para solução.
     */
    public boolean semExecucao() {
        return this == VALIDADO || this == ANULADO;
    }
}
