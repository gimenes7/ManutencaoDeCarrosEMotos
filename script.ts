type Tipo = "carro" | "moto";

interface Troca {
  id: string;
  peca: string;
  custo: number;
  data: string; // yyyy-mm-dd
  km?: number;
}

interface Save {
  id: string;
  nome: string;
  tipo: Tipo;
  limite: number | null; // null = sem limite definido
  trocas: Troca[];
  atualizado: string; // ISO
}

const CHAVE = "controle-manutencao-v1";
const LIMITE_MAX = 5000;
const LIMITE_PADRAO = 500;

const app = document.getElementById("app") as HTMLElement;

let saves: Save[] = carregar();
let tipo: Tipo | null = null;
let atualId: string | null = null;
let criando = false;

/* ---------- JSON / armazenamento ---------- */

function carregar(): Save[] {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return [];
    const dados = JSON.parse(bruto);
    return Array.isArray(dados) ? (dados as Save[]) : [];
  } catch {
    return [];
  }
}

function persistir(): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(saves));
  } catch {
    alert("Não foi possível salvar no navegador.");
  }
}

function tocar(s: Save): void {
  s.atualizado = new Date().toISOString();
  persistir();
}

function exportarJSON(): void {
  const blob = new Blob([JSON.stringify(saves, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "manutencao-saves.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importarJSON(arquivo: File): void {
  arquivo.text().then((texto) => {
    try {
      const dados = JSON.parse(texto);
      if (!Array.isArray(dados)) throw new Error();
      const validos = (dados as Save[]).filter(
        (s) => s && typeof s.id === "string" && typeof s.nome === "string" &&
          (s.tipo === "carro" || s.tipo === "moto") && Array.isArray(s.trocas)
      );
      for (const s of validos) {
        s.limite = typeof s.limite === "number" ? s.limite : null;
        const i = saves.findIndex((x) => x.id === s.id);
        if (i >= 0) saves[i] = s; else saves.push(s);
      }
      persistir();
      render();
      alert(`${validos.length} save(s) importado(s).`);
    } catch {
      alert("Arquivo JSON inválido.");
    }
  });
}

/* ---------- utilidades ---------- */

const brl = (n: number): string =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function esc(t: string): string {
  return t.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

const hojeISO = (): string => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
};

const mesAtual = (): string => hojeISO().slice(0, 7);

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function dataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

const novoId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const emoji = (t: Tipo): string => (t === "carro" ? "🚗" : "🏍️");

function maisTrocada(trocas: Troca[]): string {
  if (trocas.length === 0) return "—";
  const cont = new Map<string, { nome: string; n: number }>();
  for (const t of trocas) {
    const k = t.peca.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const item = cont.get(k);
    if (item) item.n++; else cont.set(k, { nome: t.peca.trim(), n: 1 });
  }
  let melhor = { nome: "", n: 0 };
  cont.forEach((v) => { if (v.n > melhor.n) melhor = v; });
  return `${melhor.nome} (${melhor.n}x)`;
}

const somar = (trocas: Troca[]): number => trocas.reduce((s, t) => s + t.custo, 0);
const atual = (): Save | undefined => saves.find((s) => s.id === atualId);

/* ---------- telas ---------- */

function telaTipo(): string {
  return `
    <h1>Controle de Manutenção</h1>
    <p class="sub">Primeiro, o que você quer controlar?</p>
    <div class="tipos">
      <button class="tipo-btn" data-acao="tipo" data-tipo="carro"><span>🚗</span>Carro</button>
      <button class="tipo-btn" data-acao="tipo" data-tipo="moto"><span>🏍️</span>Moto</button>
    </div>
    <div class="rodape">
      <button data-acao="exportar">⬇ Exportar JSON</button>
      <button data-acao="importar">⬆ Importar JSON</button>
      <input type="file" id="arquivo" accept="application/json,.json" hidden>
    </div>`;
}

function telaSaves(): string {
  const t = tipo as Tipo;
  const lista = saves
    .filter((s) => s.tipo === t)
    .sort((a, b) => b.atualizado.localeCompare(a.atualizado));
  const cards = lista.map((s) => `
    <button class="quadrado" data-acao="abrir" data-id="${s.id}">
      <span class="emoji">${emoji(s.tipo)}</span>
      <span class="nome">${esc(s.nome)}</span>
      <span class="data">Última alteração<br>${dataHora(s.atualizado)}</span>
    </button>`).join("");

  const novo = criando
    ? `<form class="quadrado novo" id="form-novo">
         <input type="text" id="nome-novo" placeholder="Nome do save" maxlength="40" required>
         <button class="primario" type="submit">Criar</button>
         <button class="link" type="button" data-acao="cancelar">cancelar</button>
       </form>`
    : `<button class="quadrado mais" data-acao="novo" title="Adicionar save" aria-label="Adicionar save">+</button>`;

  return `
    <div class="topo">
      <button data-acao="voltar-tipo">←</button>
      <h1>${t === "carro" ? "Seus carros" : "Suas motos"}</h1>
    </div>
    ${lista.length === 0 && !criando ? `<p class="sub">Nenhum save ainda. Clique no + para criar o primeiro.</p>` : ""}
    <div class="grid">${cards}${novo}</div>`;
}

function telaSave(s: Save): string {
  const mes = mesAtual();
  const doMes = s.trocas.filter((t) => t.data.startsWith(mes));
  const ordenadas = [...s.trocas].sort((a, b) => b.data.localeCompare(a.data));

  const linhas = ordenadas.map((t) => `
    <tr>
      <td>${esc(t.peca)}</td>
      <td>${dataBR(t.data)}</td>
      <td class="num">${t.km ? t.km.toLocaleString("pt-BR") + " km" : "—"}</td>
      <td class="num">${brl(t.custo)}</td>
      <td class="num"><button class="link perigo" data-acao="apagar-troca" data-id="${t.id}" title="Remover">✕</button></td>
    </tr>`).join("");

  return `
    <div class="topo">
      <button data-acao="voltar-saves">←</button>
      <h1>${emoji(s.tipo)} ${esc(s.nome)}</h1>
      <button data-acao="renomear">Renomear</button>
      <button class="perigo" data-acao="apagar-save">Excluir save</button>
    </div>

    <div class="stats">
      <div class="stat"><small>Total gasto</small><b>${brl(somar(s.trocas))}</b></div>
      <div class="stat"><small>Gasto neste mês</small><b>${brl(somar(doMes))}</b></div>
      <div class="stat"><small>Peça mais trocada</small><b>${esc(maisTrocada(s.trocas))}</b></div>
      <div class="stat"><small>Mais trocada no mês</small><b>${esc(maisTrocada(doMes))}</b></div>
    </div>

    <section class="painel" id="painel-limite">${blocoLimite(s)}</section>

    <section class="painel">
      <h2>Registrar troca</h2>
      <form class="form" id="form-troca">
        <label>Peça / serviço<input type="text" name="peca" placeholder="Ex.: Óleo, pastilha..." required maxlength="60"></label>
        <label>Valor (R$)<input type="number" name="custo" min="0" step="0.01" required></label>
        <label>Data<input type="date" name="data" value="${hojeISO()}" required></label>
        <label>Km (opcional)<input type="number" name="km" min="0" step="1"></label>
        <button class="primario" type="submit">Adicionar</button>
      </form>
    </section>

    <section class="painel">
      <h2>Histórico</h2>
      ${s.trocas.length === 0 ? `<p class="vazio">Nenhuma troca registrada.</p>` : `
      <table>
        <thead><tr><th>Peça</th><th>Data</th><th class="num">Km</th><th class="num">Valor</th><th></th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>`}
    </section>`;
}

function blocoLimite(s: Save): string {
  if (s.limite === null) {
    return `
      <h2>Limite mensal</h2>
      <div class="limite-linha">
        <span class="aviso">Nenhum limite definido.</span>
        <button class="primario" data-acao="definir-limite">Definir limite</button>
      </div>`;
  }
  return `
    <h2>Limite mensal <button class="link" data-acao="remover-limite">remover</button></h2>
    <div class="limite-linha">
      <span class="limite-valor" id="limite-valor">${brl(s.limite)}</span>
      <input type="range" id="limite-range" min="0" max="${LIMITE_MAX}" step="50" value="${Math.min(s.limite, LIMITE_MAX)}" aria-label="Limite mensal">
    </div>
    <div class="barra"><div id="barra-gasto"></div></div>
    <div class="aviso" id="aviso-limite"></div>`;
}

function atualizarBarra(s: Save): void {
  const barra = document.getElementById("barra-gasto");
  const aviso = document.getElementById("aviso-limite");
  if (!barra || !aviso || s.limite === null) return;
  const gasto = somar(s.trocas.filter((t) => t.data.startsWith(mesAtual())));
  const pct = s.limite > 0 ? Math.min(100, (gasto / s.limite) * 100) : 100;
  barra.style.width = pct + "%";
  const resto = s.limite - gasto;
  let cor = "var(--ok)", cls = "aviso", msg = `Faltam ${brl(resto)} para o limite deste mês.`;
  if (gasto > s.limite) {
    cor = "var(--bad)"; cls = "aviso bad"; msg = `Limite estourado em ${brl(gasto - s.limite)}!`;
  } else if (s.limite > 0 && gasto / s.limite >= 0.8) {
    cor = "var(--warn)"; cls = "aviso warn"; msg = `Atenção: ${Math.round(pct)}% do limite usado. Restam ${brl(resto)}.`;
  }
  barra.style.background = cor;
  aviso.className = cls;
  aviso.textContent = `Gasto no mês: ${brl(gasto)}. ${msg}`;
}

function render(): void {
  const s = atual();
  if (!tipo) app.innerHTML = telaTipo();
  else if (!s) app.innerHTML = telaSaves();
  else {
    app.innerHTML = telaSave(s);
    atualizarBarra(s);
  }
  if (criando) (document.getElementById("nome-novo") as HTMLInputElement | null)?.focus();
}

/* ---------- eventos ---------- */

app.addEventListener("click", (e) => {
  const alvo = (e.target as HTMLElement).closest<HTMLElement>("[data-acao]");
  if (!alvo) return;
  const s = atual();
  switch (alvo.dataset.acao) {
    case "tipo": tipo = alvo.dataset.tipo as Tipo; break;
    case "voltar-tipo": tipo = null; criando = false; break;
    case "novo": criando = true; break;
    case "cancelar": criando = false; break;
    case "abrir": atualId = alvo.dataset.id as string; break;
    case "voltar-saves": atualId = null; break;
    case "exportar": exportarJSON(); return;
    case "importar": (document.getElementById("arquivo") as HTMLInputElement).click(); return;
    case "renomear": {
      if (!s) return;
      const n = prompt("Novo nome do save:", s.nome)?.trim();
      if (n) { s.nome = n; tocar(s); }
      break;
    }
    case "apagar-save":
      if (s && confirm(`Excluir o save "${s.nome}"? Isso não pode ser desfeito.`)) {
        saves = saves.filter((x) => x.id !== s.id);
        persistir();
        atualId = null;
      }
      break;
    case "apagar-troca":
      if (s) {
        s.trocas = s.trocas.filter((t) => t.id !== alvo.dataset.id);
        tocar(s);
      }
      break;
    case "definir-limite":
      if (s) { s.limite = LIMITE_PADRAO; tocar(s); }
      break;
    case "remover-limite":
      if (s) { s.limite = null; tocar(s); }
      break;
  }
  render();
});

app.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  if (form.id === "form-novo") {
    const nome = (document.getElementById("nome-novo") as HTMLInputElement).value.trim();
    if (!nome || !tipo) return;
    const novo: Save = { id: novoId(), nome, tipo, limite: null, trocas: [], atualizado: new Date().toISOString() };
    saves.push(novo);
    persistir();
    criando = false;
    atualId = novo.id;
    render();
  } else if (form.id === "form-troca") {
    const s = atual();
    if (!s) return;
    const f = new FormData(form);
    const km = Number(f.get("km"));
    s.trocas.push({
      id: novoId(),
      peca: String(f.get("peca")).trim(),
      custo: Number(f.get("custo")),
      data: String(f.get("data")),
      ...(km > 0 ? { km } : {}),
    });
    tocar(s);
    render();
  }
});

// Slider arrastável: atualiza ao vivo e salva ao soltar
app.addEventListener("input", (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id !== "limite-range") return;
  const s = atual();
  if (!s) return;
  s.limite = Number(el.value);
  (document.getElementById("limite-valor") as HTMLElement).textContent = brl(s.limite);
  atualizarBarra(s);
});

app.addEventListener("change", (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === "limite-range") {
    const s = atual();
    if (s) tocar(s);
  } else if (el.id === "arquivo" && el.files && el.files[0]) {
    importarJSON(el.files[0]);
  }
});

render();
