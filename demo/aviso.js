// Faixa da demonstração: explica onde ficam os dados e permite voltar ao exemplo inicial.
import { recomecar } from "./api-simulada.js";

const faixa = document.createElement("div");
faixa.className = "faixa-demo";
faixa.setAttribute("role", "note");
faixa.innerHTML = `<span><b>Demonstração.</b> Os dados são fictícios e ficam só neste navegador:
  o que você fizer aqui não aparece para os colegas, e a planilha não é gerada.</span>
  <button type="button" class="botao pequeno sutil">Recomeçar demonstração</button>`;
faixa.querySelector("button").addEventListener("click", () => {
  if (!confirm("Apagar tudo o que você fez nesta demonstração e voltar ao exemplo inicial?")) return;
  recomecar();
  location.hash = "#/";
  location.reload();
});
document.getElementById("conteudo-principal").prepend(faixa);
