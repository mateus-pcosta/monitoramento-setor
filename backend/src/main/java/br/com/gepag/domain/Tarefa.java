package br.com.gepag.domain;

import br.com.gepag.cronograma.Cronogramas;
import br.com.gepag.service.RegraNegocioException;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Demanda de um ciclo: uma etapa do roteiro ou uma demanda avulsa. Guarda o status atual e o
 * histórico de períodos ({@link Intervalo}) de onde saem todos os tempos.
 */
@Entity
public class Tarefa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Ciclo ciclo;

    /** Nulo em demandas avulsas. */
    @Enumerated(EnumType.STRING)
    private Etapa etapa;

    @Enumerated(EnumType.STRING)
    private Fase fase;

    private String numero;

    private int ordem;

    private String titulo;

    /** Unidade que executa a demanda quando não há responsável. */
    @Enumerated(EnumType.STRING)
    private Unidade unidade;

    private boolean opcional;

    @ManyToOne
    private Usuario responsavel;

    @Enumerated(EnumType.STRING)
    private StatusTarefa status = StatusTarefa.PENDENTE;

    private LocalDateTime statusDesde;

    private LocalDateTime criadaEm;

    private LocalDateTime iniciadaEm;

    private LocalDateTime concluidaEm;

    /** Tempo para solução, contado a partir do início. Nulo = sem prazo. */
    private Double prazoHoras;

    @Column(length = 2000)
    private String observacao;

    @OneToMany(mappedBy = "tarefa", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("inicio ASC, id ASC")
    private List<Intervalo> intervalos = new ArrayList<>();

    @OneToMany(mappedBy = "tarefa", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<ItemVerificacao> itens = new ArrayList<>();

    @OneToMany(mappedBy = "tarefa", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("em ASC, id ASC")
    private List<ObservacaoRegistro> observacoes = new ArrayList<>();

    protected Tarefa() {
    }

    public static Tarefa daEtapa(Ciclo ciclo, Etapa etapa, LocalDateTime agora) {
        Tarefa t = new Tarefa(ciclo, etapa.fase(), etapa.titulo(), etapa.fase().unidade(), agora);
        t.etapa = etapa;
        t.numero = etapa.numero();
        t.ordem = etapa.ordinal() * 10;
        t.opcional = etapa.opcional();
        return t;
    }

    public static Tarefa avulsa(Ciclo ciclo, Fase fase, String titulo, Unidade unidade, int ordem, LocalDateTime agora) {
        Tarefa t = new Tarefa(ciclo, fase, titulo, unidade, agora);
        t.ordem = ordem;
        return t;
    }

    private Tarefa(Ciclo ciclo, Fase fase, String titulo, Unidade unidade, LocalDateTime agora) {
        this.ciclo = ciclo;
        this.fase = fase;
        this.titulo = titulo;
        this.unidade = unidade;
        this.criadaEm = agora;
        this.statusDesde = agora;
    }

    // ---------- Regras ----------

    /**
     * Fecha o período atual e abre o do novo status. "Pendente" é a demanda sem status: não conta tempo e
     * não é escolhido depois de iniciada. O tempo começa a contar quando a demanda entra em "Em andamento";
     * antes disso só cabem Validado e Anulado.
     */
    public void mudarStatus(StatusTarefa novo, LocalDateTime quando, String nota) {
        if (novo == status) {
            throw new RegraNegocioException("A demanda já está em \"" + novo.rotulo() + "\".");
        }
        if (novo == StatusTarefa.PENDENTE && iniciadaEm != null) {
            throw new RegraNegocioException("Depois de iniciada, a demanda não volta para Pendente. "
                    + "Use \"Em andamento\" ou um dos status \"Aguardando\".");
        }
        if (iniciadaEm == null && novo != StatusTarefa.EM_ANDAMENTO && novo != StatusTarefa.PENDENTE && !novo.semExecucao()) {
            throw new RegraNegocioException("Marque \"Em andamento\" primeiro: o tempo da demanda começa a contar a partir dele.");
        }
        validarMomento(quando);
        periodoAberto().ifPresent(p -> p.fechar(quando));
        if (iniciadaEm == null && novo == StatusTarefa.EM_ANDAMENTO) {
            iniciadaEm = quando;
        }
        concluidaEm = novo.encerrado() ? quando : null;
        status = novo;
        statusDesde = quando;
        if (novo != StatusTarefa.PENDENTE) {
            Intervalo periodo = new Intervalo(this, novo, responsavel, quando, nota);
            if (novo.encerrado()) {
                periodo.fechar(quando);
            }
            intervalos.add(periodo);
        }
    }

    /** O tempo a partir de `quando` passa a contar para o novo responsável. */
    public void atribuir(Usuario novo, LocalDateTime quando) {
        if (mesmoUsuario(responsavel, novo)) {
            return;
        }
        Optional<Intervalo> aberto = periodoAberto();
        if (aberto.isPresent()) {
            validarMomento(quando);
            aberto.get().fechar(quando);
            String nota = novo == null ? "Responsável removido" : "Responsável: " + novo.getNome();
            intervalos.add(new Intervalo(this, status, novo, quando, nota));
        }
        responsavel = novo;
    }

    /**
     * Troca a observação e guarda a versão no histórico, com o autor. Texto vazio apaga a observação
     * (o apagamento também fica no histórico). Devolve false se nada mudou.
     */
    public boolean alterarObservacao(String texto, Usuario autor, LocalDateTime quando) {
        String novo = texto == null || texto.isBlank() ? null : texto.trim();
        if (Objects.equals(novo, observacao)) {
            return false;
        }
        observacao = novo;
        observacoes.add(new ObservacaoRegistro(this, novo, autor, quando));
        return true;
    }

    /** Quem escreveu a observação atual e quando; vazio se ela nunca foi alterada pelo app. */
    public Optional<ObservacaoRegistro> ultimaObservacao() {
        return observacoes.isEmpty() ? Optional.empty() : Optional.of(observacoes.getLast());
    }

    private void validarMomento(LocalDateTime quando) {
        LocalDateTime limite = intervalos.isEmpty() ? criadaEm : intervalos.getLast().getInicio();
        if (quando.isBefore(limite)) {
            throw new RegraNegocioException("O horário informado é anterior ao último registro da demanda.");
        }
    }

    private static boolean mesmoUsuario(Usuario a, Usuario b) {
        return a == null ? b == null : b != null && a.getId().equals(b.getId());
    }

    public Optional<Intervalo> periodoAberto() {
        return intervalos.isEmpty() ? Optional.empty() : Optional.of(intervalos.getLast()).filter(Intervalo::isAberto);
    }

    // ---------- Tempos ----------

    /** Do início até a conclusão (ou até agora). Zero se nunca foi iniciada. */
    public long minutosTotais(LocalDateTime agora) {
        if (iniciadaEm == null) {
            return 0;
        }
        LocalDateTime ate = concluidaEm != null ? concluidaEm : agora;
        return Math.max(0, Duration.between(iniciadaEm, ate).toMinutes());
    }

    public long minutosNoStatusAtual(LocalDateTime agora) {
        return status.encerrado() ? 0 : Math.max(0, Duration.between(statusDesde, agora).toMinutes());
    }

    public Map<StatusTarefa, Long> minutosPorStatus(LocalDateTime agora) {
        Map<StatusTarefa, Long> soma = new EnumMap<>(StatusTarefa.class);
        for (Intervalo p : intervalos) {
            soma.merge(p.getStatus(), p.minutos(agora), Long::sum);
        }
        return soma;
    }

    public LocalDateTime limitePrazo() {
        if (prazoHoras == null || iniciadaEm == null) {
            return null;
        }
        return iniciadaEm.plusMinutes(Math.round(prazoHoras * 60));
    }

    /** Passou do tempo para solução (ainda aberta ou concluída depois do limite). */
    public boolean foraDoPrazo(LocalDateTime agora) {
        LocalDateTime limite = limitePrazo();
        if (limite == null || status.semExecucao()) {
            return false;
        }
        LocalDateTime referencia = concluidaEm != null ? concluidaEm : agora;
        return referencia.isAfter(limite);
    }

    /** Prazo da fase no cronograma da competência do ciclo; nulo se não há cronograma para ela. */
    public LocalDateTime prazoCronograma() {
        return Cronogramas.prazo(ciclo.getCompetencia(), fase).orElse(null);
    }

    /**
     * Quanto a demanda passou do prazo do cronograma (tempo corrido); nulo se não está atrasada.
     * Validado e Anulado nunca atrasam; Concluído congela o atraso na conclusão; as demais (inclusive
     * Pendente e Aguardando) atrasam enquanto continuam abertas depois do prazo.
     */
    public Long minutosAtrasoCronograma(LocalDateTime agora) {
        LocalDateTime prazo = prazoCronograma();
        if (prazo == null || status.semExecucao()) {
            return null;
        }
        LocalDateTime referencia = status == StatusTarefa.CONCLUIDA ? concluidaEm : agora;
        long minutos = Duration.between(prazo, referencia).toMinutes();
        return minutos > 0 ? minutos : null;
    }

    public boolean isAvulsa() {
        return etapa == null;
    }

    // ---------- Acesso ----------

    public Long getId() {
        return id;
    }

    public Ciclo getCiclo() {
        return ciclo;
    }

    public Etapa getEtapa() {
        return etapa;
    }

    public Fase getFase() {
        return fase;
    }

    public String getNumero() {
        return numero;
    }

    public int getOrdem() {
        return ordem;
    }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public Unidade getUnidade() {
        return unidade;
    }

    public boolean isOpcional() {
        return opcional;
    }

    public Usuario getResponsavel() {
        return responsavel;
    }

    public StatusTarefa getStatus() {
        return status;
    }

    public LocalDateTime getStatusDesde() {
        return statusDesde;
    }

    public LocalDateTime getCriadaEm() {
        return criadaEm;
    }

    public LocalDateTime getIniciadaEm() {
        return iniciadaEm;
    }

    public LocalDateTime getConcluidaEm() {
        return concluidaEm;
    }

    public Double getPrazoHoras() {
        return prazoHoras;
    }

    public void setPrazoHoras(Double prazoHoras) {
        this.prazoHoras = prazoHoras;
    }

    public String getObservacao() {
        return observacao;
    }

    public List<ObservacaoRegistro> getObservacoes() {
        return observacoes;
    }

    public List<Intervalo> getIntervalos() {
        return intervalos;
    }

    public List<ItemVerificacao> getItens() {
        return itens;
    }
}
