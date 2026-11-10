// Cliente da API REST. Toda falha vira um Error com mensagem pronta para exibir.

const SEM_SERVIDOR =
  "Sem conexão com o servidor. Confira se a aplicação está rodando (mvnw spring-boot:run) e tente de novo.";

async function requisitar(metodo, caminho, corpo) {
  const opcoes = { method: metodo, headers: { Accept: "application/json" } };
  if (corpo instanceof FormData) {
    opcoes.body = corpo;
  } else if (corpo !== undefined) {
    opcoes.headers["Content-Type"] = "application/json";
    opcoes.body = JSON.stringify(corpo);
  }
  let resposta;
  try {
    resposta = await fetch(`/api${caminho}`, opcoes);
  } catch {
    throw new Error(SEM_SERVIDOR);
  }
  if (resposta.status === 204) return null;
  const tipo = resposta.headers.get("Content-Type") || "";
  const dados = tipo.includes("application/json") ? await resposta.json() : null;
  if (!resposta.ok) {
    throw new Error(dados?.mensagem || `O servidor respondeu com erro ${resposta.status}.`);
  }
  return dados;
}

export const api = {
  get: (caminho) => requisitar("GET", caminho),
  post: (caminho, corpo) => requisitar("POST", caminho, corpo),
  put: (caminho, corpo) => requisitar("PUT", caminho, corpo),
  patch: (caminho, corpo) => requisitar("PATCH", caminho, corpo),
  del: (caminho) => requisitar("DELETE", caminho),
  enviarArquivo: (caminho, campo, arquivo) => {
    const form = new FormData();
    form.append(campo, arquivo);
    return requisitar("POST", caminho, form);
  },
};
