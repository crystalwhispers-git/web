/* 生日五行（加權分布）＋日主強弱與平衡五行（參考扶抑觀念的日主強弱評分）＋台灣夏令時間修正：Crystal Whispers 水晶呢喃
   2026-11-16 依 Notion「本站的五行計算方式」最下方 ChatGPT 核對意見修改：
   - 不再用分數自動判定從強／從弱（從格要看整體結構），改標「極強／極弱」＋「疑似特殊格局」，喜用照一般扶抑方向
   - 「缺行」分兩種：0 分＝沒有出現；大於 0、低於 5%＝很少（占比低不等於不存在）
   - 調候改成季節提示，不直接說「喜火／喜水」；和忌神衝突時另外標示
   - 不知道時辰、出生當天交節：標成暫估
   藏干權重用本檔的 HIDDEN 表順序（不是 lunar-javascript 的藏干陣列），例如巳＝丙 0.6、戊 0.3、庚 0.1。
   八字用 lunar-javascript：年柱以立春、月柱以節的交節時刻為界；晚子時（23 點後）日柱算隔天（和流亡者排盤相同）。
   加權：天干每個 1 分；地支每個 1 分，依藏干拆開（本氣 0.6／中氣 0.3／餘氣 0.1，兩個藏干 0.7／0.3）；月支（月令）再乘 2。
   不知道時辰就只算年、月、日三柱。 */
(function (root) {
  var STEM_EL = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  var HIDDEN = {
    子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'], 辰: ['戊', '乙', '癸'], 巳: ['丙', '戊', '庚'],
    午: ['丁', '己'], 未: ['己', '丁', '乙'], 申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
  };
  var SPLIT = { 1: [1], 2: [0.7, 0.3], 3: [0.6, 0.3, 0.1] };
  var MONTH_WEIGHT = 2;
  var ELS = ['木', '火', '土', '金', '水'];
  // 時辰：0 早子（0–1 點）、1 丑 … 11 亥、12 晚子（23–24 點）；-1 不知道
  var HOURS = [
    { name: '早子', range: '0–1', h: 0, m: 30 }, { name: '丑', range: '1–3', h: 2 }, { name: '寅', range: '3–5', h: 4 },
    { name: '卯', range: '5–7', h: 6 }, { name: '辰', range: '7–9', h: 8 }, { name: '巳', range: '9–11', h: 10 },
    { name: '午', range: '11–13', h: 12 }, { name: '未', range: '13–15', h: 14 }, { name: '申', range: '15–17', h: 16 },
    { name: '酉', range: '17–19', h: 18 }, { name: '戌', range: '19–21', h: 20 }, { name: '亥', range: '21–23', h: 22 },
    { name: '晚子', range: '23–24', h: 23, m: 30 },
  ];
  var DAY_MASTER = {
    甲: '像一棵大樹：正直、有擔當，喜歡一直往上長。',
    乙: '像花草藤蔓：柔軟有韌性，很懂得變通。',
    丙: '像太陽：熱情大方，走到哪裡都亮。',
    丁: '像燭光：細膩溫暖，能照亮身邊的人。',
    戊: '像一座山：穩重可靠，讓人有安全感。',
    己: '像田園的土：包容踏實，很會照顧人。',
    庚: '像礦石刀劍：果斷講義氣，做事俐落。',
    辛: '像珠寶：精緻有品味，很重視細節。',
    壬: '像江河大海：聰明有遠見，喜歡自由。',
    癸: '像雨露：溫柔敏銳，直覺很準。',
  };
  var MEANING = { 木: '成長、計畫、人緣', 火: '熱情、行動、表達', 土: '穩定、信任、累積', 金: '決斷、紀律、貴人', 水: '智慧、溝通、靈活' };

  function pad(n) { return String(n).padStart(2, '0'); }

  // ===== 夏令時間（台灣）：這些期間時鐘比標準時間（UTC+8）快 1 小時，排八字要先減回來 =====
  // 依 IANA 時區資料庫 Asia/Taipei；每段是 [開始日, 結束日]（含），日治時期 1937/10/1–1945/9/20 用東京時間也一樣處理
  var DST = [
    ['1937-10-01', '1945-09-20'], ['1946-05-15', '1946-09-30'], ['1947-04-15', '1947-10-31'], ['1948-05-01', '1948-09-30'],
    ['1949-05-01', '1949-09-30'], ['1950-05-01', '1950-09-30'], ['1951-05-01', '1951-09-30'], ['1952-03-01', '1952-10-31'],
    ['1953-04-01', '1953-10-31'], ['1954-04-01', '1954-10-31'], ['1955-04-01', '1955-09-30'], ['1956-04-01', '1956-09-30'],
    ['1957-04-01', '1957-09-30'], ['1958-04-01', '1958-09-30'], ['1959-04-01', '1959-09-30'], ['1960-06-01', '1960-09-30'],
    ['1961-06-01', '1961-09-30'], ['1974-04-01', '1974-09-30'], ['1975-04-01', '1975-09-30'], ['1979-07-01', '1979-09-30'],
  ];
  function dstOf(ymd) {
    for (var i = 0; i < DST.length; i++) if (ymd >= DST[i][0] && ymd <= DST[i][1]) return DST[i][0] < '1946' ? '日治時期東京時間' : '夏令時間';
    return '';
  }
  // 切換當下（2026-11-16，依 IANA Asia/Taipei 查證）：
  //   開始日 00:00 直接跳到 01:00 → 00:00–00:59 不存在
  //   台灣夏令結束日 23:59 撥回 23:00 → 23:00–23:59 走兩次（第一次夏令、第二次標準）
  //   日治東京時間 1945-09-21 01:00 撥回 00:00 → 9/21 的 00:00–00:59 走兩次
  // 回傳 { label, state }：state = on（要扣 1 小時）／off／nonexist（不存在）／ambiguous（走兩次）
  function dstAt(ymd, h) {
    if (ymd === '1945-09-21') return h === 0 ? { label: '日治時期東京時間', state: 'ambiguous' } : { label: '', state: 'off' };
    for (var i = 0; i < DST.length; i++) {
      var P = DST[i];
      if (ymd < P[0] || ymd > P[1]) continue;
      var label = P[0] < '1946' ? '日治時期東京時間' : '夏令時間';
      if (ymd === P[0] && h === 0) return { label: label, state: 'nonexist' };
      if (ymd === P[1] && h === 23 && P[0] >= '1946') return { label: label, state: 'ambiguous' };
      return { label: label, state: 'on' };
    }
    return { label: '', state: 'off' };
  }
  var hourIndex = function (h) { return h === 23 ? 12 : h === 0 ? 0 : Math.floor((h + 1) / 2); };

  // ===== 十神分組：以日主五行為中心 =====
  var GEN = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };   // 生
  var CTRL = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };  // 剋
  function groups(D) {
    var yin = ELS.filter(function (e) { return GEN[e] === D; })[0];     // 生我＝印
    var guan = ELS.filter(function (e) { return CTRL[e] === D; })[0];   // 剋我＝官殺
    return { 比劫: D, 印: yin, 食傷: GEN[D], 財: CTRL[D], 官殺: guan };
  }
  var SEASON = { 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水', 子: '水', 丑: '土' };

  // ===== 寓教於樂：用大自然比喻解釋「為什麼不直接缺什麼補什麼」 =====
  var NATURE_WEAK = {
    木: '你的本命屬「木」，就像一株正在紮根成長的樹木。當本身能量還不夠強壯時，最忌諱急著拿剪刀修剪（金），或過度開花結果、抓土消耗養分（火、土）；這時候最需要的是「水」來澆灌滋養，以及「木」來穩固根基，先把底氣養足，自然枝繁葉茂。',
    火: '你的本命屬「火」，就像一盞溫暖的火苗。當火勢還不夠旺時，若直接澆水（水）或拿去鍛燒礦石、烘烤大地（金、土），反而會把熱量耗盡；這時候最需要的是「木」來添柴助燃，以及「火」來匯聚光芒，讓溫暖的能量先穩定燃燒起來。',
    土: '你的本命屬「土」，就像一片溫厚的大地。當土壤還比較鬆散時，若種滿大樹（木）、大水沖刷（水）或過度開採礦石（金），土地反而負荷太重；這時候最需要的是「火」的陽光溫暖，以及「土」來厚實地基，先把根基穩固好，才能承載萬物。',
    金: '你的本命屬「金」，就像一塊珍貴的礦石。當礦石還在孕育、質地較薄時，不宜直接用烈火鍛燒（火）或過度淘洗消耗（水、木）；這時候最需要的是「土」的大地孕育包覆（土生金），以及「金」的同類礦脈凝聚，先讓質地飽滿堅實，自然會發光。',
    水: '你的本命屬「水」，就像一道清澈的溪流。當水源還不夠充沛時，若被太多泥土堵住（土）或急著去灌溉大片森林（木、火），很容易讓自己乾涸；這時候最需要的是「金」的礦脈水源滋養（金生水），以及「水」來匯聚能量，先把水庫裝滿，走得才長遠。',
  };
  var NATURE_STRONG = {
    木: '你的本命屬「木」，而且枝葉非常茂盛、能量充沛！就像一棵已經長得很壯的大樹，這時候如果再一直澆水（水）反而容易積水；最需要的是陽光讓它開花結果（火）、寬廣的土地去紮根伸展（土），或是適度修剪枝葉（金），讓滿滿的生命力發揮出來。',
    火: '你的本命屬「火」，而且熱力十足、能量充沛！就像一團旺盛的火焰，如果再一直丟木柴（木）進去只會太過燥熱；這時候最需要的是大地來收納轉化熱能（土）、鍛造出珍貴的成果（金），或是溫和的水氣來調節降溫（水），讓熱情變得穩定又持久。',
    土: '你的本命屬「土」，就像一座厚實穩固的高山！因為根基已經非常飽滿，若再一直堆土只會顯得沉悶；這時候最需要的是展現大地蘊藏的礦石寶藏（金）、清泉流動帶來靈活與財氣（水），或是樹木疏通土壤帶來生機（木），讓能量活絡起來。',
    金: '你的本命屬「金」，就像質地堅硬飽滿的礦石與珠寶！因為金氣已經很充足，再一直堆疊反而顯得剛硬；這時候最需要的是清泉洗滌讓光芒流動（水）、適度淬煉成器（火），或是發揮決斷力的舞台（木），讓你的才華與魅力被看見。',
    水: '你的本命屬「水」，就像水量充沛的江河大海！因為水勢已經很滿，若再一直加水反而容易滿溢；這時候最需要的是去灌溉樹木、發揮才華（木）、陽光映照帶來溫暖行動力（火），或是穩固河道把能量聚集成踏實的成果（土）。',
  };
  function buildStory(D, level, useEl, likeEl, weak, missing, tiao, tiaoEl, avoidEl) {
    var favs = [useEl, likeEl].filter(function (e, i, a) { return e && a.indexOf(e) === i; });
    var isDiff = favs.indexOf(weak) < 0;
    // missing＝完全沒出現（0 分）的五行
    var weakText = missing && missing.length ? '沒有出現「' + missing.join('、') + '」' : '「' + weak + '」佔比最少';
    var tag, lead, body, end;
    if (level === '身強' || level === '中和偏強' || level === '極強') {
      tag = '能量充沛・宜疏通發揮';
      lead = isDiff
        ? '很多人以為八字少什麼就要補什麼，看到上方圖表' + weakText + '，就會想直接買「' + weak + '」系水晶。其實看五行就像調養體質，不是數字少就硬塞喔！'
        : '一般人常說「缺什麼補什麼」，但其實要先確認那個較少的五行，是不是你本命真正需要的能量！';
      body = NATURE_STRONG[D];
      end = isDiff
        ? '所以比起單純補最少的「' + weak + '」，你真正需要的是能幫你疏通並發揮能量的「' + favs.join('、') + '」系水晶！'
        : '而你命盤中較少的「' + weak + '」，剛好就是能幫你疏通並發揮能量的關鍵拼圖，非常適合透過「' + favs.join('、') + '」系水晶來平衡！';
    } else {
      tag = '能量偏弱・宜滋養充電';
      lead = isDiff
        ? '很多人以為八字少什麼就要補什麼，看到上方圖表' + weakText + '，就會想直接買「' + weak + '」系水晶。其實看五行就像調養體質，不能只看哪格數字少就硬補喔！'
        : '一般人常說「缺什麼補什麼」，但其實要先確認那個較少的五行，是不是能滋養你本命的能量！';
      body = NATURE_WEAK[D];
      end = isDiff
        ? '所以比起去補最少的「' + weak + '」，現在最適合你的是能幫你充電滋養的「' + favs.join('、') + '」系水晶！'
        : '而你命盤中較少的「' + weak + '」，剛好就是能幫你充電滋養的關鍵能量，非常適合透過「' + favs.join('、') + '」系水晶來補足底氣！';
    }
    if (level === '極強' || level === '極弱') {
      tag += '・結構特殊';
      end += '（你的命盤能量分布比較極端，可能屬於特殊格局，電腦只依一般原則推算，建議和 Sammi 一對一確認。）';
    }
    // 調候只當季節提示；剛好是忌神時不給確定建議
    if (tiao) {
      end += tiaoEl === avoidEl
        ? '（另外，你出生在' + (tiaoEl === '火' ? '冬季，氣場偏寒' : '夏季，氣場偏燥') + '，季節上會想到「' + tiaoEl + '」，但它和上面的判讀方向不同，建議一對一再確認。）'
        : '（另外，你出生在' + (tiaoEl === '火' ? '冬季，氣場偏寒，可以留意一點「火」的溫暖。' : '夏季，氣場偏燥，可以留意一點「水」的滋潤。') + '）';
    }
    return { tag: tag, lead: lead, body: body, end: end, isDiff: isDiff };
  }

  // ===== 滴天髓旺衰法（扶抑）：看日主得不得令、有沒有根、同類（比劫＋印）占多少，決定身強身弱與用神 =====
  function strength(pillars, score, D, weak, missing) {
    var G = groups(D);
    var monthBr = pillars[1].gz[1], mEl = STEM_EL[HIDDEN[monthBr][0]];
    var season = mEl === D ? '旺' : GEN[mEl] === D ? '相' : GEN[D] === mEl ? '休' : CTRL[D] === mEl ? '囚' : '死';
    var deLing = season === '旺' || season === '相';
    // 有根：地支藏干裡有和日主同五行的字
    var roots = pillars.filter(function (p) { return HIDDEN[p.gz[1]].some(function (s) { return STEM_EL[s] === D; }); }).map(function (p) { return p.label + '支' + p.gz[1]; });
    var total = ELS.reduce(function (a, e) { return a + score[e]; }, 0) - 1;   // 不算日主自己
    var same = score[D] - 1 + score[G.印];
    var ratio = total > 0 ? same / total : 0;
    var g = {}; Object.keys(G).forEach(function (k) { g[k] = k === '比劫' ? score[G[k]] - 1 : score[G[k]]; });
    var use, like, avoid, why;
    // 區間（幫身比例 ratio，分母＝全部分數扣日主 1 分）：
    //   ≥80% 極強｜60%–未滿 80% 身強｜50%–未滿 60% 中和偏強｜40%–未滿 50% 中和偏弱｜未滿 40% 身弱｜未滿 20% 且地支無根 極弱（先判）
    // 極強／極弱只標「疑似特殊格局」，喜用照一般扶抑方向，不自動判從格、不反轉
    var special = ratio >= 0.8 || (ratio < 0.2 && !roots.length);
    var level;
    if (ratio >= 0.5) {
      level = ratio >= 0.8 ? '極強' : ratio >= 0.6 ? '身強' : '中和偏強';
      if (g.印 > g.比劫) { use = '財'; like = '食傷'; why = '幫你的力量以「印」為主，用財來平衡（財剋印）。'; }
      else if (g.官殺 >= 0.5) { use = '官殺'; like = '財'; why = '同類的力量多，用官殺來約束、讓力量有方向。'; }
      else { use = '食傷'; like = '財'; why = '同類的力量多，用食傷把能量發揮出去。'; }
      avoid = '印';
    } else {
      level = ratio < 0.2 && !roots.length ? '極弱' : ratio < 0.4 ? '身弱' : '中和偏弱';
      var heavy = ['財', '官殺', '食傷'].sort(function (a, b) { return g[b] - g[a]; })[0];
      if (heavy === '財') { use = '比劫'; like = '印'; avoid = '官殺'; why = '壓力主要來自「財」，用同類的比劫幫身扛住。'; }
      else { use = '印'; like = '比劫'; avoid = '財'; why = heavy === '官殺' ? '壓力主要來自官殺，用印來化解並生扶自己。' : '力量被食傷洩得多，用印來補充、也制住食傷。'; }
    }
    // 調候（寒暖燥濕）只當季節提示：冬天出生火未滿 10%、夏天出生水未滿 10%；跟忌神衝突時標示「方向不同」
    var tiao = '', tiaoEl = '';
    var pct = function (e) { return score[e] / (total + 1) * 100; };
    if ('亥子丑'.indexOf(monthBr) >= 0 && pct('火') < 10) { tiaoEl = '火'; tiao = '冬天出生、命局偏寒，季節上可以留意「火」的溫暖。'; }
    if ('巳午未'.indexOf(monthBr) >= 0 && pct('水') < 10) { tiaoEl = '水'; tiao = '夏天出生、命局偏燥，季節上可以留意「水」的滋潤。'; }
    var tiaoConflict = !!tiaoEl && tiaoEl === G[avoid];
    if (tiaoConflict) tiao += '但扶抑判讀把「' + tiaoEl + '」列為忌神，兩種看法方向不同，需要進一步確認。';
    if (special) why += '（能量分布比較極端，可能是特殊格局，電腦不自動判定，建議一對一確認。）';
    var story = buildStory(D, level, G[use], G[like], weak || '', missing || [], tiao, tiaoEl, G[avoid]);
    return {
      level: level, ratio: Math.round(ratio * 1000) / 10, season: season, deLing: deLing, roots: roots,
      use: G[use], useGod: use, like: G[like], likeGod: like, avoid: G[avoid], avoidGod: avoid, why: why, tiao: tiao, groups: G,
      special: special, tiaoEl: tiaoEl, tiaoConflict: tiaoConflict,
      story: story,
    };
  }

  // input: { y, m, d, lunar: bool, leap: bool, hour: -1..12, time: 'HH:MM'（可省略，有填就以它為準） }
  function calc(input, L) {
    L = L || root;
    var hour = input.hour == null ? -1 : +input.hour;
    var solarDay;
    if (input.lunar) {
      var lm = input.leap ? -Math.abs(input.m) : +input.m;
      var lu = L.Lunar.fromYmd(+input.y, lm, +input.d);
      // lunar-javascript 對不存在的閏月或日數不一定會報錯，換算回去比對
      if (lu.getYear() !== +input.y || lu.getMonth() !== lm || lu.getDay() !== +input.d) throw new Error('農曆日期不存在');
      solarDay = lu.getSolar();
    } else {
      var js = new Date(+input.y, +input.m - 1, +input.d);
      if (js.getFullYear() !== +input.y || js.getMonth() !== +input.m - 1 || js.getDate() !== +input.d) throw new Error('日期不存在');
      solarDay = L.Solar.fromYmd(+input.y, +input.m, +input.d);
    }
    var ymd = solarDay.getYear() + '-' + pad(solarDay.getMonth()) + '-' + pad(solarDay.getDay());
    var dst = dstOf(ymd), exact = /^\d{1,2}:\d{2}$/.test(input.time || '') ? input.time : '';
    var solar, clock = '', corrected = '', dstAmbiguous = false, dstPick = '';
    if (exact) {
      var hm = exact.split(':').map(Number);
      clock = pad(hm[0]) + ':' + pad(hm[1]);
      // 有確切時間：依切換當下判斷要不要扣（不存在的時間報錯；走兩次的時間看 dstPick，沒選就當第一次＝夏令並標暫估）
      var at = dstAt(ymd, hm[0]);
      if (at.state === 'nonexist') { var ne = new Error('這個時間不存在'); ne.code = 'dst-nonexist'; ne.label = at.label; throw ne; }
      if (at.state === 'ambiguous') {
        dstAmbiguous = true;
        dstPick = input.dstPick === 'second' ? 'second' : 'first';
        dst = dstPick === 'first' ? at.label : '';
      } else dst = at.state === 'on' ? at.label : '';
      // 夏令時間：減 1 小時（可能跨回前一天）
      var t = new Date(Date.UTC(solarDay.getYear(), solarDay.getMonth() - 1, solarDay.getDay(), hm[0], hm[1]) - (dst ? 3600e3 : 0));
      solar = L.Solar.fromYmdHms(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), t.getUTCHours(), t.getUTCMinutes(), 0);
      corrected = dst ? pad(t.getUTCHours()) + ':' + pad(t.getUTCMinutes()) : '';
      hour = hourIndex(t.getUTCHours());
    } else {
      var H = hour >= 0 ? HOURS[hour] : { h: 12, m: 0 };
      solar = L.Solar.fromYmdHms(solarDay.getYear(), solarDay.getMonth(), solarDay.getDay(), H.h, H.m || 0, 0);
    }
    var lunar = solar.getLunar();
    var ec = lunar.getEightChar();
    ec.setSect(1); // 晚子時日柱算隔天
    var pillars = [
      { label: '年', gz: ec.getYear() },
      { label: '月', gz: ec.getMonth() },
      { label: '日', gz: ec.getDay() },
    ];
    if (hour >= 0) pillars.push({ label: '時', gz: ec.getTime() });

    var score = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    pillars.forEach(function (p) {
      score[STEM_EL[p.gz[0]]] += 1;
      var hs = HIDDEN[p.gz[1]], w = p.label === '月' ? MONTH_WEIGHT : 1;
      hs.forEach(function (s, i) { score[STEM_EL[s]] += SPLIT[hs.length][i] * w; });
    });
    var total = ELS.reduce(function (a, e) { return a + score[e]; }, 0);
    var pct = {};
    ELS.forEach(function (e) { pct[e] = Math.round(score[e] / total * 1000) / 10; });
    var order = ELS.slice().sort(function (a, b) { return score[b] - score[a]; });
    var dayStem = pillars[2].gz[0];
    // 沒有出現（0 分，已含藏干）／很少（大於 0、未滿 5%）分開；占比低不等於不存在
    var missing = ELS.filter(function (e) { return score[e] === 0; });
    var low = ELS.filter(function (e) { return score[e] > 0 && score[e] / total < 0.05; });
    // 暫估：不知道時辰（少一柱、晚子時日柱也可能不同）；或出生當天剛好交「節」又沒有確切時間（年柱／月柱可能不同）
    var jie = solarDay.getLunar().getCurrentJie();
    var jieDay = jie ? jie.getName().replace('惊蛰', '驚蟄').replace('芒种', '芒種') : '';
    return {
      solar: ymd,
      lunarText: (lunar.getYearInGanZhi() + '年 ' + lunar.getMonthInChinese() + '月' + lunar.getDayInChinese()).replace(/闰/g, '閏').replace(/腊/g, '臘'),
      hour: hour, hourName: hour >= 0 ? HOURS[hour].name + '時' : '不知道時辰',
      clock: clock, corrected: corrected, dst: dst,
      pillars: pillars,
      score: score, pct: pct,
      strong: order[0],
      weak: order[4],
      weak2: order[3],
      missing: missing,
      low: low,
      jieDay: jieDay,
      // 夏令期間只選時辰：扣 1 小時一定跨兩個時辰，也標暫估；走兩次的時間沒選第幾次也是暫估
      tentative: hour < 0 || (!!jieDay && !exact) || (!!dst && !exact) || (dstAmbiguous && input.dstPick !== 'first' && input.dstPick !== 'second'),
      dstAmbiguous: dstAmbiguous,
      dstPick: dstPick,
      dayMaster: { stem: dayStem, el: STEM_EL[dayStem], text: DAY_MASTER[dayStem] },
      power: strength(pillars, score, STEM_EL[dayStem], order[4], missing),
    };
  }

  var api = { calc: calc, HOURS: HOURS, ELS: ELS, MEANING: MEANING, STEM_EL: STEM_EL, HIDDEN: HIDDEN, dstOf: dstOf, dstAt: dstAt, groups: groups };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WuXing = api;
})(typeof self !== 'undefined' ? self : this);
