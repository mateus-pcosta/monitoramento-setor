package br.com.gepag;

import br.com.gepag.api.dto.Visoes.TarefaView;
import br.com.gepag.domain.Etapa;
import br.com.gepag.domain.StatusTarefa;
import br.com.gepag.domain.TipoItem;
import br.com.gepag.domain.Unidade;
import br.com.gepag.planilha.PlanilhaService;
import br.com.gepag.service.CicloService;
import br.com.gepag.service.RegraNegocioException;
import br.com.gepag.service.RelatorioService;
import br.com.gepag.service.RelatorioService.TempoUnidade;
import br.com.gepag.service.RelatorioService.TempoUsuario;
import br.com.gepag.service.TarefaService;
import br.com.gepag.service.UsuarioService;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

/** Percorre um ciclo: SEAD, tratamento na GEPAG com espera da Logus, e o fechamento por usuário e unidade. */
@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:ciclo;DB_CLOSE_DELAY=-1",
        "app.planilha.caminho=target/test-dados/monitoramento.xlsx"})
@Import(RelogioDeTeste.Config.class)
class CicloIntegrationTest {

    @Autowired RelogioDeTeste relogio;
    @Autowired CicloService ciclos;
    @Autowired TarefaService tarefas;
    @Autowired UsuarioService usuarios;
    @Autowired RelatorioService relatorios;
    @Autowired PlanilhaService planilha;

    @Test
    void cicloCompleto() throws IOException {
        Long sead = usuarios.listar().stream().filter(u -> u.unidade() == Unidade.SEAD).findFirst().orElseThrow().id();
        Long ana = usuarios.criar("Ana", Unidade.GEPAG).id();
        Long bruno = usuarios.criar("Bruno", Unidade.GEPAG).id();

        var ciclo = ciclos.criar("Folha outubro/2026", "2026-10");
        assertThat(ciclo.tarefas()).hasSize(Etapa.values().length);
        Long cicloId = ciclo.ciclo().id();
        Long transmissao = idDa(ciclo.tarefas(), Etapa.SEAD_TRANSMISSAO);
        Long mapeamentos = idDa(ciclo.tarefas(), Etapa.TRAT_MAPEAMENTOS);

        // SEAD: 3 horas transmitindo
        tarefas.atribuir(transmissao, sead, null);
        tarefas.mudarStatus(transmissao, StatusTarefa.EM_ANDAMENTO, null, null);
        relogio.avancar(Duration.ofHours(3));
        tarefas.mudarStatus(transmissao, StatusTarefa.CONCLUIDA, null, "Arquivos recebidos");

        // GEPAG: Ana trabalha 2h, a demanda espera a Logus 5h, Bruno assume e termina em 1h
        tarefas.atribuir(mapeamentos, ana, null);
        tarefas.atualizar(mapeamentos, null, 6.0, false, null, null);
        tarefas.mudarStatus(mapeamentos, StatusTarefa.EM_ANDAMENTO, null, null);
        tarefas.adicionarItens(mapeamentos, null, "123 - Rubrica sem mapeamento\n456;Natureza inválida");
        relogio.avancar(Duration.ofHours(2));
        tarefas.mudarStatus(mapeamentos, StatusTarefa.AGUARDANDO_LOGUS, null, "Chamado aberto");

        var parcial = tarefas.detalhar(mapeamentos).tarefa();
        relogio.avancar(Duration.ofHours(5));
        assertThat(tarefas.detalhar(mapeamentos).tarefa().minutosNoStatusAtual()).isEqualTo(5 * 60);
        assertThat(parcial.itensAbertos()).isEqualTo(2);
        assertThat(tarefas.detalhar(mapeamentos).itens()).extracting(i -> i.identificador(), i -> i.tipo())
                .containsExactly(tuple("123", TipoItem.INCONSISTENCIA),
                        tuple("456", TipoItem.INCONSISTENCIA));

        tarefas.mudarStatus(mapeamentos, StatusTarefa.EM_ANDAMENTO, null, null);
        tarefas.atribuir(mapeamentos, bruno, null);
        relogio.avancar(Duration.ofHours(1));
        var concluida = tarefas.mudarStatus(mapeamentos, StatusTarefa.CONCLUIDA, null, null).tarefa();

        assertThat(concluida.minutosTotais()).isEqualTo(8 * 60);
        assertThat(concluida.foraDoPrazo()).isTrue();
        assertThat(concluida.minutosPorStatus()).containsEntry(StatusTarefa.EM_ANDAMENTO, 3L * 60)
                .containsEntry(StatusTarefa.AGUARDANDO_LOGUS, 5L * 60);

        var relatorio = relatorios.gerar(cicloId);
        assertThat(relatorio.porUsuario()).extracting(TempoUsuario::nome, TempoUsuario::minutosAndamento, TempoUsuario::minutosAguardando)
                .contains(tuple("Ana", 120L, 300L),
                        tuple("Bruno", 60L, 0L),
                        tuple("SEAD", 180L, 0L));
        assertThat(relatorio.porUnidade()).extracting(TempoUnidade::unidade, TempoUnidade::minutos)
                .contains(tuple(Unidade.GEPAG, 180L),
                        tuple(Unidade.LOGUS, 300L),
                        tuple(Unidade.SEAD, 180L));

        // Não encerra com demandas abertas, a menos que force
        assertThatThrownBy(() -> ciclos.encerrar(cicloId, false)).isInstanceOf(RegraNegocioException.class);
        ciclos.encerrar(cicloId, true);
        assertThatThrownBy(() -> tarefas.mudarStatus(transmissao, StatusTarefa.EM_ANDAMENTO, null, null))
                .isInstanceOf(RegraNegocioException.class);

        // O próximo ciclo herda responsável e prazo
        var proximo = ciclos.criar("Folha novembro/2026", "2026-11");
        TarefaView herdada = proximo.tarefas().stream().filter(t -> t.etapa() == Etapa.TRAT_MAPEAMENTOS).findFirst().orElseThrow();
        assertThat(herdada.responsavel().nome()).isEqualTo("Bruno");
        assertThat(herdada.prazoHoras()).isEqualTo(6.0);
        assertThat(herdada.status()).isEqualTo(StatusTarefa.PENDENTE);
        assertThat(herdada.minutosTotais()).isZero();

        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(planilha.baixar()))) {
            List<String> abas = new ArrayList<>();
            wb.forEach(s -> abas.add(s.getSheetName()));
            assertThat(abas).containsExactly("Resumo", "Demandas", "Histórico", "Observações", "Tempo por usuário", "Tempo por unidade",
                    "Tempo por fase", "Itens", "Usuários");
            Sheet porUsuario = wb.getSheet("Tempo por usuário");
            assertThat(porUsuario.getRow(1).getCell(1).getStringCellValue()).isEqualTo("Ana");
            assertThat(porUsuario.getRow(1).getCell(3).getNumericCellValue()).isEqualTo(2.0);
        }
    }

    @Test
    void registroRetroativoNaoPodeVoltarAntesDoUltimo() {
        var ciclo = ciclos.criar("Ciclo retroativo", null);
        Long id = idDa(ciclo.tarefas(), Etapa.ORC_FECHAMENTO);
        relogio.avancar(Duration.ofHours(2));
        tarefas.mudarStatus(id, StatusTarefa.EM_ANDAMENTO, relogio.agora().minusHours(1), null);
        assertThat(tarefas.detalhar(id).tarefa().minutosTotais()).isEqualTo(60);

        assertThatThrownBy(() -> tarefas.mudarStatus(id, StatusTarefa.CONCLUIDA, relogio.agora().minusHours(2), null))
                .hasMessageContaining("anterior");
        assertThatThrownBy(() -> tarefas.mudarStatus(id, StatusTarefa.CONCLUIDA, relogio.agora().plusHours(1), null))
                .hasMessageContaining("futuro");
    }

    @Test
    void validadoEAnuladoEncerramSemContarTempo() {
        var ciclo = ciclos.criar("Ciclo validado", null);
        Long validada = idDa(ciclo.tarefas(), Etapa.COL_CONTABILIZACAO);
        Long anulada = idDa(ciclo.tarefas(), Etapa.CRED_CONTABILIZACAO);
        tarefas.atualizar(validada, null, 2.0, false, null, null);
        relogio.avancar(Duration.ofHours(5));

        var v = tarefas.mudarStatus(validada, StatusTarefa.VALIDADO, null, null).tarefa();
        assertThat(v.iniciadaEm()).isNull();
        assertThat(v.minutosTotais()).isZero();
        assertThat(v.foraDoPrazo()).isFalse();

        tarefas.mudarStatus(anulada, StatusTarefa.EM_ANDAMENTO, null, null);
        relogio.avancar(Duration.ofHours(1));
        var a = tarefas.mudarStatus(anulada, StatusTarefa.ANULADO, null, "Agendamento cancelado").tarefa();
        assertThat(a.concluidaEm()).isNotNull();
        assertThat(a.minutosNoStatusAtual()).isZero();
    }

    @Test
    void tempoSoComecaEmAndamento() {
        var ciclo = ciclos.criar("Ciclo pendente", null);
        Long id = idDa(ciclo.tarefas(), Etapa.TRAT_RUBRICAS);
        relogio.avancar(Duration.ofHours(3));

        assertThatThrownBy(() -> tarefas.mudarStatus(id, StatusTarefa.AGUARDANDO_SEAD, null, null))
                .hasMessageContaining("Em andamento");
        assertThatThrownBy(() -> tarefas.mudarStatus(id, StatusTarefa.CONCLUIDA, null, null))
                .hasMessageContaining("Em andamento");
        assertThat(tarefas.detalhar(id).tarefa().minutosTotais()).isZero();

        // Validado sem iniciar pode voltar para Pendente; nada conta tempo
        tarefas.mudarStatus(id, StatusTarefa.VALIDADO, null, null);
        tarefas.mudarStatus(id, StatusTarefa.PENDENTE, null, null);
        assertThat(tarefas.detalhar(id).tarefa().iniciadaEm()).isNull();

        tarefas.mudarStatus(id, StatusTarefa.EM_ANDAMENTO, null, null);
        assertThat(tarefas.detalhar(id).tarefa().iniciadaEm()).isEqualTo(relogio.agora());
        relogio.avancar(Duration.ofHours(1));
        tarefas.mudarStatus(id, StatusTarefa.AGUARDANDO_SEI, null, null);
        assertThatThrownBy(() -> tarefas.mudarStatus(id, StatusTarefa.PENDENTE, null, null))
                .hasMessageContaining("não volta para Pendente");
        relogio.avancar(Duration.ofHours(2));
        assertThat(tarefas.detalhar(id).tarefa().minutosTotais()).isEqualTo(3 * 60);
    }

    @Test
    void atrasoConformeCronograma() {
        // Competência 10/2026: transmissão SEAD 15/10 11h, processamento 16/10, limite GEPAG 21/10
        var ciclo = ciclos.criar("Folha outubro/2026 (cronograma)", "2026-10");
        Long cicloId = ciclo.ciclo().id();
        Long transmissao = idDa(ciclo.tarefas(), Etapa.SEAD_TRANSMISSAO);
        Long cadastros = idDa(ciclo.tarefas(), Etapa.SEAD_CADASTROS);
        Long mapeamentos = idDa(ciclo.tarefas(), Etapa.TRAT_MAPEAMENTOS);
        Long rubricas = idDa(ciclo.tarefas(), Etapa.TRAT_RUBRICAS);
        Long fechamento = idDa(ciclo.tarefas(), Etapa.ORC_FECHAMENTO);
        assertThat(ciclo.ciclo().temCronograma()).isTrue();
        assertThat(ciclo.tarefas()).allSatisfy(t -> assertThat(t.minutosAtrasoCronograma()).isNull());

        irPara(LocalDateTime.of(2026, 10, 15, 9, 0));
        tarefas.mudarStatus(transmissao, StatusTarefa.EM_ANDAMENTO, null, null);
        tarefas.mudarStatus(cadastros, StatusTarefa.EM_ANDAMENTO, null, null);
        irPara(LocalDateTime.of(2026, 10, 15, 10, 0));
        tarefas.mudarStatus(transmissao, StatusTarefa.CONCLUIDA, null, null);
        irPara(LocalDateTime.of(2026, 10, 15, 14, 0));
        tarefas.mudarStatus(cadastros, StatusTarefa.CONCLUIDA, null, null);
        tarefas.mudarStatus(rubricas, StatusTarefa.VALIDADO, null, null);
        tarefas.mudarStatus(mapeamentos, StatusTarefa.EM_ANDAMENTO, null, null);
        tarefas.mudarStatus(mapeamentos, StatusTarefa.AGUARDANDO_SEAD, null, null);

        irPara(LocalDateTime.of(2026, 10, 17, 6, 0));
        var r = relatorios.gerar(cicloId);
        TarefaView mapa = r.porDemanda().stream().filter(t -> t.id().equals(mapeamentos)).findFirst().orElseThrow();
        assertThat(mapa.prazoCronograma()).isEqualTo(LocalDateTime.of(2026, 10, 17, 0, 0));
        assertThat(mapa.minutosAtrasoCronograma()).isEqualTo(6 * 60);
        assertThat(atrasoDe(r.porDemanda(), transmissao)).isNull();
        assertThat(atrasoDe(r.porDemanda(), cadastros)).isEqualTo(3 * 60);
        assertThat(atrasoDe(r.porDemanda(), rubricas)).isNull();
        assertThat(atrasoDe(r.porDemanda(), fechamento)).isNull();
        // Abertas e atrasadas: relatórios e inconsistências (SEAD), mapeamentos e compliance (tratamento)
        assertThat(r.ciclo().atrasadasCronograma()).isEqualTo(4);

        // A conclusão congela o atraso
        tarefas.mudarStatus(mapeamentos, StatusTarefa.EM_ANDAMENTO, null, null);
        tarefas.mudarStatus(mapeamentos, StatusTarefa.CONCLUIDA, null, null);
        irPara(LocalDateTime.of(2026, 10, 20, 6, 0));
        assertThat(tarefas.detalhar(mapeamentos).tarefa().minutosAtrasoCronograma()).isEqualTo(6 * 60);

        // Sem competência não há cronograma
        var semCompetencia = ciclos.criar("Ciclo sem competência", null);
        assertThat(semCompetencia.ciclo().temCronograma()).isFalse();
        assertThat(semCompetencia.tarefas()).allSatisfy(t -> assertThat(t.prazoCronograma()).isNull());
    }

    private void irPara(LocalDateTime momento) {
        if (momento.isAfter(relogio.agora())) {
            relogio.avancar(Duration.between(relogio.agora(), momento));
        }
        assertThat(relogio.agora()).isEqualTo(momento);
    }

    private static Long atrasoDe(List<TarefaView> lista, Long id) {
        return lista.stream().filter(t -> t.id().equals(id)).findFirst().orElseThrow().minutosAtrasoCronograma();
    }

    @Test
    void observacaoGuardaCadaVersaoComAutor() {
        Long clara = usuarios.criar("Clara", Unidade.GEPAG).id();
        Long sead = usuarios.listar().stream().filter(u -> u.unidade() == Unidade.SEAD).findFirst().orElseThrow().id();
        var ciclo = ciclos.criar("Ciclo observações", null);
        Long id = idDa(ciclo.tarefas(), Etapa.TRAT_COMPLIANCE);

        assertThatThrownBy(() -> tarefas.atualizar(id, null, null, false, "sem autor", null))
                .hasMessageContaining("quem está registrando");
        assertThatThrownBy(() -> tarefas.atualizar(id, null, null, false, "externo", sead))
                .hasMessageContaining("GEPAG");

        tarefas.atualizar(id, null, null, false, "Relatório X com divergência", clara);
        relogio.avancar(Duration.ofMinutes(30));
        tarefas.atualizar(id, null, null, false, "Relatório X com divergência", clara);
        var detalhe = tarefas.atualizar(id, null, null, false, "Divergência resolvida", clara);

        assertThat(detalhe.tarefa().observacao()).isEqualTo("Divergência resolvida");
        assertThat(detalhe.tarefa().observacaoPor()).isEqualTo("Clara");
        assertThat(detalhe.tarefa().observacaoEm()).isEqualTo(relogio.agora());
        assertThat(detalhe.observacoes()).extracting(o -> o.texto())
                .containsExactly("Relatório X com divergência", "Divergência resolvida");

        var apagada = tarefas.atualizar(id, null, null, false, "", clara);
        assertThat(apagada.tarefa().observacao()).isNull();
        assertThat(apagada.observacoes()).hasSize(3).last().extracting(o -> o.texto()).isNull();
    }

    private static Long idDa(List<TarefaView> lista, Etapa etapa) {
        return lista.stream().filter(t -> t.etapa() == etapa).findFirst().orElseThrow().id();
    }
}
