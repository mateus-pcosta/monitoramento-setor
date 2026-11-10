package br.com.gepag.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;

import java.time.LocalDateTime;

/** Caso a visualizar dentro de uma etapa: inconsistência, SC, empenho provisório, PD etc. */
@Entity
public class ItemVerificacao {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Tarefa tarefa;

    @Enumerated(EnumType.STRING)
    private TipoItem tipo;

    /** Número do documento, matrícula, código da rubrica... */
    private String identificador;

    @Column(length = 1000)
    private String descricao;

    private LocalDateTime criadoEm;

    private LocalDateTime resolvidoEm;

    protected ItemVerificacao() {
    }

    public ItemVerificacao(Tarefa tarefa, TipoItem tipo, String identificador, String descricao, LocalDateTime criadoEm) {
        this.tarefa = tarefa;
        this.tipo = tipo;
        this.identificador = identificador;
        this.descricao = descricao;
        this.criadoEm = criadoEm;
    }

    public boolean isResolvido() {
        return resolvidoEm != null;
    }

    public void setResolvidoEm(LocalDateTime resolvidoEm) {
        this.resolvidoEm = resolvidoEm;
    }

    public Long getId() {
        return id;
    }

    public Tarefa getTarefa() {
        return tarefa;
    }

    public TipoItem getTipo() {
        return tipo;
    }

    public String getIdentificador() {
        return identificador;
    }

    public String getDescricao() {
        return descricao;
    }

    public LocalDateTime getCriadoEm() {
        return criadoEm;
    }

    public LocalDateTime getResolvidoEm() {
        return resolvidoEm;
    }
}
