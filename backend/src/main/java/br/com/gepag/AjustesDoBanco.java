package br.com.gepag;

import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManagerFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;

/**
 * Roda depois que o Hibernate cria/atualiza as tabelas. No H2 o Hibernate grava enums em colunas do tipo
 * ENUM, que travam quando um status ou unidade muda de nome; aqui elas viram texto. Também traduz os
 * nomes antigos de status gravados por versões anteriores.
 */
@Component
public class AjustesDoBanco {

    private static final Logger log = LoggerFactory.getLogger(AjustesDoBanco.class);

    /** Nome antigo -> nome atual. */
    private static final Map<String, String> STATUS_RENOMEADOS = Map.of(
            "EM_EXECUCAO", "EM_ANDAMENTO",
            "DISPENSADA", "VALIDADO");

    private final DataSource dataSource;
    private final JdbcTemplate jdbc;

    /** Depender do EntityManagerFactory garante que as tabelas já existem. */
    public AjustesDoBanco(DataSource dataSource, EntityManagerFactory tabelasProntas) {
        this.dataSource = dataSource;
        this.jdbc = new JdbcTemplate(dataSource);
    }

    @PostConstruct
    public void ajustar() throws SQLException {
        try (Connection c = dataSource.getConnection()) {
            if (!"H2".equals(c.getMetaData().getDatabaseProductName())) {
                return;
            }
        }
        for (Map<String, Object> col : jdbc.queryForList("SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                + "WHERE TABLE_SCHEMA = 'PUBLIC' AND DATA_TYPE = 'ENUM'")) {
            jdbc.execute("ALTER TABLE \"" + col.get("TABLE_NAME") + "\" ALTER COLUMN \"" + col.get("COLUMN_NAME")
                    + "\" SET DATA TYPE VARCHAR(40)");
        }
        for (Map<String, Object> chk : jdbc.queryForList("SELECT TABLE_NAME, CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS "
                + "WHERE TABLE_SCHEMA = 'PUBLIC' AND CONSTRAINT_TYPE = 'CHECK'")) {
            jdbc.execute("ALTER TABLE \"" + chk.get("TABLE_NAME") + "\" DROP CONSTRAINT \"" + chk.get("CONSTRAINT_NAME") + "\"");
        }
        STATUS_RENOMEADOS.forEach((antigo, atual) -> {
            int n = jdbc.update("UPDATE TAREFA SET STATUS = ? WHERE STATUS = ?", atual, antigo)
                    + jdbc.update("UPDATE INTERVALO SET STATUS = ? WHERE STATUS = ?", atual, antigo);
            if (n > 0) {
                log.info("Status {} renomeado para {} em {} registros.", antigo, atual, n);
            }
        });
    }
}
