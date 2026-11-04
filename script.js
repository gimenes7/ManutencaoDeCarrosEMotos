"use strict";
const CHAVE = "controle-manutencao-v1";
const LIMITE_MAX = 25000;
const LIMITE_PADRAO = 500;
let editandoId = null;
const app = document.getElementById("app");
let saves = carregar();
let tipo = null;
let atualId = null;
let criando = false;
/* ---------- JSON / armazenamento ---------- */
function carregar() {
    try {
        const bruto = localStorage.getItem(CHAVE);
        if (!bruto)
            return [];
        const dados = JSON.parse(bruto);
        return Array.isArray(dados) ? dados : [];
    }
    catch {
        return [];
    }
}
function persistir() {
    try {
        localStorage.setItem(CHAVE, JSON.stringify(saves));
    }
    catch {
        alert("Não foi possível salvar no navegador.");
    }
}
function tocar(s) {
    s.atualizado = new Date().toISOString();
    persistir();
}
function exportarJSON() {
    const blob = new Blob([JSON.stringify(saves, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "manutencao-saves.json";
    a.click();
    URL.revokeObjectURL(a.href);
}
function importarJSON(arquivo) {
    arquivo.text().then((texto) => {
        try {
            const dados = JSON.parse(texto);
            if (!Array.isArray(dados))
                throw new Error();
            const validos = dados.filter((s) => s && typeof s.id === "string" && typeof s.nome === "string" &&
                (s.tipo === "carro" || s.tipo === "moto") && Array.isArray(s.trocas));
            for (const s of validos) {
                s.limite = typeof s.limite === "number" ? s.limite : null;
                const i = saves.findIndex((x) => x.id === s.id);
                if (i >= 0)
                    saves[i] = s;
                else
                    saves.push(s);
            }
            persistir();
            render();
            alert(`${validos.length} save(s) importado(s).`);
        }
        catch {
            alert("Arquivo JSON inválido.");
        }
    });
}
/* ---------- utilidades ---------- */
const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function esc(t) {
    return t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const hojeISO = () => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${dia}`;
};
const mesAtual = () => hojeISO().slice(0, 7);
function dataHora(iso) {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function dataBR(iso) {
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
}
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const emoji = (t) => (t === "carro" ? "🚗" : "🏍️");
function maisTrocada(trocas) {
    if (trocas.length === 0)
        return "—";
    const cont = new Map();
    for (const t of trocas) {
        const k = t.peca.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        const item = cont.get(k);
        if (item)
            item.n++;
        else
            cont.set(k, { nome: t.peca.trim(), n: 1 });
    }
    let melhor = { nome: "", n: 0 };
    cont.forEach((v) => { if (v.n > melhor.n)
        melhor = v; });
    return `${melhor.nome} (${melhor.n}x)`;
}
const somar = (trocas) => trocas.reduce((s, t) => s + t.custo, 0);
const atual = () => saves.find((s) => s.id === atualId);
/* ---------- telas ---------- */
function telaTipo() {
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
function telaSaves() {
    const t = tipo;
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
function telaSave(s) {
    const mes = mesAtual();
    const doMes = s.trocas.filter((t) => t.data.startsWith(mes));
    const ordenadas = [...s.trocas].sort((a, b) => b.data.localeCompare(a.data));
    const linhas = ordenadas.map((t) => `
    <li class="item">
      <div class="item-info">
        <b>${esc(t.peca)}</b>
        <small>${dataBR(t.data)}${t.km ? " · " + t.km.toLocaleString("pt-BR") + " km" : ""}</small>
      </div>
      <span class="item-valor">${brl(t.custo)}</span>
      <div class="item-acoes">
        <button class="icone" data-acao="editar-troca" data-id="${t.id}" aria-label="Editar">✏️</button>
        <button class="icone perigo" data-acao="apagar-troca" data-id="${t.id}" aria-label="Remover">🗑️</button>
      </div>
    </li>`).join("");
    const ed = editandoId ? s.trocas.find((t) => t.id === editandoId) : undefined;
    const sp = s.specs ?? {};
    const campo = (k, rotulo, extra = "") => `<label>${rotulo}<input type="text" name="${k}" value="${esc(sp[k] ?? "")}" ${extra}></label>`;
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

    <section class="painel" id="painel-troca">
      <h2>${ed ? "Editar troca" : "Registrar troca"}</h2>
      <form class="form" id="form-troca">
        <label class="f-peca">Peça / serviço<input type="text" name="peca" placeholder="Ex.: Óleo, pastilha..." required maxlength="60" value="${esc(ed?.peca ?? "")}"></label>
        <label>Valor (R$)<input type="number" name="custo" min="0" step="0.01" inputmode="decimal" required value="${ed?.custo ?? ""}"></label>
        <label>Data<input type="date" name="data" value="${ed?.data ?? hojeISO()}" required></label>
        <label>Km (opcional)<input type="number" name="km" min="0" step="1" inputmode="numeric" value="${ed?.km ?? ""}"></label>
        <div class="f-botoes">
          <button class="primario" type="submit">${ed ? "Salvar alteração" : "Adicionar"}</button>
          ${ed ? `<button type="button" data-acao="cancelar-edicao">Cancelar</button>` : ""}
        </div>
      </form>
    </section>

    <section class="painel">
      <h2>Histórico</h2>
      ${s.trocas.length === 0 ? `<p class="vazio">Nenhuma troca registrada.</p>` : `<ul class="lista">${linhas}</ul>`}
    </section>

    <section class="painel">
      <h2>Especificações do veículo</h2>
      <form id="form-specs">
        <div class="specs">
          ${campo("placa", "Placa", 'maxlength="8" autocapitalize="characters"')}
          ${campo("chassi", "Chassi", 'maxlength="20" autocapitalize="characters"')}
          ${campo("fabricante", "Fabricante")}
          ${campo("modelo", "Modelo")}
          ${campo("cor", "Cor")}
          ${campo("ano", "Ano", 'inputmode="numeric" maxlength="9"')}
          ${campo("tanque", "Tanque (litros)", 'inputmode="decimal"')}
          ${campo("km", "Quilometragem atual", 'inputmode="numeric"')}
        </div>
        <label class="obs">Observações
          <textarea name="obs" rows="4" placeholder="Anotações, lembretes, seguro, revisões...">${esc(s.obs ?? "")}</textarea>
        </label>
        <button class="primario" type="submit">Salvar especificações</button>
      </form>
    </section>`;
}
function blocoLimite(s) {
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
      <input type="number" id="limite-num" min="0" max="${LIMITE_MAX}" step="50" inputmode="numeric" value="${s.limite}" aria-label="Limite em reais">
    </div>
    <input type="range" id="limite-range" min="0" max="${LIMITE_MAX}" step="50" value="${Math.min(s.limite, LIMITE_MAX)}" aria-label="Limite mensal">
    <div class="range-escala"><span>R$ 0</span><span>R$ 25 mil</span></div>
    <div class="barra"><div id="barra-gasto"></div></div>
    <div class="aviso" id="aviso-limite"></div>`;
}
function atualizarBarra(s) {
    const barra = document.getElementById("barra-gasto");
    const aviso = document.getElementById("aviso-limite");
    if (!barra || !aviso || s.limite === null)
        return;
    const gasto = somar(s.trocas.filter((t) => t.data.startsWith(mesAtual())));
    const pct = s.limite > 0 ? Math.min(100, (gasto / s.limite) * 100) : 100;
    barra.style.width = pct + "%";
    const resto = s.limite - gasto;
    let cor = "var(--ok)", cls = "aviso", msg = `Faltam ${brl(resto)} para o limite deste mês.`;
    if (gasto > s.limite) {
        cor = "var(--bad)";
        cls = "aviso bad";
        msg = `Limite estourado em ${brl(gasto - s.limite)}!`;
    }
    else if (s.limite > 0 && gasto / s.limite >= 0.8) {
        cor = "var(--warn)";
        cls = "aviso warn";
        msg = `Atenção: ${Math.round(pct)}% do limite usado. Restam ${brl(resto)}.`;
    }
    barra.style.background = cor;
    aviso.className = cls;
    aviso.textContent = `Gasto no mês: ${brl(gasto)}. ${msg}`;
}
function render() {
    const s = atual();
    if (!tipo)
        app.innerHTML = telaTipo();
    else if (!s)
        app.innerHTML = telaSaves();
    else {
        app.innerHTML = telaSave(s);
        atualizarBarra(s);
    }
    if (criando)
        document.getElementById("nome-novo")?.focus();
}
/* ---------- eventos ---------- */
app.addEventListener("click", (e) => {
    const alvo = e.target.closest("[data-acao]");
    if (!alvo)
        return;
    const s = atual();
    switch (alvo.dataset.acao) {
        case "tipo":
            tipo = alvo.dataset.tipo;
            break;
        case "voltar-tipo":
            tipo = null;
            criando = false;
            break;
        case "novo":
            criando = true;
            break;
        case "cancelar":
            criando = false;
            break;
        case "abrir":
            atualId = alvo.dataset.id;
            break;
        case "voltar-saves":
            atualId = null;
            editandoId = null;
            break;
        case "exportar":
            exportarJSON();
            return;
        case "importar":
            document.getElementById("arquivo").click();
            return;
        case "renomear": {
            if (!s)
                return;
            const n = prompt("Novo nome do save:", s.nome)?.trim();
            if (n) {
                s.nome = n;
                tocar(s);
            }
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
            if (s && confirm("Remover esta troca?")) {
                s.trocas = s.trocas.filter((t) => t.id !== alvo.dataset.id);
                if (editandoId === alvo.dataset.id)
                    editandoId = null;
                tocar(s);
            }
            break;
        case "editar-troca":
            editandoId = alvo.dataset.id;
            render();
            document.getElementById("painel-troca")?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        case "cancelar-edicao":
            editandoId = null;
            break;
        case "definir-limite":
            if (s) {
                s.limite = LIMITE_PADRAO;
                tocar(s);
            }
            break;
        case "remover-limite":
            if (s) {
                s.limite = null;
                tocar(s);
            }
            break;
    }
    render();
});
app.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    if (form.id === "form-novo") {
        const nome = document.getElementById("nome-novo").value.trim();
        if (!nome || !tipo)
            return;
        const novo = { id: novoId(), nome, tipo, limite: null, trocas: [], atualizado: new Date().toISOString() };
        saves.push(novo);
        persistir();
        criando = false;
        atualId = novo.id;
        render();
    }
    else if (form.id === "form-troca") {
        const s = atual();
        if (!s)
            return;
        const f = new FormData(form);
        const km = Number(f.get("km"));
        const dados = {
            peca: String(f.get("peca")).trim(),
            custo: Number(f.get("custo")),
            data: String(f.get("data")),
            km: km > 0 ? km : undefined,
        };
        const existente = editandoId ? s.trocas.find((t) => t.id === editandoId) : undefined;
        if (existente)
            Object.assign(existente, dados);
        else
            s.trocas.push({ id: novoId(), ...dados });
        editandoId = null;
        tocar(s);
        render();
    }
    else if (form.id === "form-specs") {
        const s = atual();
        if (!s)
            return;
        const f = new FormData(form);
        const chaves = ["placa", "chassi", "fabricante", "modelo", "cor", "ano", "tanque", "km"];
        const specs = {};
        for (const k of chaves)
            specs[k] = String(f.get(k) ?? "").trim();
        specs.placa = (specs.placa ?? "").toUpperCase();
        specs.chassi = (specs.chassi ?? "").toUpperCase();
        s.specs = specs;
        s.obs = String(f.get("obs") ?? "").trim();
        tocar(s);
        render();
        const btn = document.querySelector("#form-specs button[type=submit]");
        if (btn) {
            btn.textContent = "Salvo ✓";
            setTimeout(() => (btn.textContent = "Salvar especificações"), 1500);
        }
    }
});
// Slider arrastável: atualiza ao vivo e salva ao soltar
app.addEventListener("input", (e) => {
    const el = e.target;
    if (el.id !== "limite-range" && el.id !== "limite-num")
        return;
    const s = atual();
    if (!s)
        return;
    const v = Math.max(0, Number(el.value) || 0);
    s.limite = v;
    document.getElementById("limite-valor").textContent = brl(v);
    if (el.id === "limite-range")
        document.getElementById("limite-num").value = String(v);
    else
        document.getElementById("limite-range").value = String(Math.min(v, LIMITE_MAX));
    atualizarBarra(s);
});
app.addEventListener("change", (e) => {
    const el = e.target;
    if (el.id === "limite-range" || el.id === "limite-num") {
        const s = atual();
        if (s)
            tocar(s);
    }
    else if (el.id === "arquivo" && el.files && el.files[0]) {
        importarJSON(el.files[0]);
    }
});
render();
