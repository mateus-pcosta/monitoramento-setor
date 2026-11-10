package br.com.gepag.domain;

/**
 * Quem está com a demanda. O tempo de cada status é somado na unidade correspondente.
 * SEAD e SEPLAN também são unidades gestoras (UG), mas ficam separadas das demais: a SEAD tem contato
 * direto e constante com a SEFAZ (e uma fase inteira do ciclo), e as duas têm status de espera próprios.
 * As demais UGs são cadastradas como usuários da unidade UG, cada uma com seu nome e código.
 */
public enum Unidade implements Rotulado {
    GEPAG("GEPAG", false),
    SEAD("SEAD", true),
    SEPLAN("SEPLAN", true),
    UG("Outra UG", true),
    LOGUS("Logus", false),
    SEI("Processo SEI", false);

    private final String rotulo;
    private final boolean ug;

    Unidade(String rotulo, boolean ug) {
        this.rotulo = rotulo;
        this.ug = ug;
    }

    @Override
    public String rotulo() {
        return rotulo;
    }

    /** Unidade gestora: SEAD, SEPLAN e as demais UGs. */
    public boolean ug() {
        return ug;
    }

    /** Unidades que podem ter usuários cadastrados (Logus e processo SEI só aparecem como "aguardando"). */
    public boolean temUsuarios() {
        return this == GEPAG || this == SEAD || this == UG || this == SEPLAN;
    }
}
