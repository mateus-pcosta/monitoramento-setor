package br.com.gepag.service;

import br.com.gepag.api.dto.Visoes.CicloView;
import br.com.gepag.api.dto.Visoes.TarefaView;
import br.com.gepag.domain.Ciclo;
import br.com.gepag.domain.Fase;
import br.com.gepag.domain.Intervalo;
import br.com.gepag.domain.StatusTarefa;
import br.com.gepag.domain.Tarefa;
import br.com.gepag.domain.Unidade;
import br.com.gepag.domain.Usuario;
import br.com.gepag.repository.CicloRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Fechamento do ciclo: separa o tempo das demandas por usuário, por unidade e por fase.
 * Todo tempo vem dos períodos de status ({@link Intervalo}), em minutos corridos.
 */
@Service
public class RelatorioService {

    private final CicloRepository ciclos;
    private final Relogio relogio;

    public RelatorioService(CicloRepository ciclos, Relogio relogio) {
        this.ciclos = ciclos;
        this.relogio = relogio;
    }

    /**
     * Tempo de uma pessoa (ou unidade externa) como responsável. "Em andamento" é o tempo trabalhando;
     * "aguardando" é o tempo em que a demanda dela dependia de terceiros.
     */
    public record TempoUsuario(Long usuarioId, String nome, Unidade unidade, boolean externo, long minutosAndamento,
                               long minutosAguardando, int demandas, int concluidas) {
    }

    /** `minutosAndamento`: a unidade trabalhando na demanda; `minutosEspera`: demanda parada aguardando a unidade. */
    public record TempoUnidade(Unidade unidade, long minutos, long minutosAndamento, long minutosEspera) {
    }

    /** Duração da fase: do primeiro início ao último encerramento (ou até agora, se ainda há demanda aberta). */
    public record TempoFase(Fase fase, LocalDateTime inicio, LocalDateTime fim, long minutos, int demandas,
                            int encerradas, int foraDoPrazo) {
    }

    public record Relatorio(CicloView ciclo, List<TempoUsuario> porUsuario, List<TempoUnidade> porUnidade,
                            List<TempoFase> porFase, List<TarefaView> porDemanda) {
    }

    @Transactional(readOnly = true)
    public Relatorio gerar(Long cicloId) {
        return gerar(ciclos.findById(cicloId).orElseThrow(() -> new NaoEncontradoException("Ciclo não encontrado.")));
    }

    public Relatorio gerar(Ciclo ciclo) {
        LocalDateTime agora = relogio.referencia(ciclo);
        return new Relatorio(CicloView.de(ciclo, agora), porUsuario(ciclo, agora), porUnidade(ciclo, agora),
                porFase(ciclo, agora), ciclo.getTarefas().stream().map(t -> TarefaView.de(t, agora)).toList());
    }

    private List<TempoUsuario> porUsuario(Ciclo ciclo, LocalDateTime agora) {
        Map<Long, Usuario> pessoas = new LinkedHashMap<>();
        Map<Long, long[]> tempos = new LinkedHashMap<>();
        Map<Long, Set<Long>> demandas = new LinkedHashMap<>();
        for (Tarefa t : ciclo.getTarefas()) {
            for (Intervalo p : t.getIntervalos()) {
                Usuario u = p.getResponsavel();
                if (u == null) {
                    continue;
                }
                pessoas.putIfAbsent(u.getId(), u);
                long[] soma = tempos.computeIfAbsent(u.getId(), k -> new long[2]);
                long minutos = p.minutos(agora);
                if (p.getStatus() == StatusTarefa.EM_ANDAMENTO) {
                    soma[0] += minutos;
                } else if (p.getStatus().aguardandoTerceiro()) {
                    soma[1] += minutos;
                }
                demandas.computeIfAbsent(u.getId(), k -> new HashSet<>()).add(t.getId());
            }
        }
        List<TempoUsuario> resultado = new ArrayList<>();
        pessoas.forEach((id, u) -> {
            long[] soma = tempos.get(id);
            int concluidas = (int) ciclo.getTarefas().stream()
                    .filter(t -> t.getStatus() == StatusTarefa.CONCLUIDA && t.getResponsavel() != null
                            && Objects.equals(t.getResponsavel().getId(), id))
                    .count();
            resultado.add(new TempoUsuario(id, u.getNome(), u.getUnidade(), u.isExterno(), soma[0], soma[1],
                    demandas.get(id).size(), concluidas));
        });
        resultado.sort(Comparator.comparing(TempoUsuario::externo).thenComparing(TempoUsuario::minutosAndamento, Comparator.reverseOrder()));
        return resultado;
    }

    private List<TempoUnidade> porUnidade(Ciclo ciclo, LocalDateTime agora) {
        Map<Unidade, long[]> soma = new EnumMap<>(Unidade.class);
        for (Tarefa t : ciclo.getTarefas()) {
            for (Intervalo p : t.getIntervalos()) {
                if (p.getStatus() == StatusTarefa.PENDENTE || p.getStatus().encerrado()) {
                    continue;
                }
                long[] s = soma.computeIfAbsent(p.unidadeDoTempo(), k -> new long[2]);
                s[p.getStatus().aguardandoTerceiro() ? 1 : 0] += p.minutos(agora);
            }
        }
        List<TempoUnidade> resultado = new ArrayList<>();
        soma.forEach((u, s) -> resultado.add(new TempoUnidade(u, s[0] + s[1], s[0], s[1])));
        resultado.sort(Comparator.comparing(TempoUnidade::minutos).reversed());
        return resultado;
    }

    private List<TempoFase> porFase(Ciclo ciclo, LocalDateTime agora) {
        List<TempoFase> resultado = new ArrayList<>();
        for (Fase fase : Fase.values()) {
            List<Tarefa> ts = ciclo.getTarefas().stream().filter(t -> t.getFase() == fase).toList();
            if (ts.isEmpty()) {
                continue;
            }
            LocalDateTime inicio = ts.stream().map(Tarefa::getIniciadaEm).filter(Objects::nonNull)
                    .min(Comparator.naturalOrder()).orElse(null);
            boolean todasEncerradas = ts.stream().allMatch(t -> t.getStatus().encerrado());
            LocalDateTime fim = todasEncerradas
                    ? ts.stream().map(Tarefa::getConcluidaEm).filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null)
                    : null;
            long minutos = inicio == null ? 0 : Math.max(0, Duration.between(inicio, fim != null ? fim : agora).toMinutes());
            resultado.add(new TempoFase(fase, inicio, fim, minutos, ts.size(),
                    (int) ts.stream().filter(t -> t.getStatus().encerrado()).count(),
                    (int) ts.stream().filter(t -> t.foraDoPrazo(agora)).count()));
        }
        return resultado;
    }
}
