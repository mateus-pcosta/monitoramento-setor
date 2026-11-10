package br.com.gepag.planilha;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

/**
 * @param caminho          arquivo .xlsx regravado automaticamente
 * @param atualizarACada   regrava mesmo sem alterações, para os tempos das demandas abertas não ficarem parados
 */
@ConfigurationProperties(prefix = "app.planilha")
public record PlanilhaProperties(
        @DefaultValue("./data/monitoramento-gepag.xlsx") String caminho,
        @DefaultValue("10m") Duration atualizarACada) {
}
