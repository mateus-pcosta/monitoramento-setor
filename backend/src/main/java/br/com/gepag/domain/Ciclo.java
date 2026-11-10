package br.com.gepag.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** Um ciclo da folha: da transmissão da SEAD até o último agendamento. */
@Entity
public class Ciclo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nome;

    /** Mês de referência no formato 2026-10. */
    private String competencia;

    private LocalDateTime abertoEm;

    private LocalDateTime encerradoEm;

    @OneToMany(mappedBy = "ciclo", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("ordem ASC, id ASC")
    private List<Tarefa> tarefas = new ArrayList<>();

    protected Ciclo() {
    }

    public Ciclo(String nome, String competencia, LocalDateTime abertoEm) {
        this.nome = nome;
        this.competencia = competencia;
        this.abertoEm = abertoEm;
    }

    public boolean isEncerrado() {
        return encerradoEm != null;
    }

    public Long getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getCompetencia() {
        return competencia;
    }

    public void setCompetencia(String competencia) {
        this.competencia = competencia;
    }

    public LocalDateTime getAbertoEm() {
        return abertoEm;
    }

    public LocalDateTime getEncerradoEm() {
        return encerradoEm;
    }

    public void setEncerradoEm(LocalDateTime encerradoEm) {
        this.encerradoEm = encerradoEm;
    }

    public List<Tarefa> getTarefas() {
        return tarefas;
    }
}
