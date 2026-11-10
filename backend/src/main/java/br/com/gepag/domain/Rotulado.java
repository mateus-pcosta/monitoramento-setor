package br.com.gepag.domain;

import br.com.gepag.util.Texto;

import java.util.Arrays;
import java.util.Optional;

/** Enum com rótulo exibido ao usuário e aliases aceitos na planilha. */
public interface Rotulado {

    String rotulo();

    /** Texto gravado na planilha (pode diferir do rótulo da interface). Nulo = célula vazia. */
    default String rotuloPlanilha() {
        return rotulo();
    }

    default String[] aliases() {
        return new String[0];
    }

    static <E extends Enum<E> & Rotulado> Optional<E> deTexto(Class<E> tipo, String texto) {
        String alvo = Texto.normalizar(texto);
        if (alvo.isEmpty()) {
            return Optional.empty();
        }
        for (E valor : tipo.getEnumConstants()) {
            if (Texto.normalizar(valor.rotulo()).equals(alvo) || Texto.normalizar(valor.name()).equals(alvo)
                    || (valor.rotuloPlanilha() != null && Texto.normalizar(valor.rotuloPlanilha()).equals(alvo))) {
                return Optional.of(valor);
            }
            boolean alias = Arrays.stream(valor.aliases()).map(Texto::normalizar).anyMatch(alvo::equals);
            if (alias) {
                return Optional.of(valor);
            }
        }
        return Optional.empty();
    }
}
