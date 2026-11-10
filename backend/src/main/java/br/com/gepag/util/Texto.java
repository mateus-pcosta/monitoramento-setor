package br.com.gepag.util;

import java.text.Normalizer;
import java.util.Locale;

public final class Texto {

    private Texto() {
    }

    /** Minúsculas, sem acentos e com espaços simples: "  % Acerto " vira "% acerto". */
    public static String normalizar(String valor) {
        if (valor == null) {
            return "";
        }
        String semAcento = Normalizer.normalize(valor, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return semAcento.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    public static boolean vazio(String valor) {
        return valor == null || valor.isBlank();
    }
}
