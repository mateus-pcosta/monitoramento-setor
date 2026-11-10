package br.com.gepag.service;

/** Erro causado por dado inválido do usuário; a mensagem é exibida na interface. */
public class RegraNegocioException extends RuntimeException {

    public RegraNegocioException(String mensagem) {
        super(mensagem);
    }

    public RegraNegocioException(String mensagem, Throwable causa) {
        super(mensagem, causa);
    }
}
