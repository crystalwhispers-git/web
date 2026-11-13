// IG 貼文產生器的「時事觀點」（2026-11-13 加）：輸入事件 → n8n 開 Google 搜尋找近期新聞 → 挑一則 → 50／100 字兩版＋hashtag。
// 時事貼文完全不提水晶、產品、銷售，只寫觀點。按複製時存進喜好庫，類型記「時事」（50、100 字各存一筆，再複製就覆寫同一筆）。
// 跟 app.js 共用 $、esc、call、DEMO、status、copyText、tagText（app.js 要先載入）。

// ===== 上方切換：題材＋產品／時事觀點（記在手機） =====
function setKind(k) {
  document.body.dataset.kind = k;
  document.querySelectorAll("#kind button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.kind === k)));
  try { localStorage.setItem("igpost-kind", k); } catch {}
}
document.querySelectorAll("#kind button").forEach(b => b.onclick = () => setKind(b.dataset.kind));
try { setKind(localStorage.getItem("igpost-kind") === "news" ? "news" : "product"); } catch { setKind("product"); }

// 本機預覽用的示範資料
Object.assign(DEMO, {
  news: { items: [
    { title: "黃仁勳演講談團隊裡的女性主管", date: "2026-11-02", source: "示範新聞台", summary: "（示範資料）黃仁勳在一場演講中提到，公司裡很多關鍵決定來自女性主管，並鼓勵年輕女性勇敢爭取舞台。", angle: "被看見之前，先相信自己值得", outline: ["開場：「很多關鍵決定來自女性主管」這句話", "觀點：位子不是等來的，先相信自己值得", "結尾：你最近一次替自己爭取是什麼時候？"], links: [{ uri: "https://example.com/a", title: "example.com" }] },
    { title: "黃仁勳回憶創業初期的低潮", date: "2026-10-28", source: "示範日報", summary: "（示範資料）談到創業初期公司差點倒閉，他說最難的不是技術，而是撐住不放棄。", angle: "低潮不是終點，是轉彎", outline: ["開場：公司差點倒閉的那一年", "觀點：最難的是撐住，不是技術", "結尾：你正在撐的那件事，值得"], links: [] },
    { title: "黃仁勳穿皮衣的堅持", date: "2026-10-20", source: "示範週刊", summary: "（示範資料）記者問他為什麼永遠穿皮衣，他回答把力氣留給真正重要的決定。", angle: "簡單，是把力氣留給重要的事", links: [] },
  ], sources: [{ uri: "https://example.com/a", title: "example.com" }, { uri: "https://example.com/b", title: "example.org" }] },
  npost: {
    body50: "「很多關鍵決定，來自女性主管。」\n這句話不是客套。\n被看見之前，\n先相信自己值得那個位子。",
    body100: "「很多關鍵決定，來自女性主管。」\n黃仁勳在演講裡這樣說。\n我們常等別人肯定，\n才敢舉手、才敢開口。\n但位子不是等來的，\n是先相信自己值得，才走得過去。\n你最近一次替自己爭取，是什麼時候？",
    hashtags: ["#黃仁勳", "#女性力量", "#職場", "#自我成長", "#時事", "#生活感悟", "#勇敢", "#女性領導"] },
  ntags: { hashtags: ["#黃仁勳演講", "#女力", "#職場女性", "#相信自己", "#時事觀點", "#今日感悟", "#成長日記", "#職涯"] },
});

// ===== 狀態 =====
// nstate：{ event, items, pick: 第幾則, post: { b50, b100, tags, id50, id100, copied50, copied100 } }
let nstate = null, nbusy = false, nseq = 0, ntimer = null;
const NERR = { auth: "登入已過期，請重新從 LINE 打開這個工具。", locked: "你目前沒有這個工具的權限，請聯絡管理者。", input: "請先輸入想談的事件。", server: "這次沒有成功，請再按一次。" };
const nerr = e => NERR[e?.code] || "連線中斷，請確認網路後再按一次。";
function nwait(id, msg) {
  clearInterval(ntimer);
  const t0 = Date.now();
  status(id, msg);
  ntimer = setInterval(() => status(id, `${msg}已過 ${Math.round((Date.now() - t0) / 1000)} 秒`), 1000);
}
function nsetBusy(on) {
  nbusy = on;
  if (!on) clearInterval(ntimer);
  ["ngo", "nre", "nreTags"].forEach(id => $(id).disabled = on);
  document.querySelectorAll("#news .use").forEach(b => b.disabled = on);
}
const ncount = () => {
  $("n50c").textContent = `（${$("n50").value.replace(/\s/g, "").length} 字）`;
  $("n100c").textContent = `（${$("n100").value.replace(/\s/g, "").length} 字）`;
};
try { $("event").value = localStorage.getItem("igpost-event") || ""; } catch {}

// 來源連結：在 LINE 裡用外部瀏覽器打開，看完回來頁面還在
function openLink(ev) {
  const a = ev.target.closest("a[data-url]");
  if (!a) return;
  ev.preventDefault();
  const url = a.dataset.url;
  try { if (window.liff && liff.isInClient && liff.isInClient()) { liff.openWindow({ url, external: true }); return; } } catch {}
  window.open(url, "_blank", "noopener");
}
const safeUrl = u => /^https:\/\//.test(String(u || "")) ? String(u) : "";
const linkHtml = l => safeUrl(l.uri) ? `<a href="${esc(l.uri)}" data-url="${esc(l.uri)}" rel="noopener">${esc(l.title || "來源")}</a>` : "";

function renderNews() {
  $("n2").hidden = !nstate;
  if (!nstate) return;
  $("news").innerHTML = nstate.items.map((it, i) => `<div class="nw" aria-current="${i === nstate.pick}">
    <b>${esc(it.title)}</b>
    <span class="meta">${esc([it.date, it.source].filter(Boolean).join("・"))}</span>
    ${it.summary ? `<p>${esc(it.summary)}</p>` : ""}
    ${it.angle ? `<small>可以談：${esc(it.angle)}</small>` : ""}
    <label class="lab" for="ol${i}">初步大綱（可以先改再寫）</label>
    <textarea id="ol${i}" class="ol" data-i="${i}" rows="3">${esc(it.outlineText)}</textarea>
    ${(it.links || []).length ? `<div class="links">${it.links.map(linkHtml).join("")}</div>` : ""}
    <div class="row"><button type="button" class="copy use" data-i="${i}">${i === nstate.pick ? "正在用這則 · 再按一次重寫" : "用這則寫 →"}</button></div>
  </div>`).join("");
  document.querySelectorAll("#news .use").forEach(b => { b.onclick = () => npick(+b.dataset.i); b.disabled = nbusy; });
  document.querySelectorAll("#news .ol").forEach(t => t.oninput = () => { nstate.items[+t.dataset.i].outlineText = t.value; });
  const src = (nstate.sources || []).map(linkHtml).filter(Boolean);
  $("nsrcBox").hidden = !src.length;
  $("nsrc").innerHTML = src.join("");
}
$("news").addEventListener("click", openLink);
$("nsrc").addEventListener("click", openLink);

function showNEditor() {
  const p = nstate && nstate.post;
  $("n3").hidden = !p;
  if (!p) return;
  $("n50").value = p.b50; $("n100").value = p.b100; $("ntags").value = p.tags;
  ncount();
}
[["n50", "b50"], ["n100", "b100"], ["ntags", "tags"]].forEach(([id, k]) => $(id).addEventListener("input", () => {
  if (nstate && nstate.post) nstate.post[k] = $(id).value;
  if (id !== "ntags") ncount();
}));

// ===== ① 搜尋近期新聞 =====
$("nf").onsubmit = async ev => {
  ev.preventDefault();
  const event = $("event").value.trim();
  if (!event || nbusy) return;
  try { localStorage.setItem("igpost-event", event); } catch {}
  const my = ++nseq;
  nsetBusy(true); nwait("nst1", "正在上網找近期新聞、擬大綱…（約 10–20 秒）");
  try {
    const r = await call({ mode: "news", concept: event });
    const items = (r?.items || []).filter(it => it && it.title).slice(0, 5)
      .map(it => ({ ...it, outlineText: (Array.isArray(it.outline) ? it.outline : []).join("\n") }));
    if (my !== nseq) return;
    nsetBusy(false);
    if (!items.length) { status("nst1", "找不到相關的近期新聞，換個說法（例如加上人名或時間）再試一次。", "err"); return; }
    nstate = { event, items, sources: r.sources || [], pick: -1, post: null };
    status("nst1", `找到 ${items.length} 則，往下挑一則。`);
    renderNews(); showNEditor();
    $("n2").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) { nsetBusy(false); status("nst1", nerr(e), "err"); }
};

// ===== ② 挑一則 → 寫 50／100 字兩版＋hashtag =====
async function npick(i) {
  if (!nstate || nbusy) return;
  const s = nstate, it = s.items[i];
  s.pick = i;
  renderNews();
  $("n3").hidden = false;
  $("n3").scrollIntoView({ behavior: "smooth", block: "start" });
  nsetBusy(true); nwait("nst3", "正在寫 50 字和 100 字兩個版本…（約 5–15 秒）");
  try {
    const r = await call({ mode: "npost", concept: s.event, ntitle: it.title, ndate: it.date || "", nsource: it.source || "", nsummary: it.summary || "", nangle: it.angle || "", noutline: (it.outlineText || "").trim() });
    if (!r?.body50 && !r?.body100) throw { code: "server" };
    if (nstate !== s) return;
    // 換了一則新聞就是新的一篇，喜好庫另存新的一筆
    s.post = { b50: String(r.body50 || "").trim(), b100: String(r.body100 || "").trim(), tags: tagText(r.hashtags), id50: "", id100: "", ntitle: it.title };
    nsetBusy(false); status("nst3", "寫好了。直接在框裡改，改完按複製。");
    renderNews(); showNEditor();
  } catch (e) {
    nsetBusy(false);
    if (nstate !== s) return;
    renderNews();
    status("nst3", e?.code && e.code !== "server" ? nerr(e) : "這次沒有寫成功，再按一次「用這則寫」就會重試。", "err");
    if (!s.post) $("n3").hidden = true;
  }
}
$("nre").onclick = () => { if (nstate && nstate.pick >= 0 && !nbusy) npick(nstate.pick); };
$("nreTags").onclick = async () => {
  const s = nstate, p = s && s.post;
  if (!p || nbusy) return;
  const it = s.items[s.pick];
  nsetBusy(true); nwait("nst3", "正在換一組 hashtag…");
  try {
    const r = await call({ mode: "ntags", concept: s.event, ntitle: it.title, nsummary: it.summary || "", body: p.b100 || p.b50 });
    const tags = tagText(r?.hashtags);
    if (!tags) throw { code: "server" };
    if (nstate !== s) return;
    p.tags = tags;
    nsetBusy(false); status("nst3", "換好了。");
    showNEditor();
  } catch (e) { nsetBusy(false); if (nstate === s) status("nst3", nerr(e), "err"); }
};

// ===== ③ 複製＋存進喜好庫（類型：時事；50、100 字各一筆） =====
let nsaving = Promise.resolve();
function nsave(p, len, what) {
  const key = "copied" + len;
  p[key] = [...new Set([...(p[key] || []), ...what])];
  const event = nstate.event;
  nsaving = nsaving.then(async () => {
    try {
      const r = await call({ mode: "save", kind: "時事", id: p["id" + len] || "", title: event, body: (len === "50" ? p.b50 : p.b100).trim(),
        tags: p.tags.trim(), concept: p.ntitle || "", len, copied: p[key].join(",") });
      if (!r?.ok) throw 0;
      if (r.id) p["id" + len] = r.id;
      status("nst3", "已複製，也存進喜好庫了。", "ok");
    } catch { status("nst3", "已複製。但這次沒有存進喜好庫，再按一次複製就會重存。", "err"); }
  });
}
document.querySelectorAll("[data-ncopy]").forEach(btn => btn.onclick = async () => {
  const p = nstate && nstate.post;
  if (!p) return;
  const kind = btn.dataset.ncopy;   // 50、100、tags、50+tags、100+tags
  const len = kind.startsWith("50") ? "50" : kind.startsWith("100") ? "100" : (p.id50 && !p.id100 ? "50" : "100");
  const body = (len === "50" ? p.b50 : p.b100).trim();
  const parts = kind === "tags" ? [p.tags.trim()] : kind.endsWith("+tags") ? [body, p.tags.trim()] : [body];
  const text = parts.filter(Boolean).join("\n\n");
  if (!text) { status("nst3", "這一格是空的。", "err"); return; }
  if (!(await copyText(text))) { status("nst3", "這支手機不讓網頁自動複製，請長按文字自己複製。", "err"); return; }
  const label = btn.textContent;
  btn.classList.add("done"); btn.textContent = "已複製 ✓";
  setTimeout(() => { btn.classList.remove("done"); btn.textContent = label; }, 1600);
  status("nst3", "已複製，正在存進喜好庫…");
  nsave(p, len, kind === "tags" ? ["hashtag"] : kind.endsWith("+tags") ? ["內文", "hashtag"] : ["內文"]);
});
