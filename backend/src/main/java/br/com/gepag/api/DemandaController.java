package br.com.gepag.api;

import br.com.gepag.api.dto.Visoes.ItemView;
import br.com.gepag.api.dto.Visoes.TarefaDetalhe;
import br.com.gepag.domain.StatusTarefa;
import br.com.gepag.domain.TipoItem;
import br.com.gepag.service.TarefaService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

@RestController
public class DemandaController {

    private final TarefaService tarefas;

    public DemandaController(TarefaService tarefas) {
        this.tarefas = tarefas;
    }

    /** `quando` nulo = agora; preenchido = registro retroativo (ex.: esqueceu de marcar na hora). */
    public record MudancaStatus(StatusTarefa status, LocalDateTime quando, String nota) {
    }

    public record Atribuicao(Long responsavelId, LocalDateTime quando) {
    }

    /**
     * `limparPrazo` remove o tempo para solução; `prazoHoras` nulo mantém o atual.
     * `observacao` nula mantém a atual; para alterá-la, `autorId` é obrigatório.
     */
    public record Atualizacao(String titulo, Double prazoHoras, Boolean limparPrazo, String observacao, Long autorId) {
    }

    public record NovosItens(TipoItem tipo, String texto) {
    }

    public record SituacaoItem(boolean resolvido) {
    }

    @GetMapping("/api/demandas/{id}")
    public TarefaDetalhe detalhar(@PathVariable Long id) {
        return tarefas.detalhar(id);
    }

    @PostMapping("/api/demandas/{id}/status")
    public TarefaDetalhe mudarStatus(@PathVariable Long id, @RequestBody MudancaStatus mudanca) {
        return tarefas.mudarStatus(id, mudanca.status(), mudanca.quando(), mudanca.nota());
    }

    @PostMapping("/api/demandas/{id}/responsavel")
    public TarefaDetalhe atribuir(@PathVariable Long id, @RequestBody Atribuicao atribuicao) {
        return tarefas.atribuir(id, atribuicao.responsavelId(), atribuicao.quando());
    }

    @PatchMapping("/api/demandas/{id}")
    public TarefaDetalhe atualizar(@PathVariable Long id, @RequestBody Atualizacao dados) {
        return tarefas.atualizar(id, dados.titulo(), dados.prazoHoras(), Boolean.TRUE.equals(dados.limparPrazo()), dados.observacao(),
                dados.autorId());
    }

    @DeleteMapping("/api/demandas/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Long id) {
        tarefas.excluir(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/demandas/{id}/itens")
    public List<ItemView> adicionarItens(@PathVariable Long id, @RequestBody NovosItens novos) {
        return tarefas.adicionarItens(id, novos.tipo(), novos.texto());
    }

    @PatchMapping("/api/itens/{id}")
    public ItemView resolverItem(@PathVariable Long id, @RequestBody SituacaoItem situacao) {
        return tarefas.resolverItem(id, situacao.resolvido());
    }

    @DeleteMapping("/api/itens/{id}")
    public ResponseEntity<Void> excluirItem(@PathVariable Long id) {
        tarefas.excluirItem(id);
        return ResponseEntity.noContent().build();
    }
}
