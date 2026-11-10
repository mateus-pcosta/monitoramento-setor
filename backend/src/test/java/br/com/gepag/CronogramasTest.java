package br.com.gepag;

import br.com.gepag.cronograma.Cronograma;
import br.com.gepag.cronograma.Cronogramas;
import br.com.gepag.domain.Fase;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/** Conferência do cronograma 2026 transcrito do PDF e dos prazos por fase. */
class CronogramasTest {

    @Test
    void cronograma2026Completo() {
        Cronograma c = Cronogramas.ano(2026).orElseThrow();
        assertThat(c.folha()).hasSize(12);
        assertThat(c.ppf()).hasSize(12);
        assertThat(c.feriados()).hasSize(22)
                .anySatisfy(f -> assertThat(f.data()).isEqualTo(LocalDate.of(2026, 10, 19)));
        assertThat(c.eventos()).filteredOn(e -> e.tipo().equals("TRANSMISSAO_SEAD")).hasSize(12);
        assertThat(c.eventos()).filteredOn(e -> e.tipo().equals("EXECUCAO_FAIXA_1")).hasSize(12);
        assertThat(c.alertas()).hasSize(10);
        // A transmissão do Anexo I bate com a matriz anual
        c.folha().forEach(f -> assertThat(c.eventos()).anySatisfy(e -> {
            assertThat(e.tipo()).isEqualTo("TRANSMISSAO_SEAD");
            assertThat(e.data()).isEqualTo(f.transmissao().toLocalDate());
        }));
    }

    @Test
    void prazoEscalonadoPorFase() {
        assertThat(Cronogramas.prazo("2026-11", Fase.SEAD)).contains(LocalDateTime.of(2026, 11, 16, 11, 0));
        assertThat(Cronogramas.prazo("2026-11", Fase.TRATAMENTO)).contains(LocalDateTime.of(2026, 11, 18, 0, 0));
        assertThat(Cronogramas.prazo("2026-11", Fase.AGENDAMENTO_ORCAMENTARIO)).contains(LocalDateTime.of(2026, 11, 20, 0, 0));
        assertThat(Cronogramas.prazo("2026-11", Fase.AGENDAMENTO_CREDITO)).contains(LocalDateTime.of(2026, 11, 20, 0, 0));
        assertThat(Cronogramas.prazo("2027-01", Fase.SEAD)).isEmpty();
        assertThat(Cronogramas.prazo(null, Fase.SEAD)).isEmpty();
        assertThat(Cronogramas.prazo("outubro", Fase.SEAD)).isEmpty();
    }
}
