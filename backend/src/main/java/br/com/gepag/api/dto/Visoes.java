package br.com.gepag.api.dto;

import br.com.gepag.cronograma.Cronogramas;
import br.com.gepag.cronograma.Cronogramas.Marco;
import br.com.gepag.domain.Ciclo;
import br.com.gepag.domain.Etapa;
import br.com.gepag.domain.Fase;
import br.com.gepag.domain.Intervalo;
import br.com.gepag.domain.ItemVerificacao;
import br.com.gepag.domain.ObservacaoRegistro;
import br.com.gepag.domain.StatusTarefa;
import br.com.gepag.domain.Tarefa;
import br.com.gepag.domain.TipoItem;
import br.com.gepag.domain.Unidade;
import br.com.gepag.domain.Usuario;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Respostas da API. Todos os tempos são em minutos corridos, calculados em relação a `agora`. */
public final class Visoes {

    private Visoes() {
    }

    public record UsuarioView(Long id, String nome, Unidade unidade, String codigoUg, boolean externo, boolean ativo) {

        public static UsuarioView de(Usuario u) {
            return u == null ? null : new UsuarioView(u.getId(), u.getNome(), u.getUnidade(), u.getCodigoUg(), u.isExterno(), u.isAtivo());
        }
    }

    public record TarefaView(
            Long id,
            Long cicloId,
            Etapa etapa,
            Fase fase,
            String numero,
            String titulo,
            Unidade unidade,
            boolean opcional,
            boolean avulsa,
            UsuarioView responsavel,
            StatusTarefa status,
            LocalDateTime statusDesde,
            LocalDateTime iniciadaEm,
            LocalDateTime concluidaEm,
            Double prazoHoras,
            LocalDateTime limitePrazo,
            boolean foraDoPrazo,
            long minutosTotais,
            long minutosNoStatusAtual,
            Map<StatusTarefa, Long> minutosPorStatus,
            TipoItem tipoItem,
            long itensAbertos,
            int itensTotal,
            String observacao,
            String observacaoPor,
            LocalDateTime observacaoEm,
            LocalDateTime prazoCronograma,
            String marcoCronograma,
            Long minutosAtrasoCronograma) {

        public static TarefaView de(Tarefa t, LocalDateTime agora) {
            long abertos = t.getItens().stream().filter(i -> !i.isResolvido()).count();
            TipoItem tipoItem = t.getEtapa() != null ? t.getEtapa().tipoItem() : null;
            ObservacaoRegistro ultima = t.ultimaObservacao().orElse(null);
            return new TarefaView(t.getId(), t.getCiclo().getId(), t.getEtapa(), t.getFase(), t.getNumero(), t.getTitulo(),
                    t.getUnidade(), t.isOpcional(), t.isAvulsa(), UsuarioView.de(t.getResponsavel()), t.getStatus(),
                    t.getStatusDesde(), t.getIniciadaEm(), t.getConcluidaEm(), t.getPrazoHoras(), t.limitePrazo(),
                    t.foraDoPrazo(agora), t.minutosTotais(agora), t.minutosNoStatusAtual(agora), t.minutosPorStatus(agora),
                    tipoItem, abertos, t.getItens().size(), t.getObservacao(),
                    ultima == null ? null : ultima.getAutor().getNome(), ultima == null ? null : ultima.getEm(),
                    t.prazoCronograma(), Marco.daFase(t.getFase()).rotulo(), t.minutosAtrasoCronograma(agora));
        }
    }

    public record IntervaloView(Long id, StatusTarefa status, UsuarioView responsavel, Unidade unidadeDoTempo,
                                LocalDateTime inicio, LocalDateTime fim, long minutos, String nota) {

        public static IntervaloView de(Intervalo p, LocalDateTime agora) {
            return new IntervaloView(p.getId(), p.getStatus(), UsuarioView.de(p.getResponsavel()), p.unidadeDoTempo(),
                    p.getInicio(), p.getFim(), p.minutos(agora), p.getNota());
        }
    }

    public record ItemView(Long id, TipoItem tipo, String identificador, String descricao,
                           LocalDateTime criadoEm, LocalDateTime resolvidoEm, boolean resolvido) {

        public static ItemView de(ItemVerificacao i) {
            return new ItemView(i.getId(), i.getTipo(), i.getIdentificador(), i.getDescricao(), i.getCriadoEm(),
                    i.getResolvidoEm(), i.isResolvido());
        }
    }

    /** `texto` nulo = a observação foi apagada nesta versão. */
    public record ObservacaoView(Long id, String texto, String autor, LocalDateTime em) {

        public static ObservacaoView de(ObservacaoRegistro o) {
            return new ObservacaoView(o.getId(), o.getTexto(), o.getAutor().getNome(), o.getEm());
        }
    }

    public record TarefaDetalhe(TarefaView tarefa, List<IntervaloView> historico, List<ItemView> itens,
                                List<ObservacaoView> observacoes) {

        public static TarefaDetalhe de(Tarefa t, LocalDateTime agora) {
            return new TarefaDetalhe(TarefaView.de(t, agora),
                    t.getIntervalos().stream().map(p -> IntervaloView.de(p, agora)).toList(),
                    t.getItens().stream().map(ItemView::de).toList(),
                    t.getObservacoes().stream().map(ObservacaoView::de).toList());
        }
    }

    public record CicloView(Long id, String nome, String competencia, LocalDateTime abertoEm, LocalDateTime encerradoEm,
                            boolean encerrado, long minutosDecorridos, int totalTarefas, int encerradas, int emAndamento,
                            int aguardandoTerceiros, int foraDoPrazo, boolean temCronograma, int atrasadasCronograma) {

        public static CicloView de(Ciclo c, LocalDateTime agora) {
            List<Tarefa> ts = c.getTarefas();
            return new CicloView(c.getId(), c.getNome(), c.getCompetencia(), c.getAbertoEm(), c.getEncerradoEm(),
                    c.isEncerrado(), Math.max(0, Duration.between(c.getAbertoEm(), agora).toMinutes()), ts.size(),
                    (int) ts.stream().filter(t -> t.getStatus().encerrado()).count(),
                    (int) ts.stream().filter(t -> t.getStatus() == StatusTarefa.EM_ANDAMENTO).count(),
                    (int) ts.stream().filter(t -> t.getStatus().aguardandoTerceiro()).count(),
                    (int) ts.stream().filter(t -> !t.getStatus().encerrado() && t.foraDoPrazo(agora)).count(),
                    Cronogramas.folha(c.getCompetencia()).isPresent(),
                    (int) ts.stream().filter(t -> !t.getStatus().encerrado() && t.minutosAtrasoCronograma(agora) != null).count());
        }
    }

    public record CicloDetalhe(CicloView ciclo, List<TarefaView> tarefas) {

        public static CicloDetalhe de(Ciclo c, LocalDateTime agora) {
            return new CicloDetalhe(CicloView.de(c, agora), c.getTarefas().stream().map(t -> TarefaView.de(t, agora)).toList());
        }
    }
}
