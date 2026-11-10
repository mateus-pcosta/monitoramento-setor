# Monitoramento GEPAG (SEFAZ)

Acompanhamento interno do ciclo da folha no setor GEPAG. Mede quanto tempo cada etapa leva, quanto tempo cada pessoa da equipe passa em cada demanda e quanto tempo se espera por outras unidades (SEAD, SEPLAN, Logus, processos SEI). Os tempos ficam numa planilha regravada automaticamente; depois ela pode ser espelhada no Google Sheets para a equipe consultar.

## Demonstração online

**https://mateus-pcosta.github.io/monitoramento-setor/**

Versão para conhecer as telas sem instalar nada. Roda inteira no navegador, com dados fictícios: o que cada pessoa faz fica só no navegador dela (não é compartilhado com os colegas) e a planilha não é gerada. O botão "Recomeçar demonstração" volta ao exemplo inicial.

Ela é publicada sozinha no GitHub Pages a cada push na `main` ([pages.yml](.github/workflows/pages.yml)): o script [demo/montar.sh](demo/montar.sh) copia as telas do sistema e liga uma API simulada ([demo/api-simulada.js](demo/api-simulada.js)) que reproduz as regras do back-end. Para gerar localmente: `sh demo/montar.sh` e sirva a pasta `_site/`.

## Como rodar

Requisitos: Java 21. Não é preciso instalar Maven (o projeto usa o Maven Wrapper).

```bash
cd backend
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run
```

Abra http://localhost:8080. Na primeira vez:

1. Em **Usuários e planilha**, cole os nomes da equipe (um por linha). SEAD, SEPLAN e um usuário genérico "UG" já vêm cadastrados como unidades externas, só para receber demandas. As três são unidades gestoras (UG); SEAD e SEPLAN ficam à parte porque têm status de espera próprios, e a SEAD tem contato direto e constante com a SEFAZ. Outras unidades gestoras podem ser cadastradas na unidade "Outra UG", colando a lista no padrão do SIAFE (`140102 - NOME DA UG`): o código de 6 dígitos fica guardado à parte e aparece na aba Usuários da planilha.
2. Em **Ciclos** (ou no Painel), abra o ciclo, por exemplo "Folha outubro/2026". As 18 etapas do roteiro viram demandas pendentes.
3. Em cada demanda: atribua o responsável, defina o tempo para solução e mude o status conforme o trabalho anda.

Os dados ficam em `backend/data/` (banco H2 em arquivo). Para começar do zero, pare a aplicação e apague essa pasta.

## Telas

| Tela | Para que serve |
|---|---|
| Painel do ciclo | As demandas do ciclo agrupadas por fase, com status, há quanto tempo estão nele, responsável, prazo e itens abertos. Filtros por situação e por responsável |
| Quem está com o quê | Demandas abertas por pessoa, o que está parado aguardando outras unidades (e há quanto tempo) e o que foi iniciado sem responsável |
| Calendário | Calendário mensal com as datas do cronograma 2026 (Portaria SEFAZ-PI/GASEC nº 6/2026: SIAPE-FOLHA e SIAPE-PPF), a janela interna da GEPAG, feriados e pontos facultativos, alertas de calendário e as demandas do ciclo atrasadas. No celular vira agenda |
| Tempos e relatórios | Fechamento do ciclo: tempo em andamento por pessoa, tempo por unidade, duração de cada fase e tabela por demanda |
| Ciclos | Abrir, encerrar, reabrir e excluir ciclos; alterar a competência (que define os prazos do cronograma) |
| Usuários e planilha | Equipe, unidades externas, situação da planilha e do Google Sheets, tema claro/escuro |

Clicar numa demanda abre o painel lateral: mudar status (com nota e, se esqueceu de marcar na hora, com horário retroativo), trocar responsável, tempo para solução, itens para visualizar (inconsistências, SCs, empenhos provisórios, PDs...), observação e histórico.

A **observação** aparece na linha da demanda no Painel do ciclo, com o nome de quem registrou e quando. Para salvar é preciso escolher quem está registrando (alguém da GEPAG; o navegador lembra a última escolha). Cada alteração, inclusive apagar, fica no histórico da demanda e na aba Observações da planilha.

## Como o tempo é contado

- Cada mudança de status ou de responsável fecha o período atual e abre outro. Todos os números saem desses períodos.
- **Pendente** é a demanda sem status: não conta tempo e não é escolhido como status. O tempo começa quando alguém marca **Em andamento**; antes disso só dá para marcar Validado ou Anulado. Depois de iniciada, a demanda não volta para Pendente.
- Status, na ordem da tela: Pendente (inicial), Em andamento, Anulado, Validado, Aguardando SEAD, Aguardando SEPLAN, Aguardando Logus, Aguardando processo SEI, Concluído.
- **Em andamento** conta para o responsável e para a unidade dele.
- **Aguardando SEAD / SEPLAN / Logus / processo SEI** conta para a unidade aguardada e aparece, no relatório por usuário, como "aguardando terceiros" de quem é o responsável.
- **Concluído**, **Validado** e **Anulado** param o relógio. Validado (antes "Não se aplica") e Anulado não marcam início nem contam para o prazo. Encerrar o ciclo congela todos os tempos.
- O tempo para solução conta a partir do primeiro início da demanda.
- Os tempos são corridos (24h por dia), não em horário de expediente.

## Atraso conforme o cronograma

A competência do ciclo (ex.: 11/2026) busca no cronograma o prazo de cada fase:

| Fase | Prazo |
|---|---|
| Etapa SEAD | Transmissão da SEAD (data e 11h) |
| Tratamento SEFAZ | Processamento estimado, 1º dia GEPAG (até o fim do dia) |
| Agendamentos orçamentário, colaborador e crédito | Limite GEPAG (até o fim do dia) |

- Passou do prazo e a demanda continua aberta (Pendente, Em andamento ou Aguardando): a linha mostra "Atrasado conforme o cronograma: X dias e Y h", em tempo corrido.
- Concluída depois do prazo: "Concluída com atraso de X conforme o cronograma" (o atraso fica congelado).
- Validado e Anulado nunca aparecem como atrasados. O atraso não muda status nem o tempo para solução.
- O SIAPE-PPF aparece só no Calendário; não gera atraso.
- Ciclo sem competência, ou de um ano sem cronograma cadastrado, não calcula atraso (o painel avisa).
- Os dados ficam em [cronograma-2026.json](backend/src/main/resources/cronograma/cronograma-2026.json), transcrito do cronograma oficial. Para outro ano, acrescente `cronograma-AAAA.json` no mesmo formato.

As regras ficam em [Tarefa.java](backend/src/main/java/br/com/gepag/domain/Tarefa.java) e [RelatorioService.java](backend/src/main/java/br/com/gepag/service/RelatorioService.java). O roteiro de etapas fica em [Etapa.java](backend/src/main/java/br/com/gepag/domain/Etapa.java).

## A planilha

Gravada em `backend/data/monitoramento-gepag.xlsx` alguns segundos após cada alteração e a cada 10 minutos (para atualizar os tempos que estão correndo). Se ela estiver aberta no Excel, a gravação espera o arquivo ser fechado. Caminho e intervalo: `app.planilha` no [application.yml](backend/src/main/resources/application.yml).

| Aba | Conteúdo |
|---|---|
| Resumo | Um ciclo por linha: duração, demandas, encerradas, aguardando terceiros, fora do prazo |
| Demandas | Cada demanda com status atual, tempo no status, tempo total, prazo, prazo e atraso no cronograma e horas por status |
| Histórico | Cada período: status, responsável, unidade dona do tempo, início, fim e duração |
| Observações | Cada versão da observação de cada demanda, com quem registrou e quando |
| Tempo por usuário | Horas em andamento, e aguardando terceiros por pessoa e ciclo |
| Tempo por unidade | Horas por unidade (GEPAG, SEAD, SEPLAN, outras UGs, Logus, processo SEI) e ciclo |
| Tempo por fase | Início, fim e duração de cada fase |
| Itens | Itens a visualizar de cada demanda |
| Usuários | Equipe e unidades externas |

Tempos em horas decimais (1,5 = 1h30).

## Google Sheets (opcional)

Quando ligado, cada gravação da planilha também é enviada ao Google Sheets (sobrescreve as abas de mesmo nome). O banco local continua sendo a fonte dos dados.

1. No Google Cloud Console, crie um projeto, ative a **Google Sheets API** e crie uma **service account**. Baixe a chave JSON como `backend/credentials.json` (já está no `.gitignore`).
2. Crie a planilha no Google Sheets e compartilhe com o e-mail da service account, como editor.
3. Em `application.yml`: `app.sheets.enabled: true` e `app.sheets.spreadsheet-id: <ID da URL da planilha>`.

## Arquitetura

```
backend/src/main/java/br/com/gepag/
  domain/      Etapa (roteiro), Fase, StatusTarefa, Unidade, Ciclo, Tarefa, Intervalo, ItemVerificacao, Usuario
  service/     CicloService, TarefaService, UsuarioService, RelatorioService, Relogio
  planilha/    PlanilhaExporter (monta o .xlsx), PlanilhaService (grava sozinha)
  sheets/      envio opcional ao Google Sheets
  api/         controllers REST e DTOs
backend/src/main/resources/static/   front-end em HTML, CSS e JS puros (sem build)
```

## Testes

```bash
cd backend && ./mvnw test
```
