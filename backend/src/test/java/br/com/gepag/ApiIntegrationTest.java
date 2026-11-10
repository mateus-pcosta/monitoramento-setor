package br.com.gepag;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/** Chamadas HTTP com o JSON que o front-end envia, incluindo campos opcionais ausentes. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:api;DB_CLOSE_DELAY=-1",
        "app.planilha.caminho=target/test-dados/api.xlsx"})
class ApiIntegrationTest {

    @Value("${local.server.port}")
    int porta;

    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void fluxoPelaApi() throws Exception {
        HttpResponse<String> ciclo = enviar("POST", "/api/ciclos", "{\"nome\":\"Ciclo API\",\"competencia\":\"2026-10\"}");
        assertThat(ciclo.statusCode()).isEqualTo(200);
        Matcher m = Pattern.compile("\"tarefas\":\\[\\{\"id\":(\\d+)").matcher(ciclo.body());
        assertThat(m.find()).isTrue();
        String demanda = "/api/demandas/" + m.group(1);

        assertThat(enviar("PATCH", demanda, "{\"prazoHoras\":4}").body()).contains("\"prazoHoras\":4.0");
        assertThat(enviar("PATCH", demanda, "{\"observacao\":\"teste\"}").statusCode()).isEqualTo(400);
        Matcher autor = Pattern.compile("\"id\":(\\d+)").matcher(
                enviar("POST", "/api/usuarios", "{\"nome\":\"Autora\",\"unidade\":\"GEPAG\"}").body());
        assertThat(autor.find()).isTrue();
        assertThat(enviar("PATCH", demanda, "{\"observacao\":\"teste\",\"autorId\":" + autor.group(1) + "}").body())
                .contains("\"observacao\":\"teste\"", "\"observacaoPor\":\"Autora\"", "\"observacoes\":[{");
        assertThat(enviar("PATCH", demanda, "{\"limparPrazo\":true}").body()).contains("\"prazoHoras\":null");
        assertThat(enviar("POST", demanda + "/status", "{\"status\":\"EM_ANDAMENTO\",\"quando\":null,\"nota\":\"\"}").body())
                .contains("\"status\":\"EM_ANDAMENTO\"");
        assertThat(enviar("POST", demanda + "/responsavel", "{\"responsavelId\":1,\"quando\":null}").statusCode()).isEqualTo(200);
        assertThat(enviar("POST", demanda + "/itens", "{\"tipo\":\"SC\",\"texto\":\"SC 1\"}").statusCode()).isEqualTo(200);

        HttpResponse<String> erro = enviar("POST", demanda + "/status", "{\"status\":\"EM_ANDAMENTO\"}");
        assertThat(erro.statusCode()).isEqualTo(400);
        assertThat(erro.body()).contains("mensagem");

        assertThat(enviar("POST", "/api/usuarios/lote", "{\"nomes\":\"Carla\\nDiego\",\"unidade\":\"GEPAG\"}").body())
                .contains("Carla", "Diego");
        String ugs = enviar("POST", "/api/usuarios/lote",
                "{\"nomes\":\"140102 - SECRETARIA EXEMPLO\\n140103;OUTRA UG\\n140102 - REPETIDA\",\"unidade\":\"UG\"}").body();
        assertThat(ugs).contains("\"nome\":\"SECRETARIA EXEMPLO\"", "\"codigoUg\":\"140102\"", "\"codigoUg\":\"140103\"")
                .doesNotContain("REPETIDA");
        Matcher idUg = Pattern.compile("\"id\":(\\d+),\"nome\":\"SECRETARIA EXEMPLO\"").matcher(ugs);
        assertThat(idUg.find()).isTrue();
        assertThat(enviar("PATCH", "/api/usuarios/" + idUg.group(1), "{\"codigoUg\":\"12\"}").statusCode()).isEqualTo(400);
        assertThat(enviar("PATCH", "/api/usuarios/" + idUg.group(1), "{\"codigoUg\":\"140103\"}").body()).contains("Já existe");

        assertThat(enviar("GET", "/api/ciclos/1/relatorio", null).statusCode()).isEqualTo(200);
        assertThat(enviar("GET", "/api/opcoes", null).statusCode()).isEqualTo(200);
        assertThat(enviar("GET", "/api/cronograma/2026", null).body()).contains("\"transmissao\":\"2026-11-16T11:00:00\"", "Dia do Piauí");
        assertThat(enviar("GET", "/api/cronograma/anos", null).body()).contains("2026");
        assertThat(enviar("GET", "/api/cronograma/1999", null).statusCode()).isEqualTo(404);
        assertThat(enviar("GET", demanda, null).body()).contains("\"marcoCronograma\":\"Transmissão da SEAD\"",
                "\"prazoCronograma\":\"2026-10-15T11:00:00\"");
    }

    private HttpResponse<String> enviar(String metodo, String caminho, String json) throws Exception {
        HttpRequest.Builder req = HttpRequest.newBuilder(URI.create("http://localhost:" + porta + caminho))
                .header("Content-Type", "application/json")
                .method(metodo, json == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json));
        return http.send(req.build(), HttpResponse.BodyHandlers.ofString());
    }
}
