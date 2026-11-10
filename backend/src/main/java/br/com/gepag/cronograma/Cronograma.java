package br.com.gepag.cronograma;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Cronograma de um exercício (arquivo resources/cronograma/cronograma-AAAA.json): datas oficiais da
 * Portaria (SIAPE-FOLHA e SIAPE-PPF), a janela interna da GEPAG e os dias sem expediente.
 */
public record Cronograma(int ano, String fonte, List<Feriado> feriados, List<Folha> folha, List<Ppf> ppf,
                         List<Evento> eventos, List<Alerta> alertas) {

    /** tipo: FERIADO, PONTO_FACULTATIVO ou FERIADO_MUNICIPAL. */
    public record Feriado(LocalDate data, String nome, String tipo) {
    }

    /** Uma competência do SIAPE-FOLHA: do marco (transmissão da SEAD) até a execução da Faixa 1. */
    public record Folha(String competencia, LocalDateTime transmissao, int diasUteisAteFaixa1, LocalDate processamento,
                        LocalDate limiteGepag, int diasUteisGepag, int margem, LocalDate faixa1, String situacao) {
    }

    /** Uma competência do SIAPE-PPF. Campos nulos quando a Portaria não publicou a data. */
    public record Ppf(String competencia, LocalDate integracao, Integer diasUteisAteExecucao, LocalDate processamento,
                      LocalDate limiteGepag, Integer diasUteisGepag, Integer margem, LocalDate execucao,
                      LocalDate pagamento, String nota) {
    }

    /** Linha dos Anexos I (FOLHA) e II (PPF). hora no formato "11:00" ou nula. */
    public record Evento(LocalDate data, String hora, String subsistema, String competencia, String tipo, String texto) {
    }

    /** Validações prévias de calendário; competência nula = vale para o ano todo. */
    public record Alerta(String subsistema, String competencia, String texto) {
    }

    public Optional<Folha> folha(String competencia) {
        return folha.stream().filter(f -> f.competencia().equals(competencia)).findFirst();
    }
}
