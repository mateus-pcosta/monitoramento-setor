package br.com.gepag;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class AppConfig {

    /** Injetado nos serviços para que "hoje" seja controlável nos testes. */
    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
