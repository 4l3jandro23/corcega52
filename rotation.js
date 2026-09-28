/* Córcega 52 · lógica pura de rotación y fechas.
   Sin DOM: se usa en el navegador (window.Rotacion) y en Node (tests). */
(function(root){
  var ROOMIES = ["Alejandro","Ana","Natalia","Rocío"];

  // NO cambiar: copiado tal cual de tareas-piso.html
  var CYCLE = [
    {A:"Alejandro", B:"Ana"},
    {A:"Natalia",   B:"Rocío"},
    {A:"Ana",       B:"Alejandro"},
    {A:"Rocío",     B:"Natalia"}
  ];
  var LAVABO = ["Alejandro","Rocío"];
  var BASURA = ["Alejandro","Natalia","Rocío","Ana"];
  var TASKS = [
    {key:"A",      icon:"🍽️", zone:"Comedor + balcón",                  short:"comedor"},
    {key:"B",      icon:"🚪", zone:"Pasillo, entrada y cocina a fondo", short:"pasillo y cocina"},
    {key:"lavabo", icon:"🚿", zone:"Lavabo",                            short:"lavabo"},
    {key:"basura", icon:"🗑️", zone:"Sacar la basura",                   short:"basura"}
  ];
  var DEFAULT_EPOCH = "2026-09-14";
  var TZ = "Europe/Madrid";

  // ---------- fechas "de calendario" (YYYY-MM-DD), sin horas ni UTC de por medio ----------
  function pad(n){ return n<10 ? "0"+n : ""+n; }
  function dayNum(ymd){ var p=ymd.split("-"); return Math.round(Date.UTC(+p[0], +p[1]-1, +p[2]) / 86400000); }
  function fromDayNum(n){ var d=new Date(n*86400000); return d.getUTCFullYear()+"-"+pad(d.getUTCMonth()+1)+"-"+pad(d.getUTCDate()); }
  function mondayOf(ymd){ var n=dayNum(ymd), dow=new Date(n*86400000).getUTCDay(); return fromDayNum(n - (dow===0 ? 6 : dow-1)); }
  function addDays(ymd, n){ return fromDayNum(dayNum(ymd)+n); }
  function addWeeks(ymd, n){ return addDays(ymd, 7*n); }

  // Fecha en hora de España para un instante dado (por defecto, ahora)
  var fmtMadrid = null;
  function madridDate(ts){
    if(!fmtMadrid) fmtMadrid = new Intl.DateTimeFormat("en-GB", {timeZone:TZ, year:"numeric", month:"2-digit", day:"2-digit"});
    var parts = fmtMadrid.formatToParts(ts==null ? new Date() : new Date(ts)), o={};
    parts.forEach(function(p){ o[p.type]=p.value; });
    return o.year+"-"+o.month+"-"+o.day;
  }
  function weekKeyNow(ts){ return mondayOf(madridDate(ts)); }

  function fmt(ymd){
    return new Date(dayNum(ymd)*86400000).toLocaleDateString("es-ES", {day:"numeric", month:"short", timeZone:"UTC"}).replace(".","");
  }
  function ago(ts, nowTs){
    var d = dayNum(madridDate(nowTs)) - dayNum(madridDate(ts));
    return d<=0 ? "hoy" : d===1 ? "ayer" : "hace "+d+" días";
  }

  // ---------- rotación ----------
  function cycleIndex(monday, epoch){
    var wk = Math.round((dayNum(monday) - dayNum(mondayOf(epoch || DEFAULT_EPOCH))) / 7);
    return ((wk%4)+4)%4;
  }
  function baseFor(i){ return {A:CYCLE[i].A, B:CYCLE[i].B, lavabo:LAVABO[i%2], basura:BASURA[i]}; }

  // swapsWeek: {A:"Ana", ...} solo con las tareas cambiadas esa semana
  function assignFor(monday, epoch, swapsWeek){
    var i=cycleIndex(monday, epoch), base=baseFor(i), sw=swapsWeek||{}, who={}, swapped={};
    TASKS.forEach(function(t){
      if(sw[t.key] && sw[t.key]!==base[t.key]){ who[t.key]=sw[t.key]; swapped[t.key]=base[t.key]; }
      else who[t.key]=base[t.key];
    });
    return {who:who, swapped:swapped, base:base, idx:i};
  }

  var api = {
    ROOMIES:ROOMIES, CYCLE:CYCLE, LAVABO:LAVABO, BASURA:BASURA, TASKS:TASKS, DEFAULT_EPOCH:DEFAULT_EPOCH,
    dayNum:dayNum, mondayOf:mondayOf, addDays:addDays, addWeeks:addWeeks,
    madridDate:madridDate, weekKeyNow:weekKeyNow, fmt:fmt, ago:ago,
    cycleIndex:cycleIndex, baseFor:baseFor, assignFor:assignFor
  };
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  else root.Rotacion=api;
})(this);
