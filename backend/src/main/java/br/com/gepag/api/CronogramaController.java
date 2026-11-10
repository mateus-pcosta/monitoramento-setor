package br.com.gepag.api;

import br.com.gepag.cronograma.Cronograma;
import br.com.gepag.cronograma.Cronogramas;
import br.com.gepag.service.NaoEncontradoException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.SortedSet;

/** Datas do cronograma para a tela Calendário. */
@RestController
@RequestMapping("/api/cronograma")
public class CronogramaController {

    @GetMapping("/anos")
    public SortedSet<Integer> anos() {
        return Cronogramas.anos();
    }

    @GetMapping("/{ano}")
    public Cronograma ano(@PathVariable int ano) {
        return Cronogramas.ano(ano).orElseThrow(() -> new NaoEncontradoException("Não há cronograma cadastrado para " + ano + "."));
    }
}
