import { useState, useEffect, useMemo, useRef } from "react";
import {
  Send, Sparkles, Users, CalendarDays, BarChart3, Copy, ExternalLink, Check,
  Plus, Trash2, Settings, Clock, X, RefreshCw, Image as ImageIcon,
  AlertTriangle, Download, Pencil, Minus,
} from "lucide-react";

/* ---------- utilitários ---------- */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayKey = (d) => toISO(d).slice(0, 10);
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const fmtDay = (d) => `${DIAS[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function waLink(num) {
  let n = String(num || "").replace(/\D/g, "");
  if (n.length === 9 && n.startsWith("9")) n = "244" + n;
  return n ? `https://wa.me/${n}` : "";
}

async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch (e) {
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e2) {
      return false;
    }
  }
}

/* ---------- dados base ---------- */
const TIPOS = [
  { id: "servico", nome: "Serviço", dica: "foca em confiança, rapidez e resultado garantido" },
  { id: "produto", nome: "Produto / loja", dica: "foca em qualidade, preço e disponibilidade" },
  { id: "comida", nome: "Restaurante / comida", dica: "foca em sabor, entrega e pedido fácil" },
  { id: "vaga", nome: "Vaga / emprego", dica: "foca em requisitos, benefícios e como candidatar" },
  { id: "imovel", nome: "Imóveis / arrendamento", dica: "foca em localização, condições e visita" },
  { id: "digital", nome: "Serviço digital", dica: "foca em modernizar o negócio e ganhar clientes" },
  { id: "outro", nome: "Outro", dica: "foca no benefício principal para o cliente" },
];
const TONS = ["Popular e próximo", "Profissional", "Urgente (promoção)"];
const HORAS_SUGERIDAS = ["07:30", "12:30", "18:30", "20:00"];

const INIT = {
  settings: { negocio: "", whatsapp: "", cidade: "Luanda", cooldownDias: 3 },
  campaigns: [],
  groups: [],
  items: [],
};

const novaCampanha = () => ({
  id: uid(), nome: "", tipo: "servico", descricao: "", preco: "", promo: "",
  tom: TONS[0], incWpp: true, incCidade: true, texts: [],
});

/* ---------- gerador de texto ---------- */
function rodape(c, s) {
  const p = [];
  const l = waLink(s.whatsapp);
  if (c.incWpp !== false && l) p.push(`📲 WhatsApp: ${l}`);
  if (c.incCidade && s.cidade) p.push(`📍 ${s.cidade}`);
  return p.length ? "\n\n" + p.join("\n") : "";
}

async function gerarIA(c, s, qtd = 4) {
  const tipo = TIPOS.find((t) => t.id === c.tipo) || TIPOS[0];
  const prompt = `Cria ${qtd} publicações DIFERENTES para grupos de Facebook, em português de Angola, simples e direto.

Produto/serviço: ${c.nome}
Tipo: ${tipo.nome} (${tipo.dica})
Detalhes: ${c.descricao || "não indicados"}
Preço: ${c.preco || "não indicado"}
Promoção/oferta: ${c.promo || "nenhuma"}
Tom: ${c.tom}
Negócio: ${s.negocio || "não indicado"}
Cidade: ${s.cidade || "Luanda"}

Regras:
- Máximo 380 caracteres cada.
- A 1.ª linha é um gancho forte que faz parar de rolar o feed.
- Linhas curtas, 2 a 4 emojis, benefícios claros, no máximo 2 hashtags.
- Termina com chamada à ação para enviar mensagem.
- NÃO inventes preços, descontos, prazos, contactos nem links. Usa só o que foi dado.
- NÃO escrevas o contacto no fim: a app acrescenta.
- Cada variação com estrutura diferente (pergunta, lista de vantagens, oferta, confiança/prova, urgência).

Responde só com JSON: {"textos":["...","..."]}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: "És um copywriter especialista em publicações para grupos de Facebook em Angola. Respondes APENAS com JSON válido, sem markdown e sem texto extra.",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const txt = (data.content || []).map((i) => (i.type === "text" ? i.text : "")).join("");
  const clean = txt.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);
  return (parsed.textos || []).filter((t) => typeof t === "string" && t.trim());
}

function gerarLocal(c) {
  const n = c.nome || "o nosso serviço";
  const p = c.preco ? `💰 Preço: ${c.preco}` : "";
  const pr = c.promo ? `🔥 ${c.promo}` : "";
  const d = (c.descricao || "").trim();
  return [
    [`📢 Precisa de ${n}?`, d, pr, p, "Envie mensagem agora e peça mais informações."],
    [`✅ ${n} com qualidade e rapidez`, d, pr, p, "Atendimento rápido. Fale connosco!"],
    [`🔥 Atenção! ${n}`, d, pr || "Vagas limitadas.", p, "Chame no WhatsApp e garanta já o seu."],
    [`Está à procura de ${n}? Chegou ao sítio certo 👇`, d, pr, p, 'Envie "Quero" e respondemos já.'],
  ].map((a) => a.filter(Boolean).join("\n\n"));
}

/* ---------- estilos ---------- */
const CSS = `
.ap{--ink:#12203A;--paper:#F3F5F9;--card:#fff;--sun:#F4A300;--mute:#5B6578;--line:#DDE2EC;--ok:#17915F;--bad:#D14343;--blue:#2F5BEA;
font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--paper);color:var(--ink);min-height:100vh;padding-bottom:92px;font-size:15px;line-height:1.4}
.ap *{box-sizing:border-box}
.ap button,.ap input,.ap select,.ap textarea{font:inherit;color:inherit}
.ap :focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.top{background:var(--ink);color:#fff;padding:18px 16px 20px;display:flex;justify-content:space-between;align-items:flex-start;position:sticky;top:0;z-index:5}
.top h1{margin:0;font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
.top p{margin:4px 0 0;color:#B9C3D9;font-size:13px}
.ic{background:transparent;border:0;padding:8px;border-radius:10px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.top .ic{color:#fff;background:rgba(255,255,255,.1)}
.wrap{padding:14px 14px 0;max-width:640px;margin:0 auto}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}
.card h3{margin:0 0 8px;font-size:16px;font-weight:700}
.sec{font-size:13px;font-weight:700;color:var(--mute);margin:18px 2px 8px}
.row{display:flex;gap:8px;align-items:center}
.sp{justify-content:space-between}
.wrapx{flex-wrap:wrap}
.mute{color:var(--mute);font-size:13px}
.btn{border:1.5px solid var(--line);background:#fff;border-radius:12px;padding:11px 14px;font-weight:650;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;min-height:44px}
.btn.p{background:var(--sun);border-color:var(--sun);color:var(--ink)}
.btn.d{background:var(--ink);border-color:var(--ink);color:#fff}
.btn.ok{background:var(--ok);border-color:var(--ok);color:#fff}
.btn.sm{padding:7px 10px;min-height:36px;font-size:13px;border-radius:10px}
.btn.full{width:100%}
.btn[disabled]{opacity:.5;cursor:not-allowed}
.fl{display:block;margin-bottom:10px}
.fl>span{display:block;font-size:13px;font-weight:650;margin-bottom:4px}
.in{width:100%;border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;background:#fff;min-height:44px}
textarea.in{min-height:84px;resize:vertical}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{border:1.5px solid var(--line);background:#fff;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer;min-height:36px}
.chip.on{background:var(--ink);border-color:var(--ink);color:#fff}
.tabs{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(5,1fr);z-index:6;padding-bottom:env(safe-area-inset-bottom)}
.tab{background:transparent;border:0;padding:9px 2px 8px;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11.5px;font-weight:650;color:var(--mute);cursor:pointer;position:relative}
.tab.on{color:var(--ink)}
.tab.on::before{content:"";position:absolute;top:0;left:22%;right:22%;height:3px;background:var(--sun);border-radius:0 0 3px 3px}
.badge{position:absolute;top:4px;left:calc(50% + 8px);background:var(--bad);color:#fff;border-radius:999px;font-size:10.5px;min-width:17px;height:17px;display:flex;align-items:center;justify-content:center;padding:0 4px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
.stat{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.stat b{display:block;font-size:24px;font-weight:800;letter-spacing:-.02em}
.stat span{font-size:12px;color:var(--mute)}
.post{display:grid;grid-template-columns:62px 1fr;gap:12px;background:#fff;border:1px solid var(--line);border-left:5px solid var(--line);border-radius:14px;padding:12px;margin-bottom:10px}
.post.due{border-left-color:var(--sun)}
.post.late{border-left-color:var(--bad)}
.post.done{border-left-color:var(--ok);opacity:.85}
.hr{font-size:21px;font-weight:800;letter-spacing:-.02em;line-height:1}
.hr small{display:block;font-size:11.5px;font-weight:650;color:var(--mute);margin-top:5px;letter-spacing:0}
.pv{background:var(--paper);border-radius:10px;padding:9px 10px;margin:8px 0;font-size:13.5px;white-space:pre-wrap;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.pv.open{display:block;-webkit-line-clamp:unset}
.tag{display:inline-block;font-size:11.5px;font-weight:700;border-radius:6px;padding:2px 7px;background:var(--paper);color:var(--mute)}
.tag.s{background:#FFF1CF;color:#6B4700}.tag.r{background:#FBE0E0;color:#8E2020}.tag.g{background:#D9F2E7;color:#0D5C3B}
.ov{position:fixed;inset:0;background:rgba(18,32,58,.55);z-index:20;display:flex;align-items:flex-end;justify-content:center}
.sheet{background:var(--paper);width:100%;max-width:640px;max-height:92vh;border-radius:18px 18px 0 0;display:flex;flex-direction:column}
.sh-h{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--line);font-size:17px}
.sh-b{padding:14px;overflow:auto}
.warn{background:#FFF4D6;border:1px solid #F1D48A;color:#5B4300;border-radius:10px;padding:9px 11px;font-size:13px;margin-bottom:8px;display:flex;gap:8px}
.err{background:#FBE0E0;border:1px solid #EBB4B4;color:#7A1C1C;border-radius:10px;padding:9px 11px;font-size:13px;margin-bottom:8px}
.toast{position:fixed;left:50%;transform:translateX(-50%);bottom:96px;background:var(--ink);color:#fff;padding:10px 16px;border-radius:12px;z-index:30;font-size:14px;max-width:90vw;text-align:center}
.bar{height:8px;background:var(--paper);border-radius:6px;overflow:hidden;margin-top:6px}
.bar>i{display:block;height:100%;background:var(--sun)}
.cnt{display:flex;align-items:center;gap:6px}
.cnt button{width:34px;height:34px;border-radius:9px;border:1.5px solid var(--line);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}
.cnt b{min-width:22px;text-align:center}
.gsel{display:flex;align-items:center;gap:10px;padding:9px 10px;border:1.5px solid var(--line);border-radius:10px;background:#fff;margin-bottom:6px;cursor:pointer;width:100%;text-align:left}
.gsel.on{border-color:var(--ink);background:#EEF1F8}
.box{width:20px;height:20px;border-radius:6px;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;flex:none}
.gsel.on .box{background:var(--ink);border-color:var(--ink);color:#fff}
.empty{text-align:center;padding:26px 16px;color:var(--mute)}
.empty b{display:block;color:var(--ink);font-size:16px;margin-bottom:4px}
.fly{width:100%;border-radius:12px;border:1px solid var(--line);display:block}
@media (prefers-reduced-motion:no-preference){.btn,.chip,.tab{transition:background .15s,border-color .15s}}
`;

/* ---------- componentes pequenos ---------- */
function Sheet({ title, onClose, children }) {
  return (
    <div className="ov" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sh-h">
          <b>{title}</b>
          <button className="ic" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>
        <div className="sh-b">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="fl">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Counter({ label, value, onChange }) {
  return (
    <div className="row sp" style={{ marginBottom: 8 }}>
      <span style={{ fontSize: 14 }}>{label}</span>
      <div className="cnt">
        <button onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Menos ${label}`}><Minus size={16} /></button>
        <b>{value}</b>
        <button onClick={() => onChange(value + 1)} aria-label={`Mais ${label}`}><Plus size={16} /></button>
      </div>
    </div>
  );
}

function DayChips({ value, onChange }) {
  return (
    <div className="chips">
      {DIAS.map((d, i) => (
        <button
          key={i}
          className={"chip" + (value.includes(i) ? " on" : "")}
          onClick={() => onChange(value.includes(i) ? value.filter((x) => x !== i) : [...value, i])}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

/* ---------- app ---------- */
export default function App() {
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("hoje");
  const [now, setNow] = useState(Date.now());
  const [msg, setMsg] = useState("");
  const [showSet, setShowSet] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("ajudante-state");
        setState(r ? { ...INIT, ...JSON.parse(r.value) } : INIT);
      } catch (e) {
        setState(INIT);
      }
    })();
  }, []);

  useEffect(() => {
    if (!state) return;
    const t = setTimeout(async () => {
      try { await window.storage.set("ajudante-state", JSON.stringify(state)); } catch (e) { /* sem armazenamento */ }
    }, 400);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const toast = (m) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 2600);
  };
  const patch = (fn) => setState((s) => fn(s));

  if (!state) return <div className="ap"><style>{CSS}</style><div className="wrap"><div className="empty">A carregar…</div></div></div>;

  const todayKey = dayKey(new Date(now));
  const dueCount = state.items.filter((i) => i.status === "pendente" && new Date(i.when).getTime() <= now).length;
  const titles = { hoje: "Hoje", criar: "Criar anúncios", grupos: "Grupos", agenda: "Agenda", result: "Resultados" };
  const sub = { hoje: fmtDay(new Date(now)), criar: "Textos e imagem prontos para vender", grupos: `${state.groups.length} grupo(s) guardado(s)`, agenda: "Tudo o que está programado", result: "O que está a dar clientes" };

  const tabsDef = [
    ["hoje", "Hoje", Send], ["criar", "Criar", Sparkles], ["grupos", "Grupos", Users],
    ["agenda", "Agenda", CalendarDays], ["result", "Resultados", BarChart3],
  ];

  return (
    <div className="ap">
      <style>{CSS}</style>
      <header className="top">
        <div>
          <h1>{titles[tab]}</h1>
          <p>{sub[tab]}</p>
        </div>
        <button className="ic" onClick={() => setShowSet(true)} aria-label="Definições"><Settings size={20} /></button>
      </header>

      <main className="wrap">
        {tab === "hoje" && <Hoje state={state} patch={patch} now={now} todayKey={todayKey} toast={toast} go={setTab} />}
        {tab === "criar" && <Criar state={state} patch={patch} toast={toast} go={setTab} />}
        {tab === "grupos" && <Grupos state={state} patch={patch} toast={toast} />}
        {tab === "agenda" && <Agenda state={state} patch={patch} toast={toast} />}
        {tab === "result" && <Resultados state={state} patch={patch} />}
      </main>

      <nav className="tabs" aria-label="Navegação">
        {tabsDef.map(([id, nome, Ic]) => (
          <button key={id} className={"tab" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>
            <Ic size={22} />
            {nome}
            {id === "hoje" && dueCount > 0 && <span className="badge">{dueCount}</span>}
          </button>
        ))}
      </nav>

      {showSet && <Definicoes state={state} patch={patch} setState={setState} onClose={() => setShowSet(false)} toast={toast} />}
      {msg && <div className="toast" role="status">{msg}</div>}
    </div>
  );
}

/* ---------- HOJE ---------- */
function Hoje({ state, patch, now, todayKey, toast, go }) {
  const gMap = Object.fromEntries(state.groups.map((g) => [g.id, g]));
  const cMap = Object.fromEntries(state.campaigns.map((c) => [c.id, c]));
  const due = state.items
    .filter((i) => i.status === "pendente" && dayKey(new Date(i.when)) <= todayKey)
    .sort((a, b) => a.when.localeCompare(b.when));
  const feitas = state.items.filter((i) => i.status === "publicado" && i.postedAt && dayKey(new Date(i.postedAt)) === todayKey);
  const prox = state.items
    .filter((i) => i.status === "pendente" && dayKey(new Date(i.when)) > todayKey)
    .sort((a, b) => a.when.localeCompare(b.when))
    .slice(0, 4);
  const atrasadas = due.filter((i) => new Date(i.when).getTime() < now - 3600000).length;

  const setItem = (id, p) => patch((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }));

  return (
    <>
      <div className="stats">
        <div className="stat"><b>{due.length}</b><span>Por publicar</span></div>
        <div className="stat"><b>{feitas.length}</b><span>Publicadas hoje</span></div>
        <div className="stat"><b>{atrasadas}</b><span>Atrasadas</span></div>
      </div>

      {due.length === 0 && (
        <div className="card empty">
          <b>Nada para publicar agora</b>
          {state.items.length === 0
            ? "Cria um anúncio e programa as publicações para os teus grupos."
            : "Tudo em dia. As próximas publicações aparecem abaixo."}
          <div style={{ marginTop: 12 }}>
            <button className="btn p" onClick={() => go("criar")}><Sparkles size={18} />Criar anúncio</button>
          </div>
        </div>
      )}

      {due.map((it) => (
        <PostCard
          key={it.id} it={it} g={gMap[it.groupId]} c={cMap[it.campaignId]} now={now}
          onDone={() => { setItem(it.id, { status: "publicado", postedAt: new Date().toISOString() }); toast("Marcada como publicada."); }}
          onSnooze={() => { const base = Math.max(now, new Date(it.when).getTime()); setItem(it.id, { when: toISO(new Date(base + 3600000)) }); toast("Adiada 1 hora."); }}
          onSkip={() => { setItem(it.id, { status: "ignorado" }); toast("Publicação ignorada."); }}
          toast={toast}
        />
      ))}

      {prox.length > 0 && (
        <>
          <div className="sec">Próximas</div>
          {prox.map((it) => {
            const d = new Date(it.when);
            return (
              <div className="card row sp" key={it.id} style={{ padding: 12 }}>
                <div>
                  <b>{gMap[it.groupId]?.nome || "Grupo removido"}</b>
                  <div className="mute">{cMap[it.campaignId]?.nome}</div>
                </div>
                <span className="tag">{fmtDay(d)} · {fmtTime(d)}</span>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

function PostCard({ it, g, c, now, onDone, onSnooze, onSkip, toast }) {
  const [open, setOpen] = useState(false);
  const d = new Date(it.when);
  const diff = Math.round((d.getTime() - now) / 60000);
  const late = diff < -60;
  const isDue = diff <= 0;
  const label = late ? "Atrasada" : isDue ? "Publicar agora" : `Em ${diff} min`;
  const copiar = async () => {
    const ok = await copyText(it.text);
    toast(ok ? "Texto copiado. Cola no grupo." : "Não consegui copiar. Toca no texto e copia à mão.");
  };
  return (
    <div className={"post " + (late ? "late" : isDue ? "due" : "")}>
      <div className="hr">{fmtTime(d)}<small>{dayKey(d) === dayKey(new Date(now)) ? "hoje" : fmtDay(d)}</small></div>
      <div>
        <div className="row sp">
          <b>{g?.nome || "Grupo removido"}</b>
          <span className={"tag " + (late ? "r" : "s")}>{label}</span>
        </div>
        {c && <div className="mute">{c.nome}</div>}
        {g?.regras && <div className="mute" style={{ marginTop: 4 }}>Regra: {g.regras}</div>}
        <div className={"pv" + (open ? " open" : "")} onClick={() => setOpen(!open)}>{it.text}</div>
        <div className="row wrapx">
          {g?.url ? (
            <a className="btn p" href={g.url} target="_blank" rel="noopener noreferrer" onClick={copiar}>
              <ExternalLink size={18} />Copiar e abrir grupo
            </a>
          ) : (
            <button className="btn p" onClick={() => { copiar(); toast("Este grupo não tem link. Adiciona em Grupos."); }}>
              <Copy size={18} />Copiar texto
            </button>
          )}
          <button className="btn ok" onClick={onDone}><Check size={18} />Feito</button>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn sm" onClick={onSnooze}><Clock size={15} />+1 hora</button>
          <button className="btn sm" onClick={onSkip}>Ignorar</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- CRIAR ---------- */
function Criar({ state, patch, toast, go }) {
  const [sel, setSel] = useState(state.campaigns[0]?.id || null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [prog, setProg] = useState(false);
  const c = state.campaigns.find((x) => x.id === sel);

  const setC = (p) => patch((s) => ({ ...s, campaigns: s.campaigns.map((x) => (x.id === sel ? { ...x, ...p } : x)) }));
  const nova = () => {
    const n = novaCampanha();
    patch((s) => ({ ...s, campaigns: [n, ...s.campaigns] }));
    setSel(n.id);
  };
  const apagar = () => {
    patch((s) => ({
      ...s,
      campaigns: s.campaigns.filter((x) => x.id !== sel),
      items: s.items.filter((i) => i.campaignId !== sel || i.status === "publicado"),
    }));
    setSel(state.campaigns.find((x) => x.id !== sel)?.id || null);
  };

  async function gerar() {
    if (!c.nome.trim()) { setErr("Escreve o nome do produto ou serviço."); return; }
    setBusy(true);
    setErr("");
    let arr = null;
    try { arr = await gerarIA(c, state.settings, 4); } catch (e) { arr = null; }
    let local = false;
    if (!arr || !arr.length) { arr = gerarLocal(c); local = true; }
    const foot = rodape(c, state.settings);
    const novos = arr.map((t) => ({ id: uid(), text: t.trim() + foot }));
    patch((s) => ({
      ...s,
      campaigns: s.campaigns.map((x) => (x.id === c.id ? { ...x, texts: [...novos, ...x.texts] } : x)),
    }));
    setBusy(false);
    if (local) toast("IA indisponível. Usei modelos prontos.");
  }

  const setText = (id, text) => setC({ texts: c.texts.map((t) => (t.id === id ? { ...t, text } : t)) });
  const delText = (id) => setC({ texts: c.texts.filter((t) => t.id !== id) });

  return (
    <>
      <div className="chips" style={{ marginBottom: 12 }}>
        <button className="chip on" style={{ background: "var(--sun)", borderColor: "var(--sun)", color: "var(--ink)" }} onClick={nova}>+ Nova campanha</button>
        {state.campaigns.map((x) => (
          <button key={x.id} className={"chip" + (x.id === sel ? " on" : "")} onClick={() => setSel(x.id)}>{x.nome || "Sem nome"}</button>
        ))}
      </div>

      {!c && (
        <div className="card empty">
          <b>Começa por uma campanha</b>
          Uma campanha é o produto ou serviço que queres vender nos grupos.
          <div style={{ marginTop: 12 }}><button className="btn p" onClick={nova}><Plus size={18} />Nova campanha</button></div>
        </div>
      )}

      {c && (
        <>
          <div className="card">
            <Field label="O que vendes?">
              <input className="in" value={c.nome} onChange={(e) => setC({ nome: e.target.value })} placeholder="Ex.: Croquis de localização" />
            </Field>
            <Field label="Tipo">
              <select className="in" value={c.tipo} onChange={(e) => setC({ tipo: e.target.value })}>
                {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </Field>
            <Field label="Detalhes e vantagens">
              <textarea className="in" value={c.descricao} onChange={(e) => setC({ descricao: e.target.value })} placeholder="Ex.: Entrega em 24h, documento com GPS, aceito em licenças e registo." />
            </Field>
            <div className="row">
              <div style={{ flex: 1 }}><Field label="Preço"><input className="in" value={c.preco} onChange={(e) => setC({ preco: e.target.value })} placeholder="Ex.: 15.000 Kz" /></Field></div>
              <div style={{ flex: 1 }}><Field label="Promoção"><input className="in" value={c.promo} onChange={(e) => setC({ promo: e.target.value })} placeholder="Ex.: -10% esta semana" /></Field></div>
            </div>
            <Field label="Tom do texto">
              <div className="chips">
                {TONS.map((t) => <button key={t} className={"chip" + (c.tom === t ? " on" : "")} onClick={() => setC({ tom: t })}>{t}</button>)}
              </div>
            </Field>
            <div className="chips" style={{ marginBottom: 12 }}>
              <button className={"chip" + (c.incWpp !== false ? " on" : "")} onClick={() => setC({ incWpp: c.incWpp === false })}>Link do WhatsApp no fim</button>
              <button className={"chip" + (c.incCidade ? " on" : "")} onClick={() => setC({ incCidade: !c.incCidade })}>Cidade no fim</button>
            </div>
            {!state.settings.whatsapp && c.incWpp !== false && (
              <div className="warn"><AlertTriangle size={18} style={{ flex: "none" }} />Falta o teu número de WhatsApp. Toca na engrenagem no topo para o adicionar.</div>
            )}
            {err && <div className="err">{err}</div>}
            <button className="btn p full" onClick={gerar} disabled={busy}>
              {busy ? <RefreshCw size={18} /> : <Sparkles size={18} />}
              {busy ? "A criar textos…" : c.texts.length ? "Gerar mais variações" : "Gerar textos de venda"}
            </button>
          </div>

          {c.texts.length > 0 && (
            <>
              <div className="sec">Textos ({c.texts.length}). Edita à vontade.</div>
              {c.texts.map((t, i) => (
                <div className="card" key={t.id}>
                  <div className="row sp" style={{ marginBottom: 6 }}>
                    <span className="tag">Variação {c.texts.length - i}</span>
                    <div className="row">
                      <button className="btn sm" onClick={async () => toast((await copyText(t.text)) ? "Texto copiado." : "Não consegui copiar.")}><Copy size={15} />Copiar</button>
                      <button className="btn sm" onClick={() => delText(t.id)} aria-label="Apagar texto"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <textarea className="in" style={{ minHeight: 150 }} value={t.text} onChange={(e) => setText(t.id, e.target.value)} />
                  <div className="mute" style={{ marginTop: 4 }}>{t.text.length} caracteres</div>
                </div>
              ))}
              <button className="btn d full" onClick={() => setProg(true)}><CalendarDays size={18} />Programar publicações</button>
            </>
          )}

          <Flyer c={c} s={state.settings} />

          <div style={{ marginTop: 16 }}>
            <button className="btn sm" onClick={apagar}><Trash2 size={15} />Apagar esta campanha</button>
          </div>

          {prog && <Programar c={c} state={state} patch={patch} toast={toast} onClose={() => setProg(false)} go={go} />}
        </>
      )}
    </>
  );
}

/* ---------- Imagem do anúncio ---------- */
const THEMES = [
  { n: "Azul", bg: "#12203A", fg: "#FFFFFF", ac: "#F4A300", acfg: "#12203A" },
  { n: "Preto", bg: "#151515", fg: "#FFFFFF", ac: "#F4A300", acfg: "#151515" },
  { n: "Verde", bg: "#0E5A43", fg: "#FFFFFF", ac: "#FFD84D", acfg: "#0E3A2B" },
  { n: "Vermelho", bg: "#B3261E", fg: "#FFFFFF", ac: "#FFFFFF", acfg: "#B3261E" },
];

function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  words.forEach((w) => {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  });
  if (cur) lines.push(cur);
  return lines;
}

function Flyer({ c, s }) {
  const [f, setF] = useState({ titulo: "", sub: "", preco: "", tema: 0 });
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);
  const titulo = f.titulo || c.nome || "O teu anúncio";
  const sub = f.sub || c.promo || "";
  const preco = f.preco || c.preco || "";

  useEffect(() => {
    if (!open) return;
    const cv = document.createElement("canvas");
    cv.width = 1080; cv.height = 1080;
    const x = cv.getContext("2d");
    const T = THEMES[f.tema];
    const font = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    x.fillStyle = T.bg; x.fillRect(0, 0, 1080, 1080);
    x.fillStyle = T.ac; x.fillRect(0, 0, 1080, 26);
    x.fillStyle = T.fg; x.textBaseline = "top";
    x.font = `700 40px ${font}`;
    x.fillText((s.negocio || "").toUpperCase().slice(0, 34), 80, 90);
    const size = titulo.length > 40 ? 78 : titulo.length > 22 ? 96 : 120;
    x.font = `800 ${size}px ${font}`;
    const lines = wrap(x, titulo, 920).slice(0, 4);
    let y = 200;
    lines.forEach((l) => { x.fillText(l, 80, y); y += size * 1.1; });
    y += 24;
    if (sub) {
      x.fillStyle = T.ac; x.font = `700 54px ${font}`;
      wrap(x, sub, 920).slice(0, 2).forEach((l) => { x.fillText(l, 80, y); y += 66; });
      y += 20;
    }
    if (preco) {
      x.font = `800 84px ${font}`;
      const w = Math.min(x.measureText(preco).width + 80, 920);
      x.fillStyle = T.ac;
      if (x.roundRect) { x.beginPath(); x.roundRect(80, y, w, 130, 24); x.fill(); } else x.fillRect(80, y, w, 130);
      x.fillStyle = T.acfg; x.fillText(preco, 120, y + 22);
    }
    x.fillStyle = "rgba(255,255,255,.12)"; x.fillRect(0, 900, 1080, 180);
    x.fillStyle = T.fg; x.font = `800 58px ${font}`;
    const tel = String(s.whatsapp || "").trim();
    x.fillText(tel ? `WhatsApp ${tel}` : "Fale connosco", 80, 930);
    x.font = `600 38px ${font}`;
    x.fillText(s.cidade ? `📍 ${s.cidade}` : "", 80, 1005);
    setUrl(cv.toDataURL("image/png"));
  }, [open, titulo, sub, preco, f.tema, s.whatsapp, s.negocio, s.cidade]);

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="row sp">
        <h3 style={{ margin: 0 }}>Imagem para o anúncio</h3>
        <button className="btn sm" onClick={() => setOpen(!open)}><ImageIcon size={16} />{open ? "Fechar" : "Criar imagem"}</button>
      </div>
      <div className="mute" style={{ marginTop: 4 }}>Publicações com imagem chamam mais atenção nos grupos.</div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <Field label="Título"><input className="in" value={f.titulo} placeholder={c.nome} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></Field>
          <Field label="Linha de destaque"><input className="in" value={f.sub} placeholder={c.promo || "Ex.: Entrega em 24h"} onChange={(e) => setF({ ...f, sub: e.target.value })} /></Field>
          <Field label="Preço"><input className="in" value={f.preco} placeholder={c.preco} onChange={(e) => setF({ ...f, preco: e.target.value })} /></Field>
          <div className="chips" style={{ marginBottom: 12 }}>
            {THEMES.map((t, i) => <button key={t.n} className={"chip" + (f.tema === i ? " on" : "")} onClick={() => setF({ ...f, tema: i })}>{t.n}</button>)}
          </div>
          {url && <img className="fly" src={url} alt="Pré-visualização da imagem do anúncio" />}
          <div className="mute" style={{ margin: "6px 0 10px" }}>No telemóvel, mantém o dedo na imagem para a guardar.</div>
          <a className="btn d full" href={url} download="anuncio.png"><Download size={18} />Descarregar imagem</a>
        </div>
      )}
    </div>
  );
}

/* ---------- Programar publicações ---------- */
function Programar({ c, state, patch, toast, onClose, go }) {
  const groups = state.groups.filter((g) => g.ativo !== false);
  const [selG, setSelG] = useState([]);
  const [data, setData] = useState(dayKey(new Date(Date.now() + (new Date().getHours() >= 20 ? 86400000 : 0))));
  const [hora, setHora] = useState("12:30");
  const [gap, setGap] = useState(15);
  const [vary, setVary] = useState(true);
  const [textId, setTextId] = useState(c.texts[0]?.id || "");
  const [repeat, setRepeat] = useState(false);
  const [weeks, setWeeks] = useState(2);
  const [days, setDays] = useState([1, 3, 5]);

  const toggleG = (id) => {
    if (!selG.includes(id) && selG.length >= 20) { toast("Máximo de 20 grupos por programação."); return; }
    setSelG((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  };

  const dates = useMemo(() => {
    const start = new Date(data + "T00:00");
    if (isNaN(start)) return [];
    if (!repeat) return [start];
    const out = [];
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (days.includes(d.getDay())) out.push(d);
    }
    return out;
  }, [data, repeat, weeks, days]);

  const warns = useMemo(() => {
    const w = [];
    const first = dates[0];
    if (!first) return w;
    const cd = (state.settings.cooldownDias || 3) * 86400000;
    selG.forEach((id) => {
      const g = groups.find((x) => x.id === id);
      if (!g) return;
      const rec = state.items.find((i) => i.groupId === id && i.status !== "ignorado" && Math.abs(new Date(i.when) - first) < cd);
      if (rec) w.push(`${g.nome}: já tem publicação perto desta data (${fmtDay(new Date(rec.when))}).`);
      if (g.dias?.length && dates.some((d) => !g.dias.includes(d.getDay()))) {
        w.push(`${g.nome}: só permite publicar em ${g.dias.map((x) => DIAS[x]).join(", ")}.`);
      }
    });
    return w;
  }, [selG, dates, state.items, state.settings.cooldownDias]);

  const total = selG.length * dates.length;

  function agendar() {
    const [hh, mm] = hora.split(":").map(Number);
    const sel = selG.map((id) => groups.find((g) => g.id === id)).filter(Boolean);
    const out = [];
    dates.forEach((d, di) => {
      sel.forEach((g, gi) => {
        const w = new Date(d);
        w.setHours(hh, mm + gi * gap, 0, 0);
        const t = vary ? c.texts[(gi + di) % c.texts.length] : c.texts.find((x) => x.id === textId) || c.texts[0];
        out.push({ id: uid(), campaignId: c.id, groupId: g.id, text: t.text, when: toISO(w), status: "pendente", leads: 0, vendas: 0 });
      });
    });
    patch((s) => ({ ...s, items: [...s.items, ...out] }));
    toast(`${out.length} publicações agendadas.`);
    onClose();
    go("agenda");
  }

  return (
    <Sheet title="Programar publicações" onClose={onClose}>
      {groups.length === 0 ? (
        <div className="empty"><b>Ainda não tens grupos</b>Adiciona os teus grupos no separador Grupos.</div>
      ) : (
        <>
          <div className="row sp" style={{ marginBottom: 8 }}>
            <b>Grupos ({selG.length}/20)</b>
            <button className="btn sm" onClick={() => setSelG(selG.length ? [] : groups.slice(0, 20).map((g) => g.id))}>
              {selG.length ? "Limpar" : "Selecionar todos"}
            </button>
          </div>
          {groups.map((g) => (
            <button key={g.id} className={"gsel" + (selG.includes(g.id) ? " on" : "")} onClick={() => toggleG(g.id)}>
              <span className="box">{selG.includes(g.id) && <Check size={14} />}</span>
              <span>{g.nome}</span>
            </button>
          ))}

          <div className="sec">Quando</div>
          <div className="row">
            <div style={{ flex: 1 }}><Field label="Data"><input className="in" type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field></div>
            <div style={{ flex: 1 }}><Field label="Hora do 1.º grupo"><input className="in" type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></Field></div>
          </div>
          <div className="chips" style={{ marginBottom: 12 }}>
            {HORAS_SUGERIDAS.map((h) => <button key={h} className={"chip" + (hora === h ? " on" : "")} onClick={() => setHora(h)}>{h}</button>)}
          </div>
          <Field label="Intervalo entre grupos (evita bloqueios)">
            <div className="chips">
              {[10, 15, 20, 30].map((m) => <button key={m} className={"chip" + (gap === m ? " on" : "")} onClick={() => setGap(m)}>{m} min</button>)}
            </div>
          </Field>

          <div className="chips" style={{ marginBottom: 10 }}>
            <button className={"chip" + (repeat ? " on" : "")} onClick={() => setRepeat(!repeat)}>Repetir toda a semana</button>
          </div>
          {repeat && (
            <>
              <Field label="Dias da semana"><DayChips value={days} onChange={setDays} /></Field>
              <Field label="Durante quantas semanas?">
                <div className="chips">
                  {[1, 2, 3, 4, 8].map((w) => <button key={w} className={"chip" + (weeks === w ? " on" : "")} onClick={() => setWeeks(w)}>{w}</button>)}
                </div>
              </Field>
            </>
          )}

          <div className="sec">Texto</div>
          <div className="chips" style={{ marginBottom: 10 }}>
            <button className={"chip" + (vary ? " on" : "")} onClick={() => setVary(true)}>Variar por grupo</button>
            <button className={"chip" + (!vary ? " on" : "")} onClick={() => setVary(false)}>Sempre o mesmo</button>
          </div>
          {!vary && (
            <select className="in" value={textId} onChange={(e) => setTextId(e.target.value)} style={{ marginBottom: 10 }}>
              {c.texts.map((t, i) => <option key={t.id} value={t.id}>{t.text.slice(0, 50)}…</option>)}
            </select>
          )}

          {warns.map((w, i) => <div className="warn" key={i}><AlertTriangle size={18} style={{ flex: "none" }} />{w}</div>)}

          <button className="btn p full" style={{ marginTop: 8 }} disabled={total === 0 || !c.texts.length} onClick={agendar}>
            <CalendarDays size={18} />Agendar {total} publicações
          </button>
        </>
      )}
    </Sheet>
  );
}

/* ---------- GRUPOS ---------- */
function Grupos({ state, patch, toast }) {
  const [bulk, setBulk] = useState(false);
  const [txt, setTxt] = useState("");
  const [edit, setEdit] = useState(null);

  const add = () => {
    const g = { id: uid(), nome: "", url: "", regras: "", dias: [], ativo: true };
    patch((s) => ({ ...s, groups: [g, ...s.groups] }));
    setEdit(g.id);
  };
  const setG = (id, p) => patch((s) => ({ ...s, groups: s.groups.map((g) => (g.id === id ? { ...g, ...p } : g)) }));
  const del = (id) => patch((s) => ({ ...s, groups: s.groups.filter((g) => g.id !== id), items: s.items.filter((i) => i.groupId !== id || i.status === "publicado") }));

  function importar() {
    const novos = txt.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const [a, b] = l.split("|").map((x) => x.trim());
      const isUrl = (v) => /^https?:\/\//i.test(v || "");
      const url = isUrl(b) ? b : isUrl(a) ? a : "";
      const nome = isUrl(a) ? "Grupo " + (url.split("/").filter(Boolean).pop() || "") : a;
      return { id: uid(), nome, url, regras: "", dias: [], ativo: true };
    });
    if (!novos.length) return;
    patch((s) => ({ ...s, groups: [...novos, ...s.groups] }));
    setTxt(""); setBulk(false);
    toast(`${novos.length} grupos adicionados.`);
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn p" style={{ flex: 1 }} onClick={add}><Plus size={18} />Novo grupo</button>
        <button className="btn" style={{ flex: 1 }} onClick={() => setBulk(!bulk)}>Adicionar vários</button>
      </div>

      {bulk && (
        <div className="card">
          <div className="mute" style={{ marginBottom: 6 }}>Uma linha por grupo: Nome | link</div>
          <textarea className="in" style={{ minHeight: 130 }} value={txt} onChange={(e) => setTxt(e.target.value)}
            placeholder={"Vendas Luanda | https://facebook.com/groups/vendasluanda\nEmpregos Angola | https://facebook.com/groups/empregos"} />
          <button className="btn d full" style={{ marginTop: 8 }} onClick={importar}>Adicionar à lista</button>
        </div>
      )}

      {state.groups.length === 0 && !bulk && (
        <div className="card empty"><b>Sem grupos ainda</b>Adiciona os grupos do Facebook onde queres publicar (até 20 de cada vez).</div>
      )}

      {state.groups.map((g) => {
        const pub = state.items.filter((i) => i.groupId === g.id && i.status === "publicado");
        const last = pub.map((i) => i.postedAt || i.when).sort().pop();
        const open = edit === g.id;
        return (
          <div className="card" key={g.id} style={{ opacity: g.ativo === false ? 0.6 : 1 }}>
            <div className="row sp">
              <div style={{ minWidth: 0 }}>
                <b>{g.nome || "Grupo sem nome"}</b>
                <div className="mute">
                  {pub.length} publicadas{last ? ` · última ${fmtDay(new Date(last))}` : ""}
                </div>
              </div>
              <div className="row">
                <button className="btn sm" onClick={() => setEdit(open ? null : g.id)} aria-label="Editar grupo"><Pencil size={15} /></button>
              </div>
            </div>
            {open && (
              <div style={{ marginTop: 10 }}>
                <Field label="Nome do grupo"><input className="in" value={g.nome} onChange={(e) => setG(g.id, { nome: e.target.value })} /></Field>
                <Field label="Link do grupo"><input className="in" value={g.url} placeholder="https://facebook.com/groups/…" onChange={(e) => setG(g.id, { url: e.target.value })} /></Field>
                <Field label="Regras do grupo (opcional)"><input className="in" value={g.regras} placeholder="Ex.: só 1 post por dia, sem preços" onChange={(e) => setG(g.id, { regras: e.target.value })} /></Field>
                <Field label="Dias permitidos (vazio = todos)"><DayChips value={g.dias || []} onChange={(v) => setG(g.id, { dias: v })} /></Field>
                <div className="row">
                  <button className="btn sm" onClick={() => setG(g.id, { ativo: g.ativo === false })}>{g.ativo === false ? "Ativar" : "Pausar grupo"}</button>
                  <button className="btn sm" onClick={() => del(g.id)}><Trash2 size={15} />Apagar</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ---------- AGENDA ---------- */
function Agenda({ state, patch, toast }) {
  const [filtro, setFiltro] = useState("pendente");
  const [edit, setEdit] = useState(null);
  const gMap = Object.fromEntries(state.groups.map((g) => [g.id, g]));
  const cMap = Object.fromEntries(state.campaigns.map((c) => [c.id, c]));
  const list = state.items
    .filter((i) => (filtro === "todas" ? true : filtro === "pendente" ? i.status === "pendente" : i.status === "publicado"))
    .sort((a, b) => a.when.localeCompare(b.when));
  const byDay = {};
  list.forEach((i) => { (byDay[i.when.slice(0, 10)] = byDay[i.when.slice(0, 10)] || []).push(i); });
  const setItem = (id, p) => patch((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }));
  const stTag = { pendente: ["s", "Pendente"], publicado: ["g", "Publicada"], ignorado: ["r", "Ignorada"] };

  return (
    <>
      <div className="chips" style={{ marginBottom: 12 }}>
        {[["pendente", "Pendentes"], ["publicado", "Publicadas"], ["todas", "Todas"]].map(([id, n]) => (
          <button key={id} className={"chip" + (filtro === id ? " on" : "")} onClick={() => setFiltro(id)}>{n}</button>
        ))}
      </div>
      {list.length === 0 && <div className="card empty"><b>Sem publicações aqui</b>Cria um anúncio e programa-o para aparecer na agenda.</div>}
      {Object.keys(byDay).map((k) => (
        <div key={k}>
          <div className="sec">{fmtDay(new Date(k + "T00:00"))}</div>
          {byDay[k].map((i) => {
            const d = new Date(i.when);
            return (
              <div className="card" key={i.id} style={{ padding: 12 }}>
                <div className="row sp">
                  <div style={{ minWidth: 0 }}>
                    <b>{fmtTime(d)} · {gMap[i.groupId]?.nome || "Grupo removido"}</b>
                    <div className="mute">{cMap[i.campaignId]?.nome}</div>
                  </div>
                  <span className={"tag " + stTag[i.status][0]}>{stTag[i.status][1]}</span>
                </div>
                {edit === i.id && (
                  <div style={{ marginTop: 8 }}>
                    <input className="in" type="datetime-local" value={i.when} onChange={(e) => e.target.value && setItem(i.id, { when: e.target.value })} />
                  </div>
                )}
                <div className="row" style={{ marginTop: 8 }}>
                  {i.status === "pendente" && <button className="btn sm" onClick={() => setEdit(edit === i.id ? null : i.id)}><Clock size={15} />Mudar hora</button>}
                  {i.status !== "pendente" && <button className="btn sm" onClick={() => setItem(i.id, { status: "pendente" })}>Repor</button>}
                  <button className="btn sm" onClick={() => { patch((s) => ({ ...s, items: s.items.filter((x) => x.id !== i.id) })); toast("Removida da agenda."); }}><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

/* ---------- RESULTADOS ---------- */
function Resultados({ state, patch }) {
  const pub = state.items.filter((i) => i.status === "publicado");
  const leads = pub.reduce((a, i) => a + (i.leads || 0), 0);
  const vendas = pub.reduce((a, i) => a + (i.vendas || 0), 0);
  const gMap = Object.fromEntries(state.groups.map((g) => [g.id, g]));
  const cMap = Object.fromEntries(state.campaigns.map((c) => [c.id, c]));
  const rank = state.groups
    .map((g) => {
      const its = pub.filter((i) => i.groupId === g.id);
      return { g, n: its.length, l: its.reduce((a, i) => a + (i.leads || 0), 0), v: its.reduce((a, i) => a + (i.vendas || 0), 0) };
    })
    .filter((r) => r.n > 0)
    .sort((a, b) => b.v - a.v || b.l - a.l);
  const maxL = Math.max(1, ...rank.map((r) => r.l));
  const horas = {};
  pub.forEach((i) => { const h = i.when.slice(11, 13); horas[h] = (horas[h] || 0) + (i.leads || 0); });
  const topH = Object.entries(horas).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const setItem = (id, p) => patch((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }));
  const recentes = [...pub].sort((a, b) => (b.postedAt || b.when).localeCompare(a.postedAt || a.when)).slice(0, 12);

  if (!pub.length) {
    return <div className="card empty"><b>Ainda sem resultados</b>Quando marcares publicações como feitas, regista aqui quantas pessoas te contactaram e quantas compraram.</div>;
  }
  return (
    <>
      <div className="stats">
        <div className="stat"><b>{pub.length}</b><span>Publicadas</span></div>
        <div className="stat"><b>{leads}</b><span>Contactos</span></div>
        <div className="stat"><b>{vendas}</b><span>Vendas</span></div>
      </div>

      {rank.length > 0 && (
        <>
          <div className="sec">Melhores grupos</div>
          <div className="card">
            {rank.slice(0, 8).map((r) => (
              <div key={r.g.id} style={{ marginBottom: 12 }}>
                <div className="row sp"><b>{r.g.nome}</b><span className="mute">{r.l} contactos · {r.v} vendas · {r.n} posts</span></div>
                <div className="bar"><i style={{ width: `${(r.l / maxL) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </>
      )}

      {topH.length > 0 && (
        <div className="card">
          <h3>Melhores horas</h3>
          <div className="chips">{topH.map(([h, v]) => <span className="tag g" key={h}>{h}h · {v} contactos</span>)}</div>
        </div>
      )}

      <div className="sec">Registar resultados</div>
      {recentes.map((i) => (
        <div className="card" key={i.id} style={{ padding: 12 }}>
          <b>{gMap[i.groupId]?.nome || "Grupo removido"}</b>
          <div className="mute" style={{ marginBottom: 8 }}>{cMap[i.campaignId]?.nome} · {fmtDay(new Date(i.when))} {i.when.slice(11, 16)}</div>
          <Counter label="Contactos" value={i.leads || 0} onChange={(v) => setItem(i.id, { leads: v })} />
          <Counter label="Vendas" value={i.vendas || 0} onChange={(v) => setItem(i.id, { vendas: v })} />
        </div>
      ))}
    </>
  );
}

/* ---------- DEFINIÇÕES ---------- */
function Definicoes({ state, patch, setState, onClose, toast }) {
  const s = state.settings;
  const set = (p) => patch((st) => ({ ...st, settings: { ...st.settings, ...p } }));
  const [imp, setImp] = useState("");
  const [reset, setReset] = useState(false);
  const exp = JSON.stringify(state);

  return (
    <Sheet title="Definições" onClose={onClose}>
      <div className="card">
        <Field label="Nome do teu negócio"><input className="in" value={s.negocio} onChange={(e) => set({ negocio: e.target.value })} /></Field>
        <Field label="WhatsApp (aparece nos anúncios)"><input className="in" inputMode="tel" value={s.whatsapp} placeholder="9XX XXX XXX" onChange={(e) => set({ whatsapp: e.target.value })} /></Field>
        <Field label="Cidade"><input className="in" value={s.cidade} onChange={(e) => set({ cidade: e.target.value })} /></Field>
        <Field label="Dias mínimos entre posts no mesmo grupo">
          <div className="chips">{[1, 2, 3, 5, 7].map((d) => <button key={d} className={"chip" + (s.cooldownDias === d ? " on" : "")} onClick={() => set({ cooldownDias: d })}>{d}</button>)}</div>
        </Field>
      </div>

      <div className="card">
        <h3>Cópia de segurança</h3>
        <div className="mute" style={{ marginBottom: 8 }}>Copia e guarda este texto (por exemplo no WhatsApp para ti). Serve para recuperar tudo noutro telemóvel.</div>
        <button className="btn full" onClick={async () => toast((await copyText(exp)) ? "Cópia feita." : "Não consegui copiar.")}><Copy size={18} />Copiar dados</button>
        <textarea className="in" style={{ marginTop: 10 }} placeholder="Cola aqui uma cópia para restaurar" value={imp} onChange={(e) => setImp(e.target.value)} />
        <button className="btn d full" style={{ marginTop: 8 }} disabled={!imp.trim()} onClick={() => {
          try { setState({ ...INIT, ...JSON.parse(imp) }); setImp(""); toast("Dados restaurados."); } catch (e) { toast("Texto inválido."); }
        }}>Restaurar</button>
      </div>

      <button className="btn full" onClick={() => { if (reset) { setState(INIT); onClose(); } else setReset(true); }}>
        <Trash2 size={18} />{reset ? "Toca outra vez para apagar tudo" : "Apagar todos os dados"}
      </button>
    </Sheet>
  );
}
