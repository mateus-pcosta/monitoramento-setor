package br.com.gepag.service;

import br.com.gepag.api.dto.Visoes.CicloDetalhe;
import br.com.gepag.api.dto.Visoes.CicloView;
import br.com.gepag.domain.Ciclo;
import br.com.gepag.domain.Etapa;
import br.com.gepag.domain.Tarefa;
import br.com.gepag.planilha.PlanilhaService;
import br.com.gepag.repository.CicloRepository;
import br.com.gepag.util.Texto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CicloService {

    private final CicloRepository ciclos;
    private final PlanilhaService planilha;
    private final Relogio relogio;

    public CicloService(CicloRepository ciclos, PlanilhaService planilha, Relogio relogio) {
        this.ciclos = ciclos;
        this.planilha = planilha;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public List<CicloView> listar() {
        return ciclos.findAllByOrderByAbertoEmDescIdDesc().stream()
                .map(c -> CicloView.de(c, relogio.referencia(c)))
                .toList();
    }

    /** O ciclo aberto mais recente; se todos estiverem encerrados, o último. */
    @Transactional(readOnly = true)
    public Optional<CicloDetalhe> atual() {
        return ciclos.findFirstByEncerradoEmIsNullOrderByAbertoEmDescIdDesc()
                .or(ciclos::findFirstByOrderByAbertoEmDescIdDesc)
                .map(c -> CicloDetalhe.de(c, relogio.referencia(c)));
    }

    @Transactional(readOnly = true)
    public CicloDetalhe detalhar(Long id) {
        Ciclo c = buscar(id);
        return CicloDetalhe.de(c, relogio.referencia(c));
    }

    /**
     * Cria o ciclo com uma demanda para cada etapa do roteiro. Responsável e tempo para solução
     * vêm do ciclo anterior, porque costumam se repetir de um mês para o outro.
     */
    @Transactional
    public CicloDetalhe criar(String nome, String competencia) {
        if (Texto.vazio(nome)) {
            throw new RegraNegocioException("Dê um nome ao ciclo, por exemplo \"Folha outubro/2026\".");
        }
        LocalDateTime agora = relogio.agora();
        Map<Etapa, Tarefa> anteriores = ciclos.findFirstByOrderByAbertoEmDescIdDesc()
                .map(c -> c.getTarefas().stream().filter(t -> t.getEtapa() != null)
                        .collect(Collectors.toMap(Tarefa::getEtapa, Function.identity(), (a, b) -> a)))
                .orElse(Map.of());

        Ciclo ciclo = new Ciclo(nome.trim(), Texto.vazio(competencia) ? null : competencia.trim(), agora);
        for (Etapa etapa : Etapa.values()) {
            Tarefa t = Tarefa.daEtapa(ciclo, etapa, agora);
            Tarefa anterior = anteriores.get(etapa);
            if (anterior != null) {
                t.setPrazoHoras(anterior.getPrazoHoras());
                if (anterior.getResponsavel() != null && anterior.getResponsavel().isAtivo()) {
                    t.atribuir(anterior.getResponsavel(), agora);
                }
            }
            ciclo.getTarefas().add(t);
        }
        ciclos.save(ciclo);
        planilha.marcarAlterado();
        return CicloDetalhe.de(ciclo, agora);
    }

    @Transactional
    public CicloView renomear(Long id, String nome, String competencia) {
        Ciclo c = buscar(id);
        if (!Texto.vazio(nome)) {
            c.setNome(nome.trim());
        }
        if (competencia != null) {
            c.setCompetencia(competencia.isBlank() ? null : competencia.trim());
        }
        planilha.marcarAlterado();
        return CicloView.de(c, relogio.referencia(c));
    }

    /** Sem `forcar`, só encerra quando todas as demandas estão concluídas ou dispensadas. */
    @Transactional
    public CicloView encerrar(Long id, boolean forcar) {
        Ciclo c = buscar(id);
        if (c.isEncerrado()) {
            throw new RegraNegocioException("O ciclo já está encerrado.");
        }
        long abertas = c.getTarefas().stream().filter(t -> !t.getStatus().encerrado()).count();
        if (abertas > 0 && !forcar) {
            throw new RegraNegocioException(abertas == 1
                    ? "Ainda há 1 demanda aberta. Conclua, valide, anule ou encerre assim mesmo."
                    : "Ainda há " + abertas + " demandas abertas. Conclua, valide, anule ou encerre assim mesmo.");
        }
        c.setEncerradoEm(relogio.agora());
        planilha.marcarAlterado();
        return CicloView.de(c, c.getEncerradoEm());
    }

    @Transactional
    public CicloView reabrir(Long id) {
        Ciclo c = buscar(id);
        c.setEncerradoEm(null);
        planilha.marcarAlterado();
        return CicloView.de(c, relogio.agora());
    }

    @Transactional
    public void excluir(Long id) {
        ciclos.delete(buscar(id));
        planilha.marcarAlterado();
    }

    public Ciclo buscar(Long id) {
        return ciclos.findById(id).orElseThrow(() -> new NaoEncontradoException("Ciclo não encontrado."));
    }
}
