// Gráficos em SVG desenhados na largura real do contêiner (texto sempre em 12px).
// Especificação: barras <= 24px com ponta arredondada de 4px, linha de 2px, marcadores r=4 com anel
// da cor da superfície, grade em linha fina, uma única escala por gráfico e dica no hover/foco.
import { esc } from "./ui.js";

const NS = "http://www.w3.org/2000/svg";

// ---------- Dica (tooltip) compartilhada ----------

let dica;
function garantirDica() {
  if (dica) return dica;
  dica = document.createElement("div");
  dica.className = "dica";
  dica.hidden = true;
  document.body.append(dica);
  return dica;
}

function mostrarDica(texto, x, y) {
  const el = garantirDica();
  el.textContent = texto;
  el.hidden = false;
  const larg = el.offsetWidth;
  const alt = el.offsetHeight;
  const esquerda = Math.min(window.innerWidth - larg - 8, Math.max(8, x + 14));
  const topo = y - alt - 12 < 8 ? y + 16 : y - alt - 12;
  el.style.left = `${esquerda}px`;
  el.style.top = `${topo}px`;
}

function esconderDica() {
  if (dica) dica.hidden = true;
}

function ligarDicas(svg) {
  svg.querySelectorAll("[data-dica]").forEach((alvo) => {
    const texto = alvo.getAttribute("data-dica");
    alvo.addEventListener("mousemove", (e) => mostrarDica(texto, e.clientX, e.clientY));
    alvo.addEventListener("mouseleave", esconderDica);
    alvo.addEventListener("focus", () => {
      const r = alvo.getBoundingClientRect();
      mostrarDica(texto, r.left + r.width / 2, r.top);
    });
    alvo.addEventListener("blur", esconderDica);
  });
}

// ---------- Utilidades ----------

function criarSvg(largura, altura, rotulo) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${largura} ${altura}`);
  svg.setAttribute("width", largura);
  svg.setAttribute("height", altura);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", rotulo);
  return svg;
}

function truncar(texto, maxCaracteres) {
  return texto.length > maxCaracteres ? `${texto.slice(0, maxCaracteres - 1)}…` : texto;
}

/** Barra horizontal com ponta direita arredondada e base reta. */
function caminhoBarraH(x0, y, largura, altura) {
  const r = Math.min(4, largura, altura / 2);
  const x1 = x0 + largura;
  return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + altura - r}Q${x1},${y + altura} ${x1 - r},${y + altura}H${x0}Z`;
}

/** Coluna com topo arredondado e base reta. */
function caminhoColuna(x, yBase, largura, altura) {
  const r = Math.min(4, altura, largura / 2);
  const y1 = yBase - altura;
  return `M${x},${yBase}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + largura - r}Q${x + largura},${y1} ${x + largura},${y1 + r}V${yBase}Z`;
}

/** Redesenha quando o contêiner muda de largura. */
function responsivo(container, desenhar) {
  let ultima = 0;
  const executar = () => {
    const largura = Math.floor(container.clientWidth);
    if (!largura || largura === ultima) return;
    ultima = largura;
    container.replaceChildren();
    const svg = desenhar(largura);
    container.append(svg);
    ligarDicas(svg);
  };
  executar();
  new ResizeObserver(executar).observe(container);
}

// ---------- Barras horizontais ----------

/**
 * @param itens [{rotulo, valor, cor, dica}] — `cor` é uma expressão CSS (ex.: "var(--ok)").
 * @param opcoes {max, meta, formatar, rotuloMeta, descricao}
 */
export function barrasHorizontais(container, itens, { max, meta, formatar = String, rotuloMeta = "meta", descricao = "" } = {}) {
  responsivo(container, (largura) => {
    const linhaAlt = 30;
    const espessura = 14;
    const topo = meta !== undefined ? 18 : 4;
    const altura = topo + itens.length * linhaAlt + 4;
    const colRotulo = Math.min(Math.round(largura * 0.38), 190);
    const colValor = 52;
    const x0 = colRotulo + 10;
    const util = Math.max(40, largura - x0 - colValor);
    const maximo = max ?? Math.max(...itens.map((i) => i.valor), 1e-9);
    const escala = (v) => (Math.max(0, v) / maximo) * util;
    const maxChars = Math.max(8, Math.floor(colRotulo / 6.6));

    const svg = criarSvg(largura, altura, descricao);
    let conteudo = `<line class="grade" x1="${x0}" x2="${x0}" y1="${topo - 4}" y2="${altura - 2}"/>`;
    itens.forEach((item, i) => {
      const y = topo + i * linhaAlt;
      const yBarra = y + (linhaAlt - espessura) / 2;
      const w = Math.max(escala(item.valor), item.valor > 0 ? 2 : 0);
      conteudo += `<g class="alvo" tabindex="0" data-dica="${esc(item.dica ?? `${item.rotulo}: ${formatar(item.valor)}`)}">
        <rect x="0" y="${y}" width="${largura}" height="${linhaAlt}" fill="transparent"/>
        <text x="${colRotulo}" y="${y + linhaAlt / 2 + 4}" text-anchor="end">${esc(truncar(item.rotulo, maxChars))}</text>
        ${w ? `<path class="marca-barra" d="${caminhoBarraH(x0, yBarra, w, espessura)}" style="fill: ${item.cor}"/>` : ""}
        <text class="forte" x="${x0 + w + 6}" y="${y + linhaAlt / 2 + 4}">${esc(formatar(item.valor))}</text>
      </g>`;
    });
    if (meta !== undefined) {
      const xm = x0 + escala(meta);
      conteudo += `<line class="meta-linha" x1="${xm}" x2="${xm}" y1="${topo - 6}" y2="${altura - 2}"/>
        <text x="${xm}" y="${topo - 9}" text-anchor="middle">${esc(rotuloMeta)}</text>`;
    }
    svg.innerHTML = conteudo;
    return svg;
  });
}

// ---------- Linha (uma série, escala 0 a 1) ----------

/**
 * @param pontos [{rotulo, valor|null, dica}] em ordem cronológica; valores nulos interrompem a linha.
 */
export function linha(container, pontos, { meta, formatar = String, descricao = "", rotuloMeta = "meta" } = {}) {
  responsivo(container, (largura) => {
    const altura = 220;
    const m = { topo: 16, dir: 16, base: 28, esq: 40 };
    const w = largura - m.esq - m.dir;
    const h = altura - m.topo - m.base;
    const n = pontos.length;
    const x = (i) => m.esq + (n === 1 ? w / 2 : (i / (n - 1)) * w);
    const y = (v) => m.topo + (1 - v) * h;

    const svg = criarSvg(largura, altura, descricao);
    let conteudo = "";
    [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
      conteudo += `<line class="grade" x1="${m.esq}" x2="${largura - m.dir}" y1="${y(t)}" y2="${y(t)}"/>
        <text x="${m.esq - 8}" y="${y(t) + 4}" text-anchor="end">${t * 100}%</text>`;
    });
    if (meta !== undefined) {
      conteudo += `<line class="meta-linha" x1="${m.esq}" x2="${largura - m.dir}" y1="${y(meta)}" y2="${y(meta)}"/>
        <text x="${m.esq + 6}" y="${y(meta) - 6}">${esc(rotuloMeta)}</text>`;
    }
    // Rótulos do eixo x: no máximo ~6, sempre o primeiro e o último
    const passo = Math.max(1, Math.ceil(n / 6));
    pontos.forEach((p, i) => {
      if (i % passo === 0 || i === n - 1) {
        conteudo += `<text x="${x(i)}" y="${altura - 8}" text-anchor="middle">${esc(p.rotulo)}</text>`;
      }
    });
    // Segmentos contínuos
    let d = "";
    let aberto = false;
    pontos.forEach((p, i) => {
      if (p.valor === null || p.valor === undefined) {
        aberto = false;
        return;
      }
      d += `${aberto ? "L" : "M"}${x(i)},${y(p.valor)}`;
      aberto = true;
    });
    conteudo += `<path d="${d}" fill="none" style="stroke: var(--serie)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    // Marcadores e alvos de hover (faixa vertical inteira por ponto)
    const faixa = n > 1 ? w / (n - 1) : w;
    pontos.forEach((p, i) => {
      const temValor = p.valor !== null && p.valor !== undefined;
      const ultimo = i === n - 1 || pontos.slice(i + 1).every((q) => q.valor === null || q.valor === undefined);
      conteudo += `<g class="alvo" tabindex="0" data-dica="${esc(p.dica ?? `${p.rotulo}: ${temValor ? formatar(p.valor) : "sem dados"}`)}">
        <rect x="${x(i) - faixa / 2}" y="${m.topo}" width="${faixa}" height="${h}" fill="transparent"/>
        ${temValor ? `<circle cx="${x(i)}" cy="${y(p.valor)}" r="4" style="fill: var(--serie); stroke: var(--superficie)" stroke-width="2"/>` : ""}
        ${temValor && ultimo ? `<text class="forte" x="${x(i)}" y="${y(p.valor) - 10}" text-anchor="middle">${esc(formatar(p.valor))}</text>` : ""}
      </g>`;
    });
    svg.innerHTML = conteudo;
    return svg;
  });
}

// ---------- Colunas (uma série) ----------

export function colunas(container, itens, { formatar = String, formatarEixo = formatar, descricao = "" } = {}) {
  responsivo(container, (largura) => {
    const altura = 220;
    const m = { topo: 16, dir: 8, base: 28, esq: 40 };
    const w = largura - m.esq - m.dir;
    const h = altura - m.topo - m.base;
    const max = Math.max(...itens.map((i) => i.valor), 1);
    const passoEixo = escolherPasso(max);
    const topoEixo = Math.ceil(max / passoEixo) * passoEixo;
    const y = (v) => m.topo + (1 - v / topoEixo) * h;
    const banda = w / itens.length;
    const espessura = Math.min(24, banda * 0.6);

    const svg = criarSvg(largura, altura, descricao);
    let conteudo = "";
    for (let v = 0; v <= topoEixo + 1e-9; v += passoEixo) {
      conteudo += `<line class="grade" x1="${m.esq}" x2="${largura - m.dir}" y1="${y(v)}" y2="${y(v)}"/>
        <text x="${m.esq - 8}" y="${y(v) + 4}" text-anchor="end">${esc(formatarEixo(v))}</text>`;
    }
    const passoRotulo = Math.max(1, Math.ceil(itens.length / 6));
    const maior = itens.reduce((a, b) => (b.valor > a.valor ? b : a), itens[0]);
    itens.forEach((item, i) => {
      const cx = m.esq + banda * i + banda / 2;
      const alt = (item.valor / topoEixo) * h;
      conteudo += `<g class="alvo" tabindex="0" data-dica="${esc(item.dica ?? `${item.rotulo}: ${formatar(item.valor)}`)}">
        <rect x="${cx - banda / 2}" y="${m.topo}" width="${banda}" height="${h}" fill="transparent"/>
        ${alt > 0 ? `<path class="marca-barra" d="${caminhoColuna(cx - espessura / 2, y(0), espessura, Math.max(alt, 2))}" style="fill: var(--serie)"/>` : ""}
        ${item === maior && item.valor > 0 ? `<text class="forte" x="${cx}" y="${y(item.valor) - 6}" text-anchor="middle">${esc(formatar(item.valor))}</text>` : ""}
        ${i % passoRotulo === 0 || i === itens.length - 1 ? `<text x="${cx}" y="${altura - 8}" text-anchor="middle">${esc(item.rotulo)}</text>` : ""}
      </g>`;
    });
    svg.innerHTML = conteudo;
    return svg;
  });
}

function escolherPasso(max) {
  const bruto = max / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const normal = bruto / potencia;
  const base = normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 5 ? 5 : 10;
  return base * potencia;
}
