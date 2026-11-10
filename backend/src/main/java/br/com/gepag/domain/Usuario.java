package br.com.gepag.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

/**
 * Pessoa da GEPAG ou unidade externa (SEAD, SEPLAN e demais UGs). Usuários externos existem só para receber
 * demandas: o tempo deles entra na unidade, não em uma pessoa.
 */
@Entity
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nome;

    @Enumerated(EnumType.STRING)
    private Unidade unidade;

    /** Código SIAFE da UG (6 dígitos), para SEAD, SEPLAN e demais unidades gestoras. */
    private String codigoUg;

    private boolean ativo = true;

    protected Usuario() {
    }

    public Usuario(String nome, Unidade unidade) {
        this.nome = nome;
        this.unidade = unidade;
    }

    public boolean isExterno() {
        return unidade != Unidade.GEPAG;
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

    public Unidade getUnidade() {
        return unidade;
    }

    public void setUnidade(Unidade unidade) {
        this.unidade = unidade;
    }

    public String getCodigoUg() {
        return codigoUg;
    }

    public void setCodigoUg(String codigoUg) {
        this.codigoUg = codigoUg;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public void setAtivo(boolean ativo) {
        this.ativo = ativo;
    }
}
