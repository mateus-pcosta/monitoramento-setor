package br.com.gepag.api;

import br.com.gepag.service.NaoEncontradoException;
import br.com.gepag.service.RegraNegocioException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/** Erros da API sempre em JSON {"mensagem": "..."}, com texto pronto para exibir. */
@RestControllerAdvice(basePackages = "br.com.gepag.api")
public class TratamentoErros {

    private static final Logger log = LoggerFactory.getLogger(TratamentoErros.class);

    @ExceptionHandler(NaoEncontradoException.class)
    public ResponseEntity<Map<String, String>> naoEncontrado(NaoEncontradoException e) {
        return resposta(HttpStatus.NOT_FOUND, e.getMessage());
    }

    @ExceptionHandler(RegraNegocioException.class)
    public ResponseEntity<Map<String, String>> regra(RegraNegocioException e) {
        return resposta(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> validacao(MethodArgumentNotValidException e) {
        var campo = e.getBindingResult().getFieldError();
        String msg = campo == null ? "Dados inválidos." : "Campo \"" + campo.getField() + "\": " + campo.getDefaultMessage();
        return resposta(HttpStatus.BAD_REQUEST, msg);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> corpoInvalido(HttpMessageNotReadableException e) {
        return resposta(HttpStatus.BAD_REQUEST, "Dados em formato inválido. Confira os campos e tente de novo.");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> inesperado(Exception e) {
        log.error("Erro inesperado na API", e);
        return resposta(HttpStatus.INTERNAL_SERVER_ERROR, "Erro inesperado no servidor. Detalhes no terminal onde a aplicação está rodando.");
    }

    private static ResponseEntity<Map<String, String>> resposta(HttpStatus status, String mensagem) {
        return ResponseEntity.status(status).body(Map.of("mensagem", mensagem));
    }
}
