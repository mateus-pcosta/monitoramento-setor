package br.com.gepag.service;

import br.com.gepag.api.dto.Visoes.ItemView;
import br.com.gepag.api.dto.Visoes.TarefaDetalhe;
import br.com.gepag.domain.Ciclo;
import br.com.gepag.domain.Fase;
import br.com.gepag.domain.ItemVerificacao;
import br.com.gepag.domain.StatusTarefa;
import br.com.gepag.domain.Tarefa;
import br.com.gepag.domain.TipoItem;
import br.com.gepag.domain.Unidade;
import br.com.gepag.domain.Usuario;
import br.com.gepag.planilha.PlanilhaService;
import br.com.gepag.repository.ItemVerificacaoRepository;
import br.com.gepag.repository.TarefaRepository;
import br.com.gepag.util.Texto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class TarefaService {

    private final TarefaRepository tarefas;
    private final ItemVerificacaoRepository itens;
    private final CicloService ciclos;
    private final UsuarioService usuarios;
    private final PlanilhaService planilha;
    private final Relogio relogio;

    public TarefaService(TarefaRepository tarefas, ItemVerificacaoRepository itens, CicloService ciclos,
                         UsuarioService usuarios, PlanilhaService planilha, Relogio relogio) {
        this.tarefas = tarefas;
        this.itens = itens;
        this.ciclos = ciclos;
        this.usuarios = usuarios;
        this.planilha = planilha;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public TarefaDetalhe detalhar(Long id) {
        return detalhe(buscar(id));
    }

    @Transactional
    public TarefaDetalhe mudarStatus(Long id, StatusTarefa status, LocalDateTime quando, String nota) {
        if (status == null) {
            throw new RegraNegocioException("Escolha o novo status.");
        }
        Tarefa t = editavel(id);
        t.mudarStatus(status, relogio.momento(quando), Texto.vazio(nota) ? null : nota.trim());
        return salvo(t);
    }

    /** `responsavelId` nulo remove o responsável. */
    @Transactional
    public TarefaDetalhe atribuir(Long id, Long responsavelId, LocalDateTime quando) {
        Tarefa t = editavel(id);
        Usuario novo = responsavelId == null ? null : usuarios.buscar(responsavelId);
        t.atribuir(novo, relogio.momento(quando));
        return salvo(t);
    }

    @Transactional
    /** Mudar a observação exige o autor (alguém da GEPAG): cada versão fica no histórico com o nome dele. */
    public TarefaDetalhe atualizar(Long id, String titulo, Double prazoHoras, boolean limparPrazo, String observacao, Long autorId) {
        Tarefa t = editavel(id);
        if (!Texto.vazio(titulo)) {
            t.setTitulo(titulo.trim());
        }
        if (limparPrazo) {
            t.setPrazoHoras(null);
        } else if (prazoHoras != null) {
            if (prazoHoras <= 0) {
                throw new RegraNegocioException("O tempo para solução precisa ser maior que zero.");
            }
            t.setPrazoHoras(prazoHoras);
        }
        if (observacao != null) {
            if (autorId == null) {
                throw new RegraNegocioException("Escolha quem está registrando a observação.");
            }
            Usuario autor = usuarios.buscar(autorId);
            if (autor.isExterno() || !autor.isAtivo()) {
                throw new RegraNegocioException("A observação precisa ser registrada por alguém ativo da GEPAG.");
            }
            t.alterarObservacao(observacao, autor, relogio.agora());
        }
        return salvo(t);
    }

    @Transactional
    public TarefaDetalhe criarAvulsa(Long cicloId, Fase fase, String titulo, Unidade unidade, Long responsavelId, Double prazoHoras) {
        Ciclo ciclo = ciclos.buscar(cicloId);
        if (ciclo.isEncerrado()) {
            throw new RegraNegocioException("O ciclo está encerrado. Reabra-o para incluir demandas.");
        }
        if (fase == null) {
            throw new RegraNegocioException("Escolha a fase da demanda.");
        }
        if (Texto.vazio(titulo)) {
            throw new RegraNegocioException("Descreva a demanda.");
        }
        int ordem = ciclo.getTarefas().stream().filter(t -> t.getFase() == fase).mapToInt(Tarefa::getOrdem).max()
                .orElse(fase.ordinal() * 1000) + 1;
        LocalDateTime agora = relogio.agora();
        Tarefa t = Tarefa.avulsa(ciclo, fase, titulo.trim(), unidade != null ? unidade : fase.unidade(), ordem, agora);
        if (responsavelId != null) {
            t.atribuir(usuarios.buscar(responsavelId), agora);
        }
        if (prazoHoras != null && prazoHoras > 0) {
            t.setPrazoHoras(prazoHoras);
        }
        ciclo.getTarefas().add(t);
        tarefas.save(t);
        return salvo(t);
    }

    /** Só demandas avulsas podem ser excluídas; etapas do roteiro viram "Validado" ou "Anulado". */
    @Transactional
    public void excluir(Long id) {
        Tarefa t = editavel(id);
        if (!t.isAvulsa()) {
            throw new RegraNegocioException("Etapas do roteiro não podem ser excluídas. Use o status \"Validado\" ou \"Anulado\".");
        }
        t.getCiclo().getTarefas().remove(t);
        planilha.marcarAlterado();
    }

    // ---------- Itens a visualizar ----------

    /**
     * Uma linha por item. "Identificador - descrição" (ou com ";" ou tabulação, como ao colar do Excel)
     * separa o número do documento da descrição.
     */
    @Transactional
    public List<ItemView> adicionarItens(Long tarefaId, TipoItem tipo, String texto) {
        Tarefa t = editavel(tarefaId);
        TipoItem tipoFinal = tipo != null ? tipo
                : t.getEtapa() != null && t.getEtapa().tipoItem() != null ? t.getEtapa().tipoItem() : TipoItem.OUTRO;
        LocalDateTime agora = relogio.agora();
        List<ItemView> criados = new ArrayList<>();
        for (String linha : (texto == null ? "" : texto).split("\\R")) {
            if (linha.isBlank()) {
                continue;
            }
            String[] partes = linha.trim().split("\\s*(\\t|;|\\s-\\s)\\s*", 2);
            String identificador = partes.length == 2 ? partes[0] : null;
            String descricao = partes.length == 2 ? partes[1] : partes[0];
            ItemVerificacao item = new ItemVerificacao(t, tipoFinal, identificador, descricao, agora);
            t.getItens().add(item);
            criados.add(ItemView.de(itens.save(item)));
        }
        if (criados.isEmpty()) {
            throw new RegraNegocioException("Escreva pelo menos um item (um por linha).");
        }
        planilha.marcarAlterado();
        return criados;
    }

    @Transactional
    public ItemView resolverItem(Long itemId, boolean resolvido) {
        ItemVerificacao item = buscarItem(itemId);
        item.setResolvidoEm(resolvido ? relogio.agora() : null);
        planilha.marcarAlterado();
        return ItemView.de(item);
    }

    @Transactional
    public void excluirItem(Long itemId) {
        ItemVerificacao item = buscarItem(itemId);
        item.getTarefa().getItens().remove(item);
        planilha.marcarAlterado();
    }

    // ---------- Apoio ----------

    private Tarefa buscar(Long id) {
        return tarefas.findById(id).orElseThrow(() -> new NaoEncontradoException("Demanda não encontrada."));
    }

    private Tarefa editavel(Long id) {
        Tarefa t = buscar(id);
        if (t.getCiclo().isEncerrado()) {
            throw new RegraNegocioException("O ciclo desta demanda está encerrado. Reabra-o em Ciclos para alterar.");
        }
        return t;
    }

    private ItemVerificacao buscarItem(Long id) {
        ItemVerificacao item = itens.findById(id).orElseThrow(() -> new NaoEncontradoException("Item não encontrado."));
        editavel(item.getTarefa().getId());
        return item;
    }

    private TarefaDetalhe salvo(Tarefa t) {
        planilha.marcarAlterado();
        return detalhe(t);
    }

    private TarefaDetalhe detalhe(Tarefa t) {
        return TarefaDetalhe.de(t, relogio.referencia(t.getCiclo()));
    }
}
