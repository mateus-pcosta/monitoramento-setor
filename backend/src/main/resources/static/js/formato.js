// Formatação em pt-BR. Datas e horas da API chegam como "2026-10-23T09:30:00" (horário local, sem fuso).

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro",
  "outubro", "novembro", "dezembro"];

const p2 = (n) => String(n).padStart(2, "0");

export function paraDataHora(iso) {
  if (!iso) return null;
  const [data, hora = "00:00:00"] = iso.split("T");
  const [a, m, d] = data.split("-").map(Number);
  const [h, mi, s = 0] = hora.split(":").map(Number);
  return new Date(a, m - 1, d, h, mi, s);
}

/** "23/10 09:30" (com o ano quando não é o ano corrente). */
export function dataHora(iso) {
  const d = paraDataHora(iso);
  if (!d) return "—";
  const ano = d.getFullYear() === new Date().getFullYear() ? "" : `/${d.getFullYear()}`;
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}${ano} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** "qui, 23 out" */
export function dataCurta(iso) {
  const d = paraDataHora(iso);
  if (!d) return "—";
  return `${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** Valor para <input type="datetime-local">. */
export function valorDataHoraLocal(data = new Date()) {
  return `${data.getFullYear()}-${p2(data.getMonth() + 1)}-${p2(data.getDate())}T${p2(data.getHours())}:${p2(data.getMinutes())}`;
}

/** "2026-10" -> "outubro/2026" */
export function competencia(valor) {
  if (!valor) return "";
  const [a, m] = valor.split("-").map(Number);
  return m ? `${MESES_LONGOS[m - 1]}/${a}` : valor;
}

/** Tempo corrido: 45 -> "45 min"; 200 -> "3h 20min"; 3000 -> "2d 2h". */
export function duracao(minutos) {
  const m = Math.max(0, Math.round(minutos || 0));
  if (m < 60) return `${m} min`;
  if (m < 24 * 60) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h ${r}min` : `${h}h`;
  }
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return h ? `${d}d ${h}h` : `${d}d`;
}

/** 90 -> "1,5 h" */
export function horas(minutos) {
  return `${((minutos || 0) / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
}

/** Minutos entre agora e `iso` (positivo se `iso` é futuro). */
export function minutosAte(iso) {
  return Math.round((paraDataHora(iso) - new Date()) / 60000);
}

export function numero(n) {
  return (n ?? 0).toLocaleString("pt-BR");
}

export function plural(n, singular, pluralTexto) {
  return `${numero(n)} ${n === 1 ? singular : pluralTexto}`;
}

/** Atraso em tempo corrido, por extenso: "2 dias e 4 h", "5 h e 20 min", "40 min". */
export function atraso(minutos) {
  const m = Math.max(0, Math.round(minutos || 0));
  if (m < 60) return `${m} min`;
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (!d) {
    const r = m % 60;
    return r ? `${h} h e ${r} min` : `${h} h`;
  }
  const dias = d === 1 ? "1 dia" : `${d} dias`;
  return h ? `${dias} e ${h} h` : dias;
}

/**
 * Prazo do cronograma: datas sem hora chegam como 00:00 do dia seguinte (vencem no fim do dia),
 * então mostramos o próprio dia. "até 19/11 (fim do dia)" ou "até 16/11 11:00".
 */
export function prazoCronograma(iso) {
  const d = paraDataHora(iso);
  if (!d) return "";
  if (d.getHours() === 0 && d.getMinutes() === 0) {
    d.setDate(d.getDate() - 1);
    return `até ${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} (fim do dia)`;
  }
  return `até ${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** Nome do mês: 0 -> "janeiro". */
export function nomeMes(indice) {
  return MESES_LONGOS[indice];
}
