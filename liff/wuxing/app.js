const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const LIFF_ID = '2012526991-K2po91Aa';
const HOOK = 'crystal-whispers-wuxing';
const OA_ID = '@992tgwyb';
const IS_PROD = location.hostname.endsWith('github.io');
const HOSTS = ['https://idly-junction-altitude.ngrok-free.dev'];

async function postHook(path, body) {
  let err;
  let start = 0;
  try { start = Math.max(0, HOSTS.indexOf(sessionStorage.getItem('n8n-host'))); } catch {}
  for (let i = 0; i < HOSTS.length; i++) {
    const host = HOSTS[(start + i) % HOSTS.length];
    try {
      const res = await fetch(host + '/webhook/' + path, body);
      if (i < HOSTS.length - 1 && res.status >= 502 && res.status <= 504) { err = res; continue; }
      try { sessionStorage.setItem('n8n-host', host); } catch {}
      return res;
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      err = e;
    }
  }
  if (err instanceof Response) return err;
  throw err;
}

const EL_VAR = { 木: '--wood', 火: '--fire', 土: '--earth', 金: '--metal', 水: '--water' };
const elColor = e => `var(${EL_VAR[e]})`;

const DEFAULT_CRYSTALS = [
  { el: '木', name: '綠幽靈', text: '事業、貴人' },
  { el: '木', name: '綠東陵', text: '安定、好運' },
  { el: '木', name: '橄欖石', text: '自信、正向' },
  { el: '火', name: '粉晶', text: '人緣、愛情' },
  { el: '火', name: '紫水晶', text: '直覺、平靜' },
  { el: '火', name: '紅瑪瑙', text: '活力、勇氣' },
  { el: '土', name: '黃水晶', text: '財運、自信' },
  { el: '土', name: '黃虎眼', text: '專注、決斷' },
  { el: '土', name: '茶晶', text: '穩定、放鬆' },
  { el: '金', name: '白水晶', text: '淨化、專注' },
  { el: '金', name: '鈦晶', text: '魄力、正財' },
  { el: '金', name: '月光石', text: '溫柔、直覺' },
  { el: '水', name: '黑曜石', text: '守護、穩定' },
  { el: '水', name: '海藍寶', text: '溝通、平靜' },
  { el: '水', name: '青金石', text: '智慧、表達' },
];
let crystalsList = DEFAULT_CRYSTALS;

// 主題切換
const SUN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  $('theme').innerHTML = t === 'dark' ? SUN_SVG : MOON_SVG;
  $('theme').setAttribute('aria-label', t === 'dark' ? '切換淺色模式' : '切換深色模式');
}
let theme = 'light';
try { theme = localStorage.getItem('wx-theme') === 'dark' ? 'dark' : 'light'; } catch {}
applyTheme(theme);
$('theme').onclick = () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  applyTheme(theme);
  try { localStorage.setItem('wx-theme', theme); } catch {}
};

// 狀態
let cal = 'solar';
let hourVal = -1;
let lastCalc = null;
let lastCrystals = [];
let lastName = '';
let mode = 'self'; // 'self' | 'friend' | 'proxy'
let chosenCust = null;
let viewingIdx = -1; // -1 = 本人, >=0 = friendsRecords[idx]

const LS_SELF = 'wx-self-record';
const LS_FRIENDS = 'wx-friends-records';

function loadSelfRecord() {
  try { return JSON.parse(localStorage.getItem(LS_SELF) || 'null'); } catch { return null; }
}
function saveSelfRecord(rec) {
  try { localStorage.setItem(LS_SELF, JSON.stringify(rec)); } catch {}
}
function loadFriendsRecords() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_FRIENDS) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveFriendsRecords(arr) {
  try { localStorage.setItem(LS_FRIENDS, JSON.stringify(arr)); } catch {}
}

// 日期選單
const now = new Date();
function fillSelect(sel, start, end, fmt, defVal) {
  const prev = defVal ?? sel.value;
  sel.innerHTML = '';
  for (let i = start; i <= end; i++) sel.add(new Option(fmt(i), i));
  if (prev && +prev >= start && +prev <= end) sel.value = prev;
}
const LUNAR_DAYS = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
const LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '臘'];
function updateDays() {
  const y = +$('y').value, m = +$('m').value;
  const maxD = cal === 'solar' ? new Date(y, m, 0).getDate() : 30;
  fillSelect($('d'), 1, maxD, i => cal === 'solar' ? i + ' 日' : LUNAR_DAYS[i - 1]);
}
function updateMonths() {
  fillSelect($('m'), 1, 12, i => cal === 'solar' ? i + ' 月' : LUNAR_MONTHS[i - 1] + '月');
  updateDays();
}
fillSelect($('y'), 1930, now.getFullYear(), i => i + ' 年', 1990);
$('y').onchange = updateDays;
$('m').onchange = updateDays;
document.querySelectorAll('[data-cal]').forEach(btn => {
  btn.onclick = () => {
    cal = btn.dataset.cal;
    document.querySelectorAll('[data-cal]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    $('leapRow').hidden = cal !== 'lunar';
    updateMonths();
  };
});
updateMonths();

// 時辰按鈕
$('hours').innerHTML = WuXing.HOURS.map((h, i) =>
  `<button type="button" data-h="${i}" aria-pressed="false"><b>${h.name}</b><small>${h.range} 點</small></button>`
).join('') + '<button type="button" class="unknown" data-h="-1" aria-pressed="true"><b>不知道時辰</b><small>只用年月日計算</small></button>';

$('hours').querySelectorAll('button').forEach(btn => {
  btn.onclick = () => {
    hourVal = +btn.dataset.h;
    $('time').value = '';
    $('hours').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    checkDst();
  };
});
$('time').oninput = () => {
  if ($('time').value) {
    $('hours').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', 'false'));
  }
  checkDst();
};

const getInput = () => ({
  y: +$('y').value,
  m: +$('m').value,
  d: +$('d').value,
  lunar: cal === 'lunar',
  leap: $('leap').checked,
  hour: hourVal,
  time: $('time').value,
});

function checkDst() {
  let res = null;
  try { res = WuXing.calc({ ...getInput(), hour: -1, time: '' }); } catch {}
  const hasDst = !!res?.dst;
  $('dstHint').hidden = !hasDst;
  if (hasDst) {
    $('dstHint').textContent = `這天在${res.dst}期間，當時時鐘比標準時間快 1 小時。填「幾點幾分」會自動扣回；只選時辰的話，請選扣掉 1 小時後的時辰。`;
  }
}
['y', 'm', 'd', 'leap'].forEach(id => $(id).addEventListener('change', checkDst));

// 雷達圖
function drawRadar(res) {
  const maxPct = Math.max(...WuXing.ELS.map(e => res.pct[e])) || 1;
  const pt = (idx, r) => {
    const rad = (72 * idx - 90) * Math.PI / 180;
    return [r * Math.cos(rad), r * Math.sin(rad)];
  };
  const pts = WuXing.ELS.map((e, i) => pt(i, 92 * Math.max(res.pct[e] / maxPct, 0.04)));
  const svg = $('radar');
  svg.classList.remove('on');
  svg.innerHTML =
    [1 / 3, 2 / 3, 1].map(k => `<polygon class="grid" points="${WuXing.ELS.map((_, i) => pt(i, 92 * k).map(n => n.toFixed(1)).join(',')).join(' ')}"/>`).join('') +
    WuXing.ELS.map((_, i) => {
      const [x, y] = pt(i, 92);
      return `<line class="axis" x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
    }).join('') +
    `<g class="shape-g"><polygon class="shape" points="${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}"/></g>` +
    WuXing.ELS.map((e, i) => {
      const [px, py] = pts[i];
      const [lx, ly] = pt(i, 118);
      return `<circle class="pt" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4.5" style="fill:${elColor(e)}"/>
        <text class="el" x="${lx.toFixed(1)}" y="${(ly - 7).toFixed(1)}" style="fill:${elColor(e)}">${e}</text>
        <text class="pc" x="${lx.toFixed(1)}" y="${(ly + 9).toFixed(1)}">${res.pct[e]}%</text>`;
    }).join('');
  svg.querySelectorAll('.pt').forEach(el => {
    el.style.opacity = 0;
    el.style.transition = 'opacity .3s .6s';
  });
  setTimeout(() => {
    svg.classList.add('on');
    svg.querySelectorAll('.pt').forEach(el => { el.style.opacity = 1; });
  }, 40);
}

// 渲染親友切換列
function renderFriendChips(viewMode) {
  const selfRec = loadSelfRecord();
  const friends = loadFriendsRecords();
  if (viewMode === 'proxy' || (!selfRec && !friends.length)) {
    $('friendsBox').hidden = true;
    return;
  }
  if (!friends.length) {
    $('friendsBox').hidden = true;
    return;
  }
  $('friendsBox').hidden = false;
  $('friendsCountText').textContent = `你曾幫 ${friends.length} 位親友測過（點名字可切換查看）：`;
  let html = '';
  if (selfRec) {
    html += `<button type="button" class="chip" data-fidx="-1" aria-current="${viewingIdx === -1 ? 'true' : 'false'}">我的五行${selfRec.name ? `（${esc(selfRec.name)}）` : ''}</button>`;
  }
  friends.forEach((fr, idx) => {
    html += `<button type="button" class="chip" data-fidx="${idx}" aria-current="${viewingIdx === idx ? 'true' : 'false'}">${esc(fr.name || '親友 ' + (idx + 1))}</button>`;
  });
  $('friendChips').innerHTML = html;
  $('friendChips').querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      const idx = +btn.dataset.fidx;
      if (idx === -1 && selfRec) {
        viewingIdx = -1;
        showSavedRecord(selfRec, 'self');
      } else if (friends[idx]) {
        viewingIdx = idx;
        showSavedRecord(friends[idx], 'friend');
      }
    };
  });
}

// 渲染結果頁
function renderResult(res, name, viewMode, opts = {}) {
  const isFriend = viewMode === 'friend';
  const isProxy = viewMode === 'proxy';
  const subject = name ? esc(name) : (isFriend ? '對方' : '你');
  const whoText = isFriend || isProxy ? `${subject} 的` : (name ? `${esc(name)}，你的` : '你的');
  const weakPart = res.missing.length
    ? `，<b style="color:${elColor(res.weak)}">${res.missing.join('、')}</b>幾乎沒有`
    : `，<b style="color:${elColor(res.weak)}">${res.weak}</b>比較少`;

  $('summary').innerHTML = `${whoText}五行<b style="color:${elColor(res.strong)}">${res.strong}</b>最旺${weakPart}。`;
  drawRadar(res);

  $('hourNote').hidden = res.hour >= 0;
  $('dstNote').hidden = !res.dst;
  $('dstNote').textContent = res.dst
    ? (res.corrected
        ? `這天在${res.dst}期間，出生時間 ${res.clock} 已扣回 1 小時，以 ${res.corrected} 計算。`
        : `這天在${res.dst}期間，時鐘快 1 小時；請確認選的是扣回後的時辰。`)
    : '';

  const dm = res.dayMaster;
  $('dmTitle').textContent = isFriend ? `${name || '對方'}的本命特質` : isProxy ? '他的本命特質' : '你的本命特質';
  $('dm').innerHTML = `<div class="stone" style="background:${elColor(dm.el)}">${dm.stem}</div>
    <div><p><b>${dm.stem}${dm.el}</b>：${esc(dm.text)}</p><small>以出生那天的天干為本命，代表一個人的核心氣質。</small></div>`;

  const p = res.power;
  const favs = [p.use, p.like].filter((e, i, a) => e && a.indexOf(e) === i);
  const st = p.story || { tag: '五行平衡分析', lead: '', body: p.why, end: `適合加強的五行為：${favs.join('、')}。` };

  $('power').innerHTML = `
    <div class="aha-box">
      <span class="aha-badge">${esc(st.tag)}</span>
      ${st.lead ? `<p>${esc(st.lead)}</p>` : ''}
      <p>${esc(st.body)}</p>
      <p class="aha-end">${esc(st.end)}</p>
    </div>
    <p class="fav-title">${isFriend ? '最適合為他補充的平衡五行' : '最適合你的平衡五行'}</p>
    <div class="gods">${favs.map(el => `
      <div class="god">
        <small>平衡五行</small>
        <b style="color:${elColor(el)}">${el}</b>
        <span>${esc(WuXing.MEANING[el] || '')}</span>
      </div>`).join('')}
    </div>`;

  $('crystalTitle').innerHTML = `${isFriend ? `適合送 ${esc(name || '他')} 的水晶` : '適合你的水晶'}<span class="tag">依平衡五行：${favs.join('、')}</span>`;
  const recs = favs.flatMap((el, idx) => crystalsList.filter(c => c.el === el).slice(0, idx === 0 ? 3 : 2));
  $('crystals').innerHTML = recs.map(c => `<div class="crystal">
    <div class="dot" style="${c.image ? `background-image:url('${esc(c.image)}')` : `background:${elColor(c.el)}`}"></div>
    <div><b>${esc(c.name)}<span class="tag">${c.el}</span></b><small>${esc(c.text)}</small></div>
  </div>`).join('') + `<p class="note">${favs.map(e => `${e}代表${WuXing.MEANING[e]}`).join('；')}。</p>`;

  const askMsg = isFriend
    ? `我想幫「${name || '親友'}」挑水晶！他的生日五行：${res.strong}最旺、${res.weak}比較少，本命${dm.stem}${dm.el}，適合加強${favs.join('、')}，想請 Sammi 推薦適合送他的水晶。`
    : `我的生日五行：${res.strong}最旺、${res.weak}比較少，本命${dm.stem}${dm.el}，適合加強${favs.join('、')}，想請 Sammi 推薦適合我的水晶。`;
  $('ask').href = `https://line.me/R/oaMessage/${OA_ID}/?${encodeURIComponent(askMsg)}`;
  $('ask').textContent = isFriend ? `問 Sammi 適合送「${name || '他'}」的水晶` : '問 Sammi 適合我的水晶';

  $('pillars').innerHTML = res.pillars.map(p =>
    `<div><small>${p.label}柱</small><span style="color:${elColor(WuXing.STEM_EL[p.gz[0]])}">${p.gz[0]}</span><span>${p.gz[1]}</span></div>`
  ).join('');
  $('dateLine').textContent = `國曆 ${res.solar}・農曆 ${res.lunarText}・${res.clock ? res.clock + '（' + res.hourName + '）' : res.hourName}`;

  // 頂部模式列與動作按鈕
  if (isProxy) {
    $('viewBar').hidden = true;
    $('selfActions').hidden = true;
    $('proxyActions').hidden = false;
  } else {
    const selfRec = loadSelfRecord();
    $('proxyActions').hidden = true;
    $('selfActions').hidden = false;
    $('viewBar').hidden = false;
    if (isFriend) {
      $('viewBarText').textContent = `🎁 ${name || '親友'} 的五行分析（送禮參考）`;
      $('viewBarBtn').textContent = selfRec ? '← 回去看我的' : '測自己的五行';
      $('backSelfBtn').hidden = !selfRec;
      $('goFriend').textContent = '🎁 再幫另一位朋友測';
    } else {
      $('viewBarText').textContent = `✨ ${name ? name + ' 的' : '你的'}專屬五行檔案`;
      $('viewBarBtn').textContent = '🎁 幫其他人測';
      $('backSelfBtn').hidden = true;
      $('goFriend').textContent = '🎁 幫其他人測五行（挑禮物參考）';
    }
  }

  renderFriendChips(viewMode);
  $('result').hidden = false;
  if (!opts.noScroll) {
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  return recs;
}

function showSavedRecord(rec, viewMode) {
  let res;
  try {
    res = WuXing.calc(rec.input);
  } catch { return false; }
  $('f').hidden = true;
  lastCalc = res;
  lastName = rec.name || '';
  lastCrystals = renderResult(res, lastName, viewMode, { noScroll: true });
  $('status').textContent = '';
  return true;
}

function getIdToken() {
  try { return liff.getIDToken() || ''; } catch { return ''; }
}
async function callApi(params) {
  const res = await postHook(HOOK, { method: 'POST', body: new URLSearchParams({ ...params, t: getIdToken() }) });
  if (!res.ok) throw res.status;
  return res.json();
}

async function saveToServer(res, name, input, recs, extra) {
  if (!IS_PROD) {
    $('status').textContent = '（本機預覽，不會送到伺服器）';
    return;
  }
  $('status').textContent = '保存中…';
  try {
    await callApi({
      mode: 'save',
      name: name,
      cal: input.lunar ? (input.leap ? '農曆閏月' : '農曆') : '國曆',
      birth: `${input.y}-${input.m}-${input.d}`,
      solar: res.solar,
      hour: res.hourName,
      bazi: res.pillars.map(p => p.gz).join(' '),
      day_master: res.dayMaster.stem + res.dayMaster.el,
      pct: WuXing.ELS.map(e => `${e} ${res.pct[e]}%`).join('、'),
      wood: res.pct.木, fire: res.pct.火, earth: res.pct.土, metal: res.pct.金, water: res.pct.水,
      strong: res.strong, weak: res.weak,
      crystals: recs.map(c => c.name).join('、'),
      time: res.clock,
      dst: res.dst ? (res.corrected ? `${res.dst}，已扣回 1 小時（${res.corrected}）` : res.dst) : '',
      level: res.power.level, ratio: res.power.ratio,
      use: res.power.use, like: res.power.like, avoid: res.power.avoid,
      ...extra,
    });
    if (extra.proxy === '1') {
      $('status').textContent = chosenCust ? `已保存，記在「${chosenCust.name || chosenCust.line}」名下。` : '已保存（沒有選名冊裡的客人，只記稱呼）。';
    } else if (extra.measure_type === 'friend') {
      $('status').textContent = `已記錄「${name}」的分析，這也是你幫第 ${extra.friend_seq} 位親友測驗喔！`;
    } else {
      $('status').textContent = '已建立你的專屬五行檔案，下次打開可直接查看。';
    }
  } catch {
    $('status').textContent = '結果已經算好，但這次沒有同步到雲端。';
  }
}

// 表單重置與切換模式
const DEF_YEAR = 1990;
function resetFormFields() {
  $('f').reset();
  document.querySelector('[data-cal="solar"]').click();
  $('y').value = DEF_YEAR;
  $('m').value = 1;
  updateDays();
  $('d').value = 1;
  $('hours').querySelector('[data-h="-1"]').click();
  $('err').hidden = true;
  $('status').textContent = '';
  setChosenCust(null);
  $('q').value = '';
  clearSearch();
}

function enterMode(nextMode) {
  mode = nextMode;
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === nextMode)));
  const isProxy = nextMode === 'proxy';
  const isFriend = nextMode === 'friend';
  const isSelf = nextMode === 'self';

  $('picker').hidden = !isProxy;
  $('proxySaveRow').hidden = !isProxy;
  $('friendFormBar').hidden = !isFriend;
  $('selfOnceHint').hidden = !isSelf;
  $('consentRow').hidden = isProxy || isFriend;

  if (isProxy) {
    $('nameLabel').innerHTML = '客人稱呼<small>選了客人會自動帶入，可以改</small>';
    $('name').placeholder = '例如：小美';
    $('go').textContent = '排這位客人的五行';
    $('heroLine').textContent = '幫客人排五行，結果可複製給客人';
    $('f').hidden = false;
    $('result').hidden = true;
    resetFormFields();
  } else if (isFriend) {
    $('nameLabel').innerHTML = '怎麼稱呼對方<small class="req">必填</small>';
    $('name').placeholder = '例如：媽媽、男友、閨蜜小美';
    $('go').textContent = '幫他測五行';
    $('heroLine').textContent = '幫身邊的人測五行，挑禮物更有方向';
    $('f').hidden = false;
    $('result').hidden = true;
    resetFormFields();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    $('nameLabel').innerHTML = '怎麼稱呼你<small>選填</small>';
    $('name').placeholder = '例如：小美';
    $('go').textContent = '看我的五行';
    $('heroLine').textContent = '輸入生日，看五行平衡與專屬水晶';
    const selfRec = loadSelfRecord();
    if (selfRec && showSavedRecord(selfRec, 'self')) {
      viewingIdx = -1;
    } else {
      $('f').hidden = false;
      $('result').hidden = true;
    }
  }
  if (isProxy || isSelf) {
    try { localStorage.setItem('wx-mode', isProxy ? 'proxy' : 'self'); } catch {}
  }
}

// 送出表單
$('f').onsubmit = async ev => {
  ev.preventDefault();
  $('err').hidden = true;
  const name = $('name').value.trim();
  if (mode === 'friend' && !name) {
    $('err').textContent = '請先輸入對方的暱稱或稱呼，方便之後查看紀錄喔！';
    $('err').hidden = false;
    $('name').focus();
    return;
  }

  const input = getInput();
  let res;
  try {
    res = WuXing.calc(input);
  } catch {
    $('err').textContent = cal === 'lunar' ? '這個農曆日期不存在，請檢查月份或閏月。' : '這個日期不存在，請再檢查一次。';
    $('err').hidden = false;
    return;
  }

  if (mode === 'self') {
    const rec = { name, input, at: Date.now() };
    saveSelfRecord(rec);
    viewingIdx = -1;
    $('f').hidden = true;
    lastCalc = res;
    lastName = name;
    lastCrystals = renderResult(res, name, 'self');
    if ($('consent').checked) {
      saveToServer(res, name, input, lastCrystals, { measure_type: 'self', friend_seq: '0' });
    }
  } else if (mode === 'friend') {
    const friends = loadFriendsRecords();
    const rec = { name, input, at: Date.now() };
    friends.push(rec);
    saveFriendsRecords(friends);
    viewingIdx = friends.length - 1;
    $('f').hidden = true;
    lastCalc = res;
    lastName = name;
    lastCrystals = renderResult(res, name, 'friend');
    saveToServer(res, name, input, lastCrystals, { measure_type: 'friend', friend_seq: String(friends.length) });
  } else {
    lastCalc = res;
    lastName = name;
    lastCrystals = renderResult(res, name, 'proxy');
    if ($('proxySave').checked) {
      saveToServer(res, name, input, lastCrystals, { proxy: '1', cust_uid: chosenCust?.uid || '', cust_line: chosenCust?.line || '' });
    } else {
      $('status').textContent = '這次沒有保存。';
    }
  }
};

// 按鈕互動
$('goFriend').onclick = () => enterMode('friend');
$('cancelFriend').onclick = () => enterMode('self');
$('backSelfBtn').onclick = () => enterMode('self');
$('viewBarBtn').onclick = () => {
  if (mode === 'friend') enterMode('self');
  else enterMode('friend');
};

$('share').onclick = async () => {
  const url = LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : location.href;
  try {
    if (IS_PROD && liff.isApiAvailable('shareTargetPicker')) {
      await liff.shareTargetPicker([{ type: 'text', text: `我剛測了生日五行，原來不是缺什麼補什麼！你也來看看自己的五行平衡：\n${url}` }]);
      return;
    }
  } catch {}
  try {
    await navigator.clipboard.writeText(url);
    $('share').textContent = '已複製連結';
  } catch {
    $('share').textContent = url;
  }
  setTimeout(() => { $('share').textContent = '分享給朋友測測看'; }, 2000);
};

// 管理者選客人
function setChosenCust(cust) {
  chosenCust = cust;
  $('chosen').hidden = !cust;
  $('finder').hidden = !!cust;
  if (cust) {
    clearSearch();
    $('q').value = '';
    $('chosenName').textContent = cust.name && cust.line && cust.name !== cust.line ? `${cust.name}（LINE：${cust.line}）` : (cust.name || cust.line);
    $('name').value = cust.name || cust.line;
  }
}
document.querySelectorAll('[data-mode]').forEach(btn => {
  btn.onclick = () => enterMode(btn.dataset.mode);
});
$('unchoose').onclick = () => {
  setChosenCust(null);
  $('name').value = '';
  $('q').focus();
};

let searchTimer = 0, searchSeq = 0;
function clearSearch() {
  searchSeq++;
  clearTimeout(searchTimer);
  $('found').innerHTML = '';
  $('listAll').setAttribute('aria-expanded', 'false');
}
async function searchCustomers(q) {
  const seq = ++searchSeq;
  $('found').innerHTML = '<li class="empty">搜尋中…</li>';
  let items = [];
  try {
    items = IS_PROD
      ? ((await callApi({ mode: 'search', q })).items || [])
      : [{ name: '王小美', line: '小美🌸', uid: 'U-demo-1' }, { name: '', line: 'Amy', uid: 'U-demo-2' }].filter(c => !q || (c.name + c.line).includes(q));
  } catch {
    if (seq === searchSeq) $('found').innerHTML = '<li class="empty">名冊讀不到，可以先不選，直接填稱呼。</li>';
    return;
  }
  if (seq !== searchSeq) return;
  $('found').innerHTML = items.length
    ? items.map((c, i) => `<li><button type="button" data-i="${i}"><b>${esc(c.name || c.line)}</b>${c.name && c.line ? `<small>LINE：${esc(c.line)}</small>` : ''}</button></li>`).join('')
    : `<li class="empty">${q ? '名冊裡找不到，可以不選，直接填稱呼。' : '名冊裡還沒有客人。'}</li>`;
  $('found').querySelectorAll('button').forEach(btn => {
    btn.onclick = () => setChosenCust(items[+btn.dataset.i]);
  });
}
$('q').oninput = () => {
  clearTimeout(searchTimer);
  const val = $('q').value.trim();
  $('listAll').setAttribute('aria-expanded', 'false');
  if (val) searchTimer = setTimeout(() => searchCustomers(val), 350);
  else clearSearch();
};
$('listAll').onclick = () => {
  if ($('listAll').getAttribute('aria-expanded') !== 'true') {
    $('q').value = '';
    $('listAll').setAttribute('aria-expanded', 'true');
    searchCustomers('');
  } else {
    clearSearch();
  }
};

function formatCopyText(res, name, recs) {
  const p = res.power, dm = res.dayMaster;
  const favs = [p.use, p.like].filter((e, i, a) => e && a.indexOf(e) === i);
  return [
    `【生日五行】${name || ''}`.trim(),
    `國曆 ${res.solar}・農曆 ${res.lunarText}・${res.clock ? res.clock + '（' + res.hourName + '）' : res.hourName}`,
    `八字：${res.pillars.map(x => x.gz).join(' ')}`,
    `五行：${WuXing.ELS.map(e => `${e} ${res.pct[e]}%`).join('、')}（${res.strong}最旺，${res.weak}較少）`,
    `本命：${dm.stem}${dm.el}`,
    `平衡五行：${favs.join('、')}`,
    p.story ? p.story.end : '',
    `推薦水晶：${recs.map(c => c.name).join('、')}`,
    res.hour < 0 ? '（沒有出生時辰，只用年月日三柱計算）' : '',
    '※ 純屬參考，水晶配戴以眼緣、喜歡與舒服為主。',
  ].filter(Boolean).join('\n');
}
$('copy').onclick = async () => {
  if (!lastCalc) return;
  const txt = formatCopyText(lastCalc, lastName, lastCrystals);
  try {
    await navigator.clipboard.writeText(txt);
    $('copy').textContent = '已複製';
  } catch {
    window.prompt('複製下面的文字', txt);
  }
  setTimeout(() => { $('copy').textContent = '複製結果，貼給客人'; }, 2000);
};
$('next').onclick = () => {
  resetFormFields();
  $('result').hidden = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function enableAdmin() {
  $('adminBar').hidden = false;
  let m = 'self';
  try { m = localStorage.getItem('wx-mode') === 'proxy' ? 'proxy' : 'self'; } catch {}
  if (m === 'proxy') enterMode('proxy');
}

async function init() {
  // 檢查是否已經有本人的五行檔案
  const selfRec = loadSelfRecord();
  if (selfRec) {
    viewingIdx = -1;
    showSavedRecord(selfRec, 'self');
  }

  if (IS_PROD) {
    try {
      await liff.init({ liffId: LIFF_ID });
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: location.href });
        return;
      }
      if (!selfRec && !$('name').value) {
        try { $('name').placeholder = '例如：' + (await liff.getProfile()).displayName; } catch {}
      }
      const data = await callApi({ mode: 'crystals' });
      if (Array.isArray(data?.items) && data.items.length) crystalsList = data.items;
      if (data?.admin) enableAdmin();
    } catch {}
  } else if (new URLSearchParams(location.search).has('admin')) {
    enableAdmin();
  }
}
init();
