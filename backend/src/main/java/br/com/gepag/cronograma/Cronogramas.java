package br.com.gepag.cronograma;

import br.com.gepag.cronograma.Cronograma.Folha;
import br.com.gepag.domain.Fase;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.SortedSet;
import java.util.TreeMap;
import java.util.TreeSet;

/**
 * Cronogramas cadastrados, lidos uma vez de resources/cronograma/cronograma-*.json. Para um novo
 * exercício, basta acrescentar o arquivo do ano.
 */
public final class Cronogramas {

    private static final Map<Integer, Cronograma> ANOS = carregar();

    private Cronogramas() {
    }

    /** Marco do cronograma que serve de prazo para cada fase do ciclo. */
    public enum Marco {
        TRANSMISSAO_SEAD("Transmissão da SEAD"),
        PROCESSAMENTO("Processamento estimado (1º dia GEPAG)"),
        LIMITE_GEPAG("Limite GEPAG");

        private final String rotulo;

        Marco(String rotulo) {
            this.rotulo = rotulo;
        }

        public String rotulo() {
            return rotulo;
        }

        public static Marco daFase(Fase fase) {
            return switch (fase) {
                case SEAD -> TRANSMISSAO_SEAD;
                case TRATAMENTO -> PROCESSAMENTO;
                case AGENDAMENTO_ORCAMENTARIO, AGENDAMENTO_COLABORADOR, AGENDAMENTO_CREDITO -> LIMITE_GEPAG;
            };
        }

        /** Momento a partir do qual a demanda está atrasada. Datas sem hora valem até o fim do dia. */
        LocalDateTime momento(Folha f) {
            return switch (this) {
                case TRANSMISSAO_SEAD -> f.transmissao();
                case PROCESSAMENTO -> f.processamento().plusDays(1).atStartOfDay();
                case LIMITE_GEPAG -> f.limiteGepag().plusDays(1).atStartOfDay();
            };
        }
    }

    public static Optional<Cronograma> ano(int ano) {
        return Optional.ofNullable(ANOS.get(ano));
    }

    public static SortedSet<Integer> anos() {
        return new TreeSet<>(ANOS.keySet());
    }

    /** Competência "2026-11" -> dados do SIAPE-FOLHA, se o ano estiver cadastrado. */
    public static Optional<Folha> folha(String competencia) {
        if (competencia == null || !competencia.matches("\\d{4}-\\d{2}")) {
            return Optional.empty();
        }
        return ano(Integer.parseInt(competencia.substring(0, 4))).flatMap(c -> c.folha(competencia));
    }

    /** Prazo da fase na competência; vazio se o ciclo não tem competência ou o ano não está cadastrado. */
    public static Optional<LocalDateTime> prazo(String competencia, Fase fase) {
        return folha(competencia).map(Marco.daFase(fase)::momento);
    }

    private static Map<Integer, Cronograma> carregar() {
        JsonMapper json = JsonMapper.builder().build();
        Map<Integer, Cronograma> anos = new TreeMap<>();
        try {
            for (Resource r : new PathMatchingResourcePatternResolver().getResources("classpath*:cronograma/cronograma-*.json")) {
                try (InputStream in = r.getInputStream()) {
                    Cronograma c = json.readValue(in, Cronograma.class);
                    anos.put(c.ano(), c);
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Não foi possível ler os cronogramas.", e);
        }
        return Map.copyOf(anos);
    }
}
