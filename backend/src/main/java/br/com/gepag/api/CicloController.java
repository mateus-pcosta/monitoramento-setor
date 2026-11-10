package br.com.gepag.api;

import br.com.gepag.api.dto.Visoes.CicloDetalhe;
import br.com.gepag.api.dto.Visoes.CicloView;
import br.com.gepag.api.dto.Visoes.TarefaDetalhe;
import br.com.gepag.domain.Fase;
import br.com.gepag.domain.Unidade;
import br.com.gepag.service.CicloService;
import br.com.gepag.service.RelatorioService;
import br.com.gepag.service.RelatorioService.Relatorio;
import br.com.gepag.service.TarefaService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/ciclos")
public class CicloController {

    private final CicloService ciclos;
    private final TarefaService tarefas;
    private final RelatorioService relatorios;

    public CicloController(CicloService ciclos, TarefaService tarefas, RelatorioService relatorios) {
        this.ciclos = ciclos;
        this.tarefas = tarefas;
        this.relatorios = relatorios;
    }

    public record NovoCiclo(String nome, String competencia) {
    }

    public record NovaDemanda(Fase fase, String titulo, Unidade unidade, Long responsavelId, Double prazoHoras) {
    }

    @GetMapping
    public List<CicloView> listar() {
        return ciclos.listar();
    }

    /** 204 quando ainda não existe nenhum ciclo. */
    @GetMapping("/atual")
    public ResponseEntity<CicloDetalhe> atual() {
        return ciclos.atual().map(ResponseEntity::ok).orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/{id}")
    public CicloDetalhe detalhar(@PathVariable Long id) {
        return ciclos.detalhar(id);
    }

    @PostMapping
    public CicloDetalhe criar(@RequestBody NovoCiclo novo) {
        return ciclos.criar(novo.nome(), novo.competencia());
    }

    @PatchMapping("/{id}")
    public CicloView renomear(@PathVariable Long id, @RequestBody NovoCiclo dados) {
        return ciclos.renomear(id, dados.nome(), dados.competencia());
    }

    @PostMapping("/{id}/encerrar")
    public CicloView encerrar(@PathVariable Long id, @RequestParam(defaultValue = "false") boolean forcar) {
        return ciclos.encerrar(id, forcar);
    }

    @PostMapping("/{id}/reabrir")
    public CicloView reabrir(@PathVariable Long id) {
        return ciclos.reabrir(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Long id) {
        ciclos.excluir(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/demandas")
    public TarefaDetalhe novaDemanda(@PathVariable Long id, @RequestBody NovaDemanda nova) {
        return tarefas.criarAvulsa(id, nova.fase(), nova.titulo(), nova.unidade(), nova.responsavelId(), nova.prazoHoras());
    }

    @GetMapping("/{id}/relatorio")
    public Relatorio relatorio(@PathVariable Long id) {
        return relatorios.gerar(id);
    }
}
