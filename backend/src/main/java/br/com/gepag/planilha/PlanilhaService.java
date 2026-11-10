package br.com.gepag.planilha;

import br.com.gepag.domain.Ciclo;
import br.com.gepag.domain.Usuario;
import br.com.gepag.repository.CicloRepository;
import br.com.gepag.repository.UsuarioRepository;
import br.com.gepag.service.RegraNegocioException;
import br.com.gepag.service.Relogio;
import br.com.gepag.sheets.GoogleSheetsSyncService;
import br.com.gepag.util.Texto;
import org.apache.poi.ss.usermodel.Workbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Mantém a planilha local em dia: toda alteração marca a planilha como desatualizada e uma tarefa
 * agendada a regrava (e envia ao Google Sheets, se ligado) poucos segundos depois.
 */
@Service
public class PlanilhaService {

    private static final Logger log = LoggerFactory.getLogger(PlanilhaService.class);

    private final CicloRepository ciclos;
    private final UsuarioRepository usuarios;
    private final PlanilhaExporter exporter;
    private final GoogleSheetsSyncService sheets;
    private final PlanilhaProperties props;
    private final Relogio relogio;
    private final TransactionTemplate leitura;

    private final AtomicBoolean alterado = new AtomicBoolean(true);
    private volatile LocalDateTime ultimaGravacao;
    private volatile String ultimoErro;
    private volatile LocalDateTime ultimoEnvioSheets;
    private volatile String ultimoErroSheets;

    public PlanilhaService(CicloRepository ciclos, UsuarioRepository usuarios, PlanilhaExporter exporter,
                           GoogleSheetsSyncService sheets, PlanilhaProperties props, Relogio relogio,
                           PlatformTransactionManager transacoes) {
        this.ciclos = ciclos;
        this.usuarios = usuarios;
        this.exporter = exporter;
        this.sheets = sheets;
        this.props = props;
        this.relogio = relogio;
        this.leitura = new TransactionTemplate(transacoes);
        this.leitura.setReadOnly(true);
    }

    public record Status(String caminho, LocalDateTime ultimaGravacao, String erro, boolean sheetsLigado,
                         boolean sheetsConfigurado, LocalDateTime ultimoEnvioSheets, String erroSheets) {
    }

    public Status status() {
        var s = sheets.status();
        return new Status(arquivo().toAbsolutePath().toString(), ultimaGravacao, ultimoErro, s.habilitado(),
                s.configurado(), ultimoEnvioSheets, ultimoErroSheets);
    }

    /** Chamado pelos serviços a cada alteração; vale depois do commit, para a planilha ler os dados novos. */
    public void marcarAlterado() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    alterado.set(true);
                }
            });
        } else {
            alterado.set(true);
        }
    }

    @Scheduled(fixedDelay = 5000, initialDelay = 3000)
    public void gravarSePreciso() {
        boolean vencida = ultimaGravacao == null || ultimaGravacao.plus(props.atualizarACada()).isBefore(relogio.agora());
        if (alterado.getAndSet(false) || vencida) {
            try {
                gravar();
            } catch (RuntimeException e) {
                alterado.set(true);
            }
        }
    }

    /** Grava o arquivo local agora. Se ele estiver aberto no Excel, guarda o erro e tenta de novo depois. */
    public synchronized void gravar() {
        try (Workbook wb = gerarWorkbook()) {
            Path destino = arquivo();
            Path pasta = destino.toAbsolutePath().getParent();
            Files.createDirectories(pasta);
            Path temporario = Files.createTempFile(pasta, "monitoramento-", ".tmp");
            try (OutputStream out = Files.newOutputStream(temporario)) {
                wb.write(out);
            }
            try {
                Files.move(temporario, destino, StandardCopyOption.REPLACE_EXISTING);
            } catch (IOException e) {
                Files.deleteIfExists(temporario);
                throw new RegraNegocioException("Não consegui gravar " + destino.getFileName()
                        + ". Se ela estiver aberta no Excel, feche o arquivo: a gravação é refeita sozinha.", e);
            }
            ultimaGravacao = relogio.agora();
            ultimoErro = null;
            enviarAoSheets(wb);
        } catch (IOException e) {
            registrarErro("Falha ao gravar a planilha: " + e.getMessage());
            throw new UncheckedIOException(e);
        } catch (RegraNegocioException e) {
            registrarErro(e.getMessage());
            throw e;
        }
    }

    /** Registra o erro e só repete no log quando a mensagem muda (a gravação é tentada a cada 5 s). */
    private void registrarErro(String mensagem) {
        if (!mensagem.equals(ultimoErro)) {
            log.warn(mensagem);
        }
        ultimoErro = mensagem;
    }

    private void enviarAoSheets(Workbook wb) {
        var s = sheets.status();
        if (!s.habilitado() || !s.configurado()) {
            return;
        }
        try {
            sheets.enviar(wb);
            ultimoEnvioSheets = relogio.agora();
            ultimoErroSheets = null;
        } catch (RuntimeException e) {
            ultimoErroSheets = e.getMessage();
            log.warn("Falha ao enviar ao Google Sheets: {}", e.getMessage());
        }
    }

    public byte[] baixar() {
        try (Workbook wb = gerarWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public String nomeArquivo() {
        return arquivo().getFileName().toString();
    }

    private Workbook gerarWorkbook() {
        return leitura.execute(tx -> {
            List<Ciclo> todos = ciclos.findAll().stream()
                    .sorted(Comparator.comparing(Ciclo::getAbertoEm).thenComparing(Ciclo::getId))
                    .toList();
            List<Usuario> pessoas = usuarios.findAll().stream()
                    .sorted(Comparator.comparing(Usuario::isExterno).thenComparing(u -> Texto.normalizar(u.getNome())))
                    .toList();
            return exporter.gerar(todos, pessoas);
        });
    }

    private Path arquivo() {
        return Path.of(props.caminho());
    }
}
