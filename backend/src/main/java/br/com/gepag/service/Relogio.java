package br.com.gepag.service;

import br.com.gepag.domain.Ciclo;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Component
public class Relogio {

    private final Clock clock;

    public Relogio(Clock clock) {
        this.clock = clock;
    }

    public LocalDateTime agora() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.SECONDS);
    }

    /** Ciclo encerrado para de contar tempo na data do encerramento, mesmo com demandas abertas. */
    public LocalDateTime referencia(Ciclo ciclo) {
        return ciclo.isEncerrado() ? ciclo.getEncerradoEm() : agora();
    }

    /** Horário informado pelo usuário para um registro retroativo; nulo = agora. */
    public LocalDateTime momento(LocalDateTime informado) {
        LocalDateTime agora = agora();
        if (informado == null) {
            return agora;
        }
        if (informado.isAfter(agora.plusMinutes(1))) {
            throw new RegraNegocioException("O horário informado está no futuro.");
        }
        return informado.truncatedTo(ChronoUnit.SECONDS);
    }
}
