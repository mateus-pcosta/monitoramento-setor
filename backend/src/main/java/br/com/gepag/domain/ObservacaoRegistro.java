package br.com.gepag.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;

import java.time.LocalDateTime;

/** Cada versão da observação de uma demanda, com quem escreveu e quando. Texto nulo = observação apagada. */
@Entity
public class ObservacaoRegistro {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Tarefa tarefa;

    @Column(length = 2000)
    private String texto;

    @ManyToOne(optional = false)
    private Usuario autor;

    private LocalDateTime em;

    protected ObservacaoRegistro() {
    }

    ObservacaoRegistro(Tarefa tarefa, String texto, Usuario autor, LocalDateTime em) {
        this.tarefa = tarefa;
        this.texto = texto;
        this.autor = autor;
        this.em = em;
    }

    public Long getId() {
        return id;
    }

    public Tarefa getTarefa() {
        return tarefa;
    }

    public String getTexto() {
        return texto;
    }

    public Usuario getAutor() {
        return autor;
    }

    public LocalDateTime getEm() {
        return em;
    }
}
