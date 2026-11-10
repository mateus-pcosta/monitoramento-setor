package br.com.gepag;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

/** Relógio que só anda quando o teste manda. */
public class RelogioDeTeste extends Clock {

    private static final ZoneId ZONA = ZoneId.of("America/Rio_Branco");

    private Instant agora;

    public RelogioDeTeste(LocalDateTime inicio) {
        this.agora = inicio.atZone(ZONA).toInstant();
    }

    public void avancar(Duration duracao) {
        agora = agora.plus(duracao);
    }

    public LocalDateTime agora() {
        return LocalDateTime.ofInstant(agora, ZONA);
    }

    @Override
    public ZoneId getZone() {
        return ZONA;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return this;
    }

    @Override
    public Instant instant() {
        return agora;
    }

    @TestConfiguration
    public static class Config {

        @Bean
        @Primary
        public RelogioDeTeste relogioDeTeste() {
            return new RelogioDeTeste(LocalDateTime.of(2026, 10, 1, 8, 0));
        }
    }
}
