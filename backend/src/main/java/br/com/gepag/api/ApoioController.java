package br.com.gepag.api;

import br.com.gepag.api.dto.Visoes.UsuarioView;
import br.com.gepag.domain.Fase;
import br.com.gepag.domain.Rotulado;
import br.com.gepag.domain.StatusTarefa;
import br.com.gepag.domain.TipoItem;
import br.com.gepag.domain.Unidade;
import br.com.gepag.planilha.PlanilhaService;
import br.com.gepag.service.UsuarioService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

/** Rótulos, usuários e planilha. */
@RestController
@RequestMapping("/api")
public class ApoioController {

    private final UsuarioService usuarios;
    private final PlanilhaService planilha;

    public ApoioController(UsuarioService usuarios, PlanilhaService planilha) {
        this.usuarios = usuarios;
        this.planilha = planilha;
    }

    public record Opcao(String valor, String rotulo) {
    }

    public record OpcaoStatus(String valor, String rotulo, Unidade aguardando, boolean encerrado) {
    }

    public record OpcaoFase(String valor, String rotulo, String descricao, Unidade unidade) {
    }

    public record Opcoes(List<OpcaoStatus> status, List<OpcaoFase> fases, List<Opcao> unidades,
                         List<Opcao> unidadesDeUsuario, List<String> unidadesUg, List<Opcao> tiposItem) {
    }

    @GetMapping("/opcoes")
    public Opcoes opcoes() {
        return new Opcoes(
                Arrays.stream(StatusTarefa.values()).map(s -> new OpcaoStatus(s.name(), s.rotulo(), s.aguardando(), s.encerrado())).toList(),
                Arrays.stream(Fase.values()).map(f -> new OpcaoFase(f.name(), f.rotulo(), f.descricao(), f.unidade())).toList(),
                opcoes(Unidade.values()),
                opcoes(Arrays.stream(Unidade.values()).filter(Unidade::temUsuarios).toArray(Unidade[]::new)),
                Arrays.stream(Unidade.values()).filter(Unidade::ug).map(Unidade::name).toList(),
                opcoes(TipoItem.values()));
    }

    private static <E extends Enum<E> & Rotulado> List<Opcao> opcoes(E[] valores) {
        return Arrays.stream(valores).map(v -> new Opcao(v.name(), v.rotulo())).toList();
    }

    // ---------- Usuários ----------

    public record NovoUsuario(String nome, Unidade unidade) {
    }

    /** Um nome por linha. */
    public record NovosUsuarios(String nomes, Unidade unidade) {
    }

    /** `codigoUg` vazio remove o código; nulo mantém. */
    public record AlteracaoUsuario(String nome, Unidade unidade, String codigoUg, Boolean ativo) {
    }

    @GetMapping("/usuarios")
    public List<UsuarioView> usuarios() {
        return usuarios.listar();
    }

    @PostMapping("/usuarios")
    public UsuarioView criarUsuario(@RequestBody NovoUsuario novo) {
        return usuarios.criar(novo.nome(), novo.unidade());
    }

    @PostMapping("/usuarios/lote")
    public List<UsuarioView> criarUsuarios(@RequestBody NovosUsuarios novos) {
        return usuarios.criarVarios(novos.nomes(), novos.unidade());
    }

    @PatchMapping("/usuarios/{id}")
    public UsuarioView alterarUsuario(@PathVariable Long id, @RequestBody AlteracaoUsuario dados) {
        return usuarios.atualizar(id, dados.nome(), dados.unidade(), dados.codigoUg(), dados.ativo());
    }

    // ---------- Planilha ----------

    @GetMapping("/planilha")
    public PlanilhaService.Status statusPlanilha() {
        return planilha.status();
    }

    @PostMapping("/planilha/gravar")
    public PlanilhaService.Status gravarPlanilha() {
        planilha.gravar();
        return planilha.status();
    }

    @GetMapping("/planilha/baixar")
    public ResponseEntity<byte[]> baixarPlanilha() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(planilha.nomeArquivo()).build().toString())
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(planilha.baixar());
    }
}
