/* Córcega 52 · interfaz. Depende de rotation.js (Rotacion), db.js (PisoDB) y config.js (PISO_CONFIG). */
(function(){
  var R = window.Rotacion, CFG = window.PISO_CONFIG || {};
  var ROOMIES = R.ROOMIES, TASKS = R.TASKS;
  var DEMO = new URLSearchParams(location.search).has("demo");
  var LS_WHO = "piso_who", LS_CODE = "c52_codigo";

  function pcls(name){ var i=ROOMIES.indexOf(name); return i<0 ? "" : "p"+i; }
  function ini(name){ return name ? name.charAt(0) : "?"; }
  function $(id){ return document.getElementById(id); }
  function el(tag, cls, text){ var e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
  function safeGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function safeSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function safeDel(k){ try{ localStorage.removeItem(k); }catch(e){} }
  function uuid(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b=crypto.getRandomValues(new Uint8Array(16)); b[6]=(b[6]&15)|64; b[8]=(b[8]&63)|128;
    var h=Array.prototype.map.call(b,function(x){ return (x+256).toString(16).slice(1); }).join("");
    return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20);
  }

  var toastTimer;
  function toast(msg){
    var t=$("toast"); t.textContent=msg; t.hidden=false;
    clearTimeout(toastTimer); toastTimer=setTimeout(function(){ t.hidden=true; }, 3500);
  }

  // ======================= Estado =======================
  var state = {epoch:R.DEFAULT_EPOCH, checks:{}, swaps:{}, compra:[]};
  var me = safeGet(LS_WHO) || "";
  if(ROOMIES.indexOf(me)<0) me = "";
  var weekKey = R.weekKeyNow();
  var backend = null;

  function assign(monday){ return R.assignFor(monday, state.epoch, state.swaps[monday]); }

  // ======================= Render =======================
  function needMe(){
    if(me) return true;
    var p=$("picker"); p.classList.remove("flash"); void p.offsetWidth; p.classList.add("flash");
    p.scrollIntoView({behavior:"smooth", block:"center"}); return false;
  }

  function renderPicker(){
    var p=$("picker"); p.innerHTML="";
    ROOMIES.forEach(function(n){
      var b=el("button","pill "+pcls(n)+(n===me?" active":""));
      b.type="button"; b.setAttribute("aria-pressed", n===me);
      b.appendChild(el("span","av",ini(n))); b.appendChild(el("span",null,n));
      b.addEventListener("click",function(){ me=n; safeSet(LS_WHO,n); renderAll(); });
      p.appendChild(b);
    });
  }

  function renderHeader(cur){
    $("weekLabel").textContent="Semana "+(cur.idx+1)+" de 4";
    $("dateRange").textContent="Del "+R.fmt(weekKey)+" al "+R.fmt(R.addDays(weekKey,6));
  }

  function renderMine(cur){
    var box=$("mine"); box.innerHTML="";
    if(!me){
      var e=el("div","mine empty"); e.appendChild(el("h2",null,"¿Quién eres?"));
      e.appendChild(el("p",null,"Toca tu nombre y verás aquí lo que te toca. Solo hace falta una vez en cada móvil."));
      box.appendChild(e); return;
    }
    var mine=TASKS.filter(function(t){ return cur.who[t.key]===me; });
    var pending=mine.filter(function(t){ return !state.checks[t.key]; });
    var card=el("div","mine "+pcls(me));
    var title = !mine.length ? "Esta semana estás libre, "+me+" 🎉"
              : !pending.length ? "Todo hecho esta semana 👏"
              : "Hola "+me+", te toca";
    card.appendChild(el("h2",null,title));
    if(mine.length){
      var list=el("div","list");
      mine.forEach(function(t){ list.appendChild(el("span","tag"+(state.checks[t.key]?" done":""), t.icon+" "+t.zone)); });
      card.appendChild(list);
    }
    var nexts=[];
    TASKS.forEach(function(t){
      for(var w=1; w<=8; w++){ var m=R.addWeeks(weekKey,w); if(assign(m).who[t.key]===me){ nexts.push({t:t,m:m}); break; } }
    });
    nexts.sort(function(a,b){ return a.m<b.m ? -1 : a.m>b.m ? 1 : 0; });
    if(nexts.length){
      var nx=el("div","next"); nx.appendChild(el("b",null,"Próximo: "));
      nx.appendChild(document.createTextNode(nexts.map(function(n){ return n.t.short+" el "+R.fmt(n.m); }).join(", ")));
      card.appendChild(nx);
    }
    box.appendChild(card);
  }

  var openSwap = null;   // tarea con el selector de cambio abierto (sobrevive a los re-render)
  function renderTasks(cur){
    var box=$("tasks"); box.innerHTML="";
    TASKS.forEach(function(t){
      var who=cur.who[t.key], done=state.checks[t.key];
      var row=el("div","task "+pcls(who)+(done?" done":"")+(openSwap===t.key?" swapping":""));
      var main=el("div","main");
      main.appendChild(el("div","ico",t.icon));
      var txt=el("div","txt"); txt.appendChild(el("div","zone",t.zone));
      var w=el("div","who",who);
      if(me && who===me) w.appendChild(el("span","you","Tú"));
      if(cur.swapped[t.key]) w.appendChild(el("span","sw","cambio"));
      txt.appendChild(w); main.appendChild(txt);
      var chk=el("button","check","✓"); chk.type="button";
      chk.setAttribute("aria-label", (done?"Desmarcar ":"Marcar hecho: ")+t.zone);
      chk.setAttribute("aria-pressed", !!done);
      chk.addEventListener("click",function(){ if(needMe()) toggleCheck(t.key); });
      main.appendChild(chk); row.appendChild(main);

      var sub=el("div","sub");
      if(done) sub.appendChild(el("span","by","Hecho por "+done.by+", "+R.ago(done.at)));
      var sl=el("button","swap-link","Cambiar turno"); sl.type="button";
      sl.setAttribute("aria-expanded", openSwap===t.key);
      sl.addEventListener("click",function(){ openSwap = openSwap===t.key ? null : t.key; renderAll(); });
      sub.appendChild(sl); row.appendChild(sub);

      var chips=el("div","chips");
      (t.key==="lavabo" ? R.LAVABO : ROOMIES).forEach(function(n){
        var c=el("button","chip "+pcls(n)+(n===who?" current":""),n); c.type="button";
        c.addEventListener("click",function(){ openSwap=null; setSwap(t.key, n, cur.base[t.key]); });
        chips.appendChild(c);
      });
      row.appendChild(chips);
      box.appendChild(row);
    });

    var txt="🧹 Turnos del piso, semana del "+R.fmt(weekKey)+"\n"+TASKS.map(function(t){
      return t.icon+" "+t.zone+": "+cur.who[t.key]+(state.checks[t.key]?" ✅":"");
    }).join("\n");
    $("waBtn").href="https://wa.me/?text="+encodeURIComponent(txt);
  }

  function renderCompra(){
    var list=$("buyList"); list.innerHTML="";
    var items=state.compra.slice().sort(function(a,b){ return (a.at||0)-(b.at||0); });
    if(!items.length){ list.appendChild(el("div","empty-msg","No falta nada por ahora ✨")); return; }
    items.forEach(function(it){
      var row=el("label","buy");
      var cb=document.createElement("input"); cb.type="checkbox";
      cb.setAttribute("aria-label","Comprado: "+it.text);
      cb.addEventListener("change",function(){ removeItem(it.id); });
      row.appendChild(cb); row.appendChild(el("span",null,it.text));
      if(it.by){ var b=el("span","by "+pcls(it.by),ini(it.by)); b.title="Lo apuntó "+it.by; row.appendChild(b); }
      list.appendChild(row);
    });
  }

  function renderCal(){
    var body=$("calBody"); body.innerHTML="";
    for(var w=0; w<6; w++){
      var m=R.addWeeks(weekKey,w), a=assign(m);
      var tr=el("tr", w===0?"now":null);
      tr.appendChild(el("td",null,w===0?"Esta":R.fmt(m)));
      TASKS.forEach(function(t){
        var n=a.who[t.key], td=el("td", me?null:"noone");
        var d=el("span","dot "+pcls(n)+(me&&n===me?" me":"")+(a.swapped[t.key]?" swapped":""),ini(n));
        d.title=n+(a.swapped[t.key]?" (cambio con "+a.swapped[t.key]+")":""); td.appendChild(d); tr.appendChild(td);
      });
      body.appendChild(tr);
    }
  }

  function renderAll(){
    var cur=assign(weekKey);
    renderPicker(); renderHeader(cur); renderMine(cur); renderTasks(cur); renderCompra(); renderCal();
    var ep=$("epochInput"); if(document.activeElement!==ep) ep.value=state.epoch;
  }

  // ======================= Conexión =======================
  var status = "connecting";
  function setSync(s){
    status = s;
    var box=$("sync");
    var txt = backend && backend.demo ? (s==="online" ? "Modo demo" : "Conectando…")
            : s==="online" ? "Sincronizado" : s==="offline" ? "Sin conexión" : "Conectando…";
    box.className = "sync" + (s==="online" ? " on" : s==="offline" ? " off" : " connecting");
    box.lastChild.textContent = txt;
  }

  function applySnapshot(d){
    state.epoch = d.epoch || R.DEFAULT_EPOCH;
    var c={}; (d.checks||[]).forEach(function(r){ if(r.week===weekKey) c[r.task]={by:r.done_by, at:Date.parse(r.done_at)}; });
    state.checks = c;
    var s={}; (d.swaps||[]).forEach(function(r){ (s[r.week]=s[r.week]||{})[r.task]=r.person; });
    state.swaps = s;
    state.compra = (d.compra||[]).map(function(r){ return {id:r.id, text:r.text, by:r.added_by, at:Date.parse(r.created_at)}; });
  }

  var loadSeq = 0;
  function resync(){
    var seq = ++loadSeq, wk = weekKey;
    return backend.load(wk).then(function(d){
      if(seq!==loadSeq || wk!==weekKey) return;
      applySnapshot(d); document.body.classList.remove("first-load");
      setSync("online"); renderAll();
    }).catch(function(e){
      if(seq!==loadSeq) return;
      console.warn("No se pudo cargar", e);
      setSync("offline"); backend.retrySoon();
    });
  }

  // Cambio que llega por Realtime (de otro móvil o el eco del nuestro)
  function onChange(table, type, row, old){
    row = row || {}; old = old || {};
    var del = type==="DELETE";
    if(table==="checks"){
      var r = del ? old : row;
      if(!r.week || !r.task){ resync(); return; }
      if(r.week!==weekKey) return;
      if(del) delete state.checks[r.task];
      else state.checks[r.task] = {by:row.done_by, at:Date.parse(row.done_at)};
    } else if(table==="swaps"){
      var s = del ? old : row;
      if(!s.week || !s.task){ resync(); return; }
      if(del){ if(state.swaps[s.week]) delete state.swaps[s.week][s.task]; }
      else (state.swaps[s.week]=state.swaps[s.week]||{})[s.task]=s.person;
    } else if(table==="compra"){
      var id = del ? old.id : row.id;
      if(!id){ resync(); return; }
      state.compra = state.compra.filter(function(x){ return x.id!==id; });
      if(!del) state.compra.push({id:row.id, text:row.text, by:row.added_by, at:Date.parse(row.created_at)});
    } else if(table==="config"){
      if(!del && row.epoch) state.epoch = row.epoch;
    }
    renderAll();
  }

  // ======================= Acciones (optimistas: se ven al momento y se deshacen si falla) =======================
  function save(promise, undo){
    renderAll();
    promise.catch(function(e){
      console.warn("No se pudo guardar", e);
      undo(); renderAll();
      toast(status==="online" ? "No se ha podido guardar. Inténtalo otra vez." : "Sin conexión: no se ha guardado.");
      resync();
    });
  }

  function toggleCheck(key){
    var prev = state.checks[key];
    if(prev){
      delete state.checks[key];
      save(backend.clearCheck(weekKey, key), function(){ state.checks[key]=prev; });
    } else {
      state.checks[key] = {by:me, at:Date.now()};
      save(backend.setCheck(weekKey, key, me), function(){ delete state.checks[key]; });
    }
  }

  function setSwap(key, person, base){
    var wk = weekKey, sw = state.swaps[wk] = state.swaps[wk] || {}, prev = sw[key];
    if(person===base){
      if(!prev){ renderAll(); return; }
      delete sw[key];
      save(backend.clearSwap(wk, key), function(){ sw[key]=prev; });
    } else {
      sw[key] = person;
      save(backend.setSwap(wk, key, person), function(){ if(prev) sw[key]=prev; else delete sw[key]; });
    }
  }

  function addItem(){
    var inp=$("addInput"), v=inp.value.trim();
    if(!v || !needMe()) return;
    var it = {id:uuid(), text:v.slice(0,60), by:me, at:Date.now()};
    state.compra.push(it); inp.value="";
    save(backend.addItem(it.id, it.text, me), function(){
      state.compra = state.compra.filter(function(x){ return x.id!==it.id; });
      if(!inp.value) inp.value = it.text;
    });
  }

  function removeItem(id){
    var it = state.compra.filter(function(x){ return x.id===id; })[0];
    if(!it) return;
    state.compra = state.compra.filter(function(x){ return x.id!==id; });
    save(backend.removeItem(id), function(){ state.compra.push(it); });
  }

  // ======================= Arranque de la app =======================
  function startApp(){
    $("gate").hidden = true; $("app").hidden = false;
    document.body.classList.add("first-load");
    backend = DEMO ? window.PisoDB.DemoBackend() : window.PisoDB.SupabaseBackend(CFG);
    renderAll(); setSync("connecting");

    $("addBtn").addEventListener("click", addItem);
    $("addInput").addEventListener("keydown", function(e){ if(e.key==="Enter"){ e.preventDefault(); addItem(); } });
    $("saveEpoch").addEventListener("click", function(){
      var v=$("epochInput").value; if(!v) return;
      if(R.mondayOf(v)!==v){ toast("Tiene que ser un lunes."); return; }
      var prev=state.epoch; state.epoch=v;
      save(backend.setEpoch(v), function(){ state.epoch=prev; });
      toast("Guardado para todos.");
    });
    $("resetChecks").addEventListener("click", function(){
      if(!confirm("¿Desmarcar todas las tareas de esta semana para todo el piso?")) return;
      var prev=state.checks; state.checks={};
      save(backend.clearWeek(weekKey), function(){ state.checks=prev; });
    });
    $("forgetCode").addEventListener("click", function(){
      if(!confirm("Se pedirá el código otra vez al abrir la app en este móvil.")) return;
      safeDel(LS_CODE); location.reload();
    });

    backend.start({
      onChange:onChange,
      onStatus:setSync,
      onSubscribed:resync      // al (re)conectar se recarga todo, por si algo cambió mientras tanto
    });

    // Cambio de semana con la app abierta (lunes a las 00:00 hora de España)
    function checkWeek(){
      var wk = R.weekKeyNow();
      if(wk!==weekKey){ weekKey=wk; state.checks={}; openSwap=null; renderAll(); resync(); }
    }
    setInterval(checkWeek, 60000);

    // iPhone congela las PWA en segundo plano y el websocket muere: al volver, reconectar
    var hiddenAt = 0;
    document.addEventListener("visibilitychange", function(){
      if(document.hidden){ hiddenAt = Date.now(); return; }
      checkWeek();
      if(Date.now()-hiddenAt > 20000 || status!=="online") backend.reconnect();
      else resync();
    });
    window.addEventListener("online", function(){ backend.reconnect(); });
    window.addEventListener("offline", function(){ setSync("offline"); });
  }

  // ======================= Puerta: código del piso =======================
  function sha256(text){
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function(buf){
      return Array.prototype.map.call(new Uint8Array(buf), function(b){ return (b+256).toString(16).slice(1); }).join("");
    });
  }
  function codeHash(code){ return sha256("corcega52:" + code.trim().toLowerCase()); }

  function showGate(mode){
    $("app").hidden = true; $("gate").hidden = false;
    $("sync").className = "sync"; $("sync").lastChild.textContent = "Bloqueado";
    $("weekLabel").textContent = "Semana " + (R.cycleIndex(weekKey, R.DEFAULT_EPOCH)+1) + " de 4";
    var form=$("gateForm"), inp=$("gateInput"), msg=$("gateMsg");
    if(mode==="noconfig"){
      $("gateTitle").textContent = "Falta configurar";
      $("gateText").textContent = "Rellena SUPABASE_URL y SUPABASE_ANON_KEY en config.js (mira el README).";
      form.hidden = true; return;
    }
    if(mode==="nolib"){
      $("gateTitle").textContent = "Sin conexión";
      $("gateText").textContent = "No se ha podido cargar la app. Comprueba la conexión y vuelve a abrirla.";
      form.hidden = true; return;
    }
    if(mode==="insecure"){
      $("gateTitle").textContent = "Ábrela desde un servidor";
      $("gateText").textContent = "La app necesita https o localhost. Mira el README para probarla en local.";
      form.hidden = true; return;
    }
    if(mode==="setup"){
      $("gateTitle").textContent = "Elige el código del piso";
      $("gateText").textContent = "Aún no hay código en config.js. Escribe el que queráis usar (no distingue mayúsculas) y te daré la línea para pegar.";
      $("gateBtn").textContent = "Generar";
      inp.type = "text";
    }
    form.addEventListener("submit", function(e){
      e.preventDefault();
      var code = inp.value.trim(); msg.textContent = "";
      if(!code){ inp.focus(); return; }
      codeHash(code).then(function(h){
        if(mode==="setup"){
          $("gateLine").textContent = 'CODIGO_PISO_SHA256: "' + h + '"';
          $("gateOut").hidden = false; return;
        }
        if(h === CFG.CODIGO_PISO_SHA256.toLowerCase()){ safeSet(LS_CODE, code); startApp(); }
        else { msg.textContent = "Ese código no es. Pregunta en el grupo del piso."; inp.select(); }
      });
    });
    $("gateCopy").addEventListener("click", function(){
      var t=$("gateLine").textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function(){ toast("Copiado"); }, function(){ toast("Mantén pulsado el texto para copiarlo"); });
    });
    setTimeout(function(){ inp.focus(); }, 50);
  }

  function boot(){
    if(DEMO){ startApp(); return; }
    if(!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY){ showGate("noconfig"); return; }
    if(!window.supabase){ showGate("nolib"); return; }
    if(!window.crypto || !crypto.subtle){ showGate("insecure"); return; }
    if(!CFG.CODIGO_PISO_SHA256){ showGate("setup"); return; }
    var saved = safeGet(LS_CODE);
    if(!saved){ showGate("code"); return; }
    codeHash(saved).then(function(h){
      if(h === CFG.CODIGO_PISO_SHA256.toLowerCase()) startApp();
      else { safeDel(LS_CODE); showGate("code"); }     // el código cambió en config.js
    });
  }

  // Aviso "añádela a la pantalla de inicio": solo en iPhone/iPad con Safari y sin instalar
  (function(){
    var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
    var installed = navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
    if(!ios || installed || safeGet("c52_tip_off")) return;
    $("installTip").hidden = false;
    $("installClose").addEventListener("click", function(){ $("installTip").hidden = true; safeSet("c52_tip_off","1"); });
  })();

  if("serviceWorker" in navigator && (location.protocol==="https:" || location.hostname==="localhost" || location.hostname==="127.0.0.1")){
    navigator.serviceWorker.register("sw.js").catch(function(e){ console.warn("SW", e); });
  }
  boot();
})();
