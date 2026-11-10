package br.com.gepag.domain;

/** Itens que a equipe precisa visualizar e resolver dentro de uma etapa. */
public enum TipoItem implements Rotulado {
    INCONSISTENCIA("Inconsistência"),
    SC("SC"),
    EMPENHO_PROVISORIO("Empenho provisório"),
    DOCUMENTO_PENDENTE("Documento pendente (NP, NE, NL)"),
    PD_PROVISORIA("PD provisória"),
    PD_PENDENTE("PD pendente"),
    OUTRO("Outro");

    private final String rotulo;

    TipoItem(String rotulo) {
        this.rotulo = rotulo;
    }

    @Override
    public String rotulo() {
        return rotulo;
    }
}
