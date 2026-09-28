/* Córcega 52 · capa de datos.
   Dos implementaciones con la misma interfaz:
   - SupabaseBackend: la de verdad (tablas + Realtime).
   - DemoBackend: localStorage + evento "storage" entre pestañas, solo para probar (?demo).

   Interfaz:
     start(h)   h = {onChange(table, type, row, old), onStatus(s), onSubscribed()}
     reconnect()          fuerza una suscripción nueva (vuelta del segundo plano, red recuperada)
     load(week)           -> Promise<{epoch, checks[], swaps[], compra[]}>
     setCheck(week, task, by) / clearCheck(week, task) / clearWeek(week)
     setSwap(week, task, person) / clearSwap(week, task)
     addItem(id, text, by) / removeItem(id)
     setEpoch(ymd)
   Cada escritura toca UNA fila (o las filas de una semana), nunca un documento entero. */
(function(){
  var TABLES = ["config","checks","swaps","compra"];

  function ok(res){ if(res && res.error) throw res.error; return res; }

  // ======================= Supabase =======================
  function SupabaseBackend(cfg){
    var sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth:{persistSession:false, autoRefreshToken:false, detectSessionInUrl:false}
    });
    var h = null, channel = null, n = 0, attempt = 0, retryTimer = null;

    function subscribe(){
      clearTimeout(retryTimer);
      if(channel){ var old = channel; channel = null; sb.removeChannel(old); }
      h.onStatus("connecting");
      var ch = sb.channel("piso-" + (++n));
      console.debug("[c52] suscribiendo, intento", n);
      TABLES.forEach(function(t){
        ch.on("postgres_changes", {event:"*", schema:"public", table:t}, function(p){
          if(ch === channel) h.onChange(t, p.eventType, p.new, p.old);
        });
      });
      channel = ch;
      ch.subscribe(function(status, err){
        if(ch !== channel) return;                       // canal viejo cerrándose: ignorar
        console.debug("[c52] realtime:", status, err ? err.message : "");
        if(status === "SUBSCRIBED"){ attempt = 0; h.onSubscribed(); }
        else if(status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED"){
          h.onStatus("offline"); scheduleRetry();
        }
      });
    }
    function scheduleRetry(){
      clearTimeout(retryTimer);
      var wait = Math.min(30000, 1000 * Math.pow(2, attempt++));   // 1s, 2s, 4s… hasta 30s
      retryTimer = setTimeout(subscribe, wait);
    }

    return {
      demo:false,
      start:function(handlers){ h = handlers; subscribe(); },
      reconnect:function(){ attempt = 0; subscribe(); },
      retrySoon:scheduleRetry,
      load:function(week){
        return Promise.all([
          sb.from("config").select("epoch").eq("id","main").maybeSingle(),
          sb.from("checks").select("week,task,done_by,done_at").eq("week", week),
          sb.from("swaps").select("week,task,person").gte("week", week),
          sb.from("compra").select("id,text,added_by,created_at").order("created_at")
        ]).then(function(r){
          r.forEach(ok);
          return {epoch:r[0].data && r[0].data.epoch, checks:r[1].data, swaps:r[2].data, compra:r[3].data};
        });
      },
      // Si dos marcan la misma tarea a la vez, se queda el primero (on conflict do nothing)
      setCheck:function(week, task, by){
        return sb.from("checks").upsert({week:week, task:task, done_by:by}, {onConflict:"week,task", ignoreDuplicates:true}).then(ok);
      },
      clearCheck:function(week, task){ return sb.from("checks").delete().eq("week", week).eq("task", task).then(ok); },
      clearWeek:function(week){ return sb.from("checks").delete().eq("week", week).then(ok); },
      setSwap:function(week, task, person){
        return sb.from("swaps").upsert({week:week, task:task, person:person}, {onConflict:"week,task"}).then(ok);
      },
      clearSwap:function(week, task){ return sb.from("swaps").delete().eq("week", week).eq("task", task).then(ok); },
      addItem:function(id, text, by){ return sb.from("compra").insert({id:id, text:text, added_by:by}).then(ok); },
      removeItem:function(id){ return sb.from("compra").delete().eq("id", id).then(ok); },
      setEpoch:function(ymd){
        return sb.from("config").update({epoch:ymd, updated_at:new Date().toISOString()}).eq("id","main").then(ok);
      }
    };
  }

  // ======================= Demo (solo pruebas) =======================
  function DemoBackend(){
    var KEY = "c52_demo_db", EV = "c52_demo_ev", h = null;
    function read(){
      var d; try{ d = JSON.parse(localStorage.getItem(KEY)); }catch(e){}
      d = d || {}; d.checks = d.checks || []; d.swaps = d.swaps || []; d.compra = d.compra || [];
      return d;
    }
    function later(fn){ return new Promise(function(res){ setTimeout(function(){ res(fn()); }, 120); }); }
    // Aplica un cambio, lo guarda y lo emite como haría Realtime (aquí y en las otras pestañas)
    function commit(mutate){
      return later(function(){
        var d = read(), evs = [];
        mutate(d, function(table, type, row, old){ evs.push([table, type, row || {}, old || {}]); });
        localStorage.setItem(KEY, JSON.stringify(d));
        localStorage.setItem(EV, JSON.stringify({n:Math.random(), evs:evs}));
        evs.forEach(function(e){ h.onChange(e[0], e[1], e[2], e[3]); });
      });
    }
    var same = function(week, task){ return function(r){ return r.week === week && r.task === task; }; };
    return {
      demo:true,
      start:function(handlers){
        h = handlers;
        window.addEventListener("storage", function(e){
          if(e.key !== EV || !e.newValue) return;
          try{ JSON.parse(e.newValue).evs.forEach(function(x){ h.onChange(x[0], x[1], x[2], x[3]); }); }catch(err){}
        });
        setTimeout(function(){ h.onSubscribed(); }, 150);
      },
      reconnect:function(){ h.onSubscribed(); },
      retrySoon:function(){},
      load:function(week){
        return later(function(){
          var d = read();
          return {epoch:d.epoch, compra:d.compra,
            checks:d.checks.filter(function(r){ return r.week === week; }),
            swaps:d.swaps.filter(function(r){ return r.week >= week; })};
        });
      },
      setCheck:function(week, task, by){ return commit(function(d, emit){
        if(d.checks.some(same(week, task))) return;
        var row = {week:week, task:task, done_by:by, done_at:new Date().toISOString()};
        d.checks.push(row); emit("checks","INSERT",row);
      }); },
      clearCheck:function(week, task){ return commit(function(d, emit){
        d.checks = d.checks.filter(function(r){ return !same(week, task)(r); });
        emit("checks","DELETE",null,{week:week, task:task});
      }); },
      clearWeek:function(week){ return commit(function(d, emit){
        d.checks.filter(function(r){ return r.week === week; }).forEach(function(r){ emit("checks","DELETE",null,{week:r.week, task:r.task}); });
        d.checks = d.checks.filter(function(r){ return r.week !== week; });
      }); },
      setSwap:function(week, task, person){ return commit(function(d, emit){
        d.swaps = d.swaps.filter(function(r){ return !same(week, task)(r); });
        var row = {week:week, task:task, person:person}; d.swaps.push(row); emit("swaps","UPDATE",row);
      }); },
      clearSwap:function(week, task){ return commit(function(d, emit){
        d.swaps = d.swaps.filter(function(r){ return !same(week, task)(r); });
        emit("swaps","DELETE",null,{week:week, task:task});
      }); },
      addItem:function(id, text, by){ return commit(function(d, emit){
        var row = {id:id, text:text, added_by:by, created_at:new Date().toISOString()};
        d.compra.push(row); emit("compra","INSERT",row);
      }); },
      removeItem:function(id){ return commit(function(d, emit){
        d.compra = d.compra.filter(function(r){ return r.id !== id; });
        emit("compra","DELETE",null,{id:id});
      }); },
      setEpoch:function(ymd){ return commit(function(d, emit){ d.epoch = ymd; emit("config","UPDATE",{id:"main", epoch:ymd}); }); }
    };
  }

  window.PisoDB = {SupabaseBackend:SupabaseBackend, DemoBackend:DemoBackend};
})();
