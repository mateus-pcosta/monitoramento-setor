package br.com.gepag.service;

import br.com.gepag.api.dto.Visoes.UsuarioView;
import br.com.gepag.domain.Unidade;
import br.com.gepag.domain.Usuario;
import br.com.gepag.planilha.PlanilhaService;
import br.com.gepag.repository.UsuarioRepository;
import br.com.gepag.util.Texto;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class UsuarioService {

    /** Padrão do SIAFE: "140102 - NOME DA UG" (também aceita ";" ou tabulação, como ao colar do Excel). */
    private static final Pattern LINHA_UG = Pattern.compile("^(\\d{6})\\s*(?:-|–|;|\\t)\\s*(.+)$");
    private static final Pattern CODIGO_UG = Pattern.compile("\\d{6}");

    private final UsuarioRepository usuarios;
    private final PlanilhaService planilha;

    public UsuarioService(UsuarioRepository usuarios, PlanilhaService planilha) {
        this.usuarios = usuarios;
        this.planilha = planilha;
    }

    /** Na primeira execução, cria as unidades externas que recebem demandas. */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void criarExternosIniciais() {
        if (usuarios.count() == 0) {
            usuarios.saveAll(List.of(new Usuario("SEAD", Unidade.SEAD), new Usuario("SEPLAN", Unidade.SEPLAN),
                    new Usuario("UG", Unidade.UG)));
        }
    }

    @Transactional(readOnly = true)
    public List<UsuarioView> listar() {
        return usuarios.findAll().stream()
                .sorted(Comparator.comparing(Usuario::isExterno).thenComparing(u -> Texto.normalizar(u.getNome())))
                .map(UsuarioView::de)
                .toList();
    }

    @Transactional
    public UsuarioView criar(String nome, Unidade unidade) {
        Usuario u = usuarios.save(new Usuario(validarNome(nome, null), validarUnidade(unidade)));
        planilha.marcarAlterado();
        return UsuarioView.de(u);
    }

    /**
     * Um nome por linha; linhas vazias e nomes já cadastrados são ignorados. Para UGs, a linha pode vir
     * no padrão do SIAFE ("140102 - NOME DA UG"): o código é guardado à parte e também evita repetição.
     */
    @Transactional
    public List<UsuarioView> criarVarios(String texto, Unidade unidade) {
        validarUnidade(unidade);
        List<Usuario> todos = usuarios.findAll();
        List<String> nomes = new ArrayList<>(todos.stream().map(u -> Texto.normalizar(u.getNome())).toList());
        List<String> codigos = new ArrayList<>(todos.stream().map(Usuario::getCodigoUg).filter(c -> c != null).toList());
        List<UsuarioView> criados = new ArrayList<>();
        for (String linha : (texto == null ? "" : texto).split("\\R")) {
            String nome = linha.trim();
            String codigo = null;
            Matcher m = LINHA_UG.matcher(nome);
            if (unidade.ug() && m.matches()) {
                codigo = m.group(1);
                nome = m.group(2).trim();
            }
            if (nome.isEmpty() || nomes.contains(Texto.normalizar(nome)) || (codigo != null && codigos.contains(codigo))) {
                continue;
            }
            nomes.add(Texto.normalizar(nome));
            Usuario u = new Usuario(nome, unidade);
            if (codigo != null) {
                codigos.add(codigo);
                u.setCodigoUg(codigo);
            }
            criados.add(UsuarioView.de(usuarios.save(u)));
        }
        planilha.marcarAlterado();
        return criados;
    }

    @Transactional
    public UsuarioView atualizar(Long id, String nome, Unidade unidade, String codigoUg, Boolean ativo) {
        Usuario u = buscar(id);
        if (nome != null) {
            u.setNome(validarNome(nome, id));
        }
        if (unidade != null) {
            u.setUnidade(validarUnidade(unidade));
        }
        if (codigoUg != null) {
            u.setCodigoUg(validarCodigo(codigoUg, u));
        }
        if (ativo != null) {
            u.setAtivo(ativo);
        }
        planilha.marcarAlterado();
        return UsuarioView.de(u);
    }

    public Usuario buscar(Long id) {
        return usuarios.findById(id).orElseThrow(() -> new NaoEncontradoException("Usuário não encontrado."));
    }

    private String validarNome(String nome, Long idAtual) {
        if (Texto.vazio(nome)) {
            throw new RegraNegocioException("Informe o nome.");
        }
        String limpo = nome.trim();
        boolean repetido = usuarios.findAll().stream()
                .anyMatch(u -> !u.getId().equals(idAtual) && Texto.normalizar(u.getNome()).equals(Texto.normalizar(limpo)));
        if (repetido) {
            throw new RegraNegocioException("Já existe um usuário chamado \"" + limpo + "\".");
        }
        return limpo;
    }

    private String validarCodigo(String codigo, Usuario dono) {
        String limpo = codigo.trim();
        if (limpo.isEmpty()) {
            return null;
        }
        if (!dono.getUnidade().ug()) {
            throw new RegraNegocioException("Só UGs têm código (SEAD, SEPLAN ou outra UG).");
        }
        if (!CODIGO_UG.matcher(limpo).matches()) {
            throw new RegraNegocioException("O código da UG tem 6 dígitos, por exemplo 140102.");
        }
        boolean repetido = usuarios.findAll().stream()
                .anyMatch(u -> !u.getId().equals(dono.getId()) && limpo.equals(u.getCodigoUg()));
        if (repetido) {
            throw new RegraNegocioException("Já existe uma UG com o código " + limpo + ".");
        }
        return limpo;
    }

    private static Unidade validarUnidade(Unidade unidade) {
        if (unidade == null || !unidade.temUsuarios()) {
            throw new RegraNegocioException("Escolha a unidade: GEPAG, SEAD, SEPLAN ou outra UG.");
        }
        return unidade;
    }
}
