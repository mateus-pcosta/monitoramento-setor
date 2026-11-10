package br.com.gepag.planilha;

import br.com.gepag.api.dto.Visoes.CicloView;
import br.com.gepag.domain.Ciclo;
import br.com.gepag.domain.Intervalo;
import br.com.gepag.domain.ItemVerificacao;
import br.com.gepag.domain.ObservacaoRegistro;
import br.com.gepag.domain.StatusTarefa;
import br.com.gepag.domain.Tarefa;
import br.com.gepag.domain.Usuario;
import br.com.gepag.service.RelatorioService;
import br.com.gepag.service.RelatorioService.Relatorio;
import br.com.gepag.service.Relogio;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Monta a planilha de acompanhamento com todos os ciclos. Tempos em horas decimais (1,5 = 1h30),
 * para facilitar somas e gráficos no Excel e no Google Sheets.
 */
@Component
public class PlanilhaExporter {

    private final RelatorioService relatorios;
    private final Relogio relogio;

    public PlanilhaExporter(RelatorioService relatorios, Relogio relogio) {
        this.relatorios = relatorios;
        this.relogio = relogio;
    }

    public Workbook gerar(List<Ciclo> ciclos, List<Usuario> usuarios) {
        XSSFWorkbook wb = new XSSFWorkbook();
        Estilos estilos = new Estilos(wb);

        Aba resumo = new Aba(wb.createSheet("Resumo"), estilos,
                "Ciclo", "Competência", "Aberto em", "Encerrado em", "Duração (h)", "Demandas", "Encerradas",
                "Em andamento", "Aguardando terceiros", "Fora do prazo");
        Aba demandas = new Aba(wb.createSheet("Demandas"), estilos,
                "Ciclo", "Fase", "Nº", "Demanda", "Unidade", "Responsável", "Status", "Status desde",
                "No status atual (h)", "Iniciada em", "Concluída em", "Tempo total (h)", "Tempo para solução (h)",
                "Prazo até", "Fora do prazo", "Prazo do cronograma", "Atraso no cronograma (h)", "Em andamento (h)", "Aguardando SEAD (h)", "Aguardando SEPLAN (h)",
                "Aguardando Logus (h)", "Aguardando SEI (h)", "Itens abertos", "Observação", "Observação por", "Observação em");
        Aba historico = new Aba(wb.createSheet("Histórico"), estilos,
                "Ciclo", "Fase", "Demanda", "Status", "Responsável", "Tempo na unidade", "Início", "Fim", "Duração (h)", "Nota");
        Aba observacoes = new Aba(wb.createSheet("Observações"), estilos,
                "Ciclo", "Fase", "Demanda", "Observação", "Por", "Em");
        Aba porUsuario = new Aba(wb.createSheet("Tempo por usuário"), estilos,
                "Ciclo", "Usuário", "Unidade", "Em andamento (h)", "Aguardando terceiros (h)", "Demandas", "Concluídas");
        Aba porUnidade = new Aba(wb.createSheet("Tempo por unidade"), estilos,
                "Ciclo", "Unidade", "Total (h)", "Executando (h)", "Demanda aguardando a unidade (h)");
        Aba porFase = new Aba(wb.createSheet("Tempo por fase"), estilos,
                "Ciclo", "Fase", "Início", "Fim", "Duração (h)", "Demandas", "Encerradas", "Fora do prazo");
        Aba itens = new Aba(wb.createSheet("Itens"), estilos,
                "Ciclo", "Demanda", "Tipo", "Identificador", "Descrição", "Incluído em", "Resolvido em");
        Aba pessoas = new Aba(wb.createSheet("Usuários"), estilos, "Nome", "Código UG", "Unidade", "Tipo", "Ativo");

        for (Ciclo ciclo : ciclos) {
            LocalDateTime agora = relogio.referencia(ciclo);
            Relatorio r = relatorios.gerar(ciclo);
            CicloView c = r.ciclo();
            resumo.linha(c.nome(), c.competencia(), c.abertoEm(), c.encerradoEm(), horas(c.minutosDecorridos()),
                    c.totalTarefas(), c.encerradas(), c.emAndamento(), c.aguardandoTerceiros(), c.foraDoPrazo());

            for (Tarefa t : ciclo.getTarefas()) {
                Map<StatusTarefa, Long> por = t.minutosPorStatus(agora);
                ObservacaoRegistro ultima = t.ultimaObservacao().orElse(null);
                demandas.linha(ciclo.getNome(), t.getFase().rotulo(), t.getNumero(), t.getTitulo(), t.getUnidade().rotulo(),
                        nome(t.getResponsavel()), t.getStatus().rotulo(), t.getStatusDesde(),
                        t.getStatus().encerrado() ? null : horas(t.minutosNoStatusAtual(agora)), t.getIniciadaEm(),
                        t.getConcluidaEm(), horas(t.minutosTotais(agora)), t.getPrazoHoras(), t.limitePrazo(),
                        t.limitePrazo() == null ? null : t.foraDoPrazo(agora) ? "Sim" : "Não", t.prazoCronograma(),
                        t.minutosAtrasoCronograma(agora) == null ? null : horas(t.minutosAtrasoCronograma(agora)),
                        horas(por, StatusTarefa.EM_ANDAMENTO), horas(por, StatusTarefa.AGUARDANDO_SEAD),
                        horas(por, StatusTarefa.AGUARDANDO_SEPLAN), horas(por, StatusTarefa.AGUARDANDO_LOGUS),
                        horas(por, StatusTarefa.AGUARDANDO_SEI), t.getItens().stream().filter(i -> !i.isResolvido()).count(),
                        t.getObservacao(), ultima == null ? null : ultima.getAutor().getNome(), ultima == null ? null : ultima.getEm());
                for (ObservacaoRegistro o : t.getObservacoes()) {
                    observacoes.linha(ciclo.getNome(), t.getFase().rotulo(), t.getTitulo(),
                            o.getTexto() == null ? "(observação apagada)" : o.getTexto(), o.getAutor().getNome(), o.getEm());
                }
                for (Intervalo p : t.getIntervalos()) {
                    historico.linha(ciclo.getNome(), t.getFase().rotulo(), t.getTitulo(), p.getStatus().rotulo(),
                            nome(p.getResponsavel()), p.getStatus().encerrado() ? null : p.unidadeDoTempo().rotulo(),
                            p.getInicio(), p.getFim(), horas(p.minutos(agora)), p.getNota());
                }
                for (ItemVerificacao i : t.getItens()) {
                    itens.linha(ciclo.getNome(), t.getTitulo(), i.getTipo().rotulo(), i.getIdentificador(), i.getDescricao(),
                            i.getCriadoEm(), i.getResolvidoEm());
                }
            }
            r.porUsuario().forEach(u -> porUsuario.linha(ciclo.getNome(), u.nome(), u.unidade().rotulo(),
                    horas(u.minutosAndamento()), horas(u.minutosAguardando()), u.demandas(), u.concluidas()));
            r.porUnidade().forEach(u -> porUnidade.linha(ciclo.getNome(), u.unidade().rotulo(), horas(u.minutos()),
                    horas(u.minutosAndamento()), horas(u.minutosEspera())));
            r.porFase().forEach(f -> porFase.linha(ciclo.getNome(), f.fase().rotulo(), f.inicio(), f.fim(),
                    horas(f.minutos()), f.demandas(), f.encerradas(), f.foraDoPrazo()));
        }
        for (Usuario u : usuarios) {
            pessoas.linha(u.getNome(), u.getCodigoUg(), u.getUnidade().rotulo(), !u.isExterno() ? "GEPAG" : u.getUnidade().ug() ? "UG" : "Externo", u.isAtivo() ? "Sim" : "Não");
        }
        Row rodape = resumo.sheet.createRow(resumo.sheet.getLastRowNum() + 2);
        rodape.createCell(0).setCellValue("Planilha gerada em");
        Cell quando = rodape.createCell(1);
        quando.setCellValue(relogio.agora());
        quando.setCellStyle(estilos.dataHora);

        for (Aba aba : List.of(resumo, demandas, historico, observacoes, porUsuario, porUnidade, porFase, itens, pessoas)) {
            aba.ajustarLarguras();
        }
        return wb;
    }

    private static String nome(Usuario u) {
        return u == null ? null : u.getNome();
    }

    private static Double horas(long minutos) {
        return minutos / 60.0;
    }

    private static Double horas(Map<StatusTarefa, Long> por, StatusTarefa status) {
        Long m = por.get(status);
        return m == null ? null : m / 60.0;
    }

    private static final class Estilos {
        final CellStyle cabecalho;
        final CellStyle dataHora;
        final CellStyle horas;

        Estilos(Workbook wb) {
            Font negrito = wb.createFont();
            negrito.setBold(true);
            cabecalho = wb.createCellStyle();
            cabecalho.setFont(negrito);
            dataHora = wb.createCellStyle();
            dataHora.setDataFormat(wb.createDataFormat().getFormat("dd/mm/yyyy hh:mm"));
            horas = wb.createCellStyle();
            horas.setDataFormat(wb.createDataFormat().getFormat("0.00"));
        }
    }

    /** Aba com cabeçalho fixo; colunas terminadas em "(h)" recebem formato de horas decimais. */
    private static final class Aba {
        final Sheet sheet;
        final Estilos estilos;
        final List<String> colunas;
        final int[] larguras;

        Aba(Sheet sheet, Estilos estilos, String... colunas) {
            this.sheet = sheet;
            this.estilos = estilos;
            this.colunas = Arrays.asList(colunas);
            this.larguras = new int[colunas.length];
            Row row = sheet.createRow(0);
            for (int c = 0; c < colunas.length; c++) {
                Cell cell = row.createCell(c);
                cell.setCellValue(colunas[c]);
                cell.setCellStyle(estilos.cabecalho);
                larguras[c] = colunas[c].length();
            }
            sheet.createFreezePane(0, 1);
            sheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, colunas.length - 1));
        }

        void linha(Object... valores) {
            Row row = sheet.createRow(sheet.getLastRowNum() + 1);
            for (int c = 0; c < valores.length; c++) {
                Object v = valores[c];
                if (v == null) {
                    continue;
                }
                Cell cell = row.createCell(c);
                int largura;
                switch (v) {
                    case LocalDateTime d -> {
                        cell.setCellValue(d);
                        cell.setCellStyle(estilos.dataHora);
                        largura = 16;
                    }
                    case Number n -> {
                        cell.setCellValue(n.doubleValue());
                        if (colunas.get(c).endsWith("(h)")) {
                            cell.setCellStyle(estilos.horas);
                        }
                        largura = 8;
                    }
                    default -> {
                        cell.setCellValue(v.toString());
                        largura = Math.min(60, v.toString().length());
                    }
                }
                larguras[c] = Math.max(larguras[c], largura);
            }
        }

        /** Mais leve que autoSizeColumn, que precisa das fontes do sistema. */
        void ajustarLarguras() {
            for (int c = 0; c < larguras.length; c++) {
                sheet.setColumnWidth(c, Math.min(255, larguras[c] + 3) * 256);
            }
        }
    }
}
