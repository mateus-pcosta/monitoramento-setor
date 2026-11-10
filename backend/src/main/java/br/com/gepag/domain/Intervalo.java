package br.com.gepag.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * Período em que a demanda ficou num status com um responsável. É a base de todos os tempos:
 * mudar o status ou o responsável fecha o período aberto e abre outro.
 * Concluir ou dispensar gera um período de duração zero, que só marca o evento no histórico.
 */
@Entity
public class Intervalo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Tarefa tarefa;

    @Enumerated(EnumType.STRING)
    private StatusTarefa status;

    @ManyToOne
    private Usuario responsavel;

    private LocalDateTime inicio;

    private LocalDateTime fim;

    private String nota;

    protected Intervalo() {
    }

    Intervalo(Tarefa tarefa, StatusTarefa status, Usuario responsavel, LocalDateTime inicio, String nota) {
        this.tarefa = tarefa;
        this.status = status;
        this.responsavel = responsavel;
        this.inicio = inicio;
        this.nota = nota;
    }

    public boolean isAberto() {
        return fim == null;
    }

    public long minutos(LocalDateTime agora) {
        LocalDateTime ate = fim != null ? fim : agora;
        return Math.max(0, Duration.between(inicio, ate).toMinutes());
    }

    /**
     * Unidade dona do tempo: a unidade aguardada nos status de espera; nos demais, a do responsável
     * (ou a da etapa, se ninguém foi atribuído).
     */
    public Unidade unidadeDoTempo() {
        if (status.aguardandoTerceiro()) {
            return status.aguardando();
        }
        return responsavel != null ? responsavel.getUnidade() : tarefa.getUnidade();
    }

    void fechar(LocalDateTime quando) {
        this.fim = quando;
    }

    public Long getId() {
        return id;
    }

    public Tarefa getTarefa() {
        return tarefa;
    }

    public StatusTarefa getStatus() {
        return status;
    }

    public Usuario getResponsavel() {
        return responsavel;
    }

    public LocalDateTime getInicio() {
        return inicio;
    }

    public LocalDateTime getFim() {
        return fim;
    }

    public String getNota() {
        return nota;
    }
}
