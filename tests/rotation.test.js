// Compara la rotación de rotation.js con la del tareas-piso.html original.
// Uso: node tests/rotation.test.js [ruta/al/tareas-piso.html]
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const R = require("../rotation.js");

const origPath = process.argv[2] || path.join(process.env.USERPROFILE || process.env.HOME, "Downloads", "tareas-piso.html");
const html = fs.readFileSync(origPath, "utf8");
const cut = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error("No encuentro " + a); return html.slice(i, j); };

// Código original, literal: arrays + utilidades de fecha + idx4For/assignFor
const origSrc =
  cut("var CYCLE", "var DEFAULT_EPOCH") +
  cut("function pad(n)", "function fmt(") +
  cut("function idx4For", "// ---------- almacenamiento");
const Orig = new Function("state", "DAY", origSrc + "; return {assignFor, ymd, mondayOf, addWeeks};");

let failures = 0;
function check(label, fn) { try { fn(); console.log("  ok  " + label); } catch (e) { failures++; console.log("  FAIL " + label + "\n       " + e.message); } }

const swapsSample = { "2026-10-05": { A: "Ana" }, "2026-10-19": { lavabo: "Rocío", basura: "Natalia" } };
const origState = { epoch: "2026-09-14", swaps: swapsSample };
const O = Orig(origState, 86400000);

check("400 semanas (2025-2033) idénticas al original, con y sin cambios de turno", () => {
  let m = O.mondayOf(new Date(2025, 0, 6));
  for (let w = 0; w < 400; w++) {
    const key = O.ymd(m);
    const a = O.assignFor(m), b = R.assignFor(key, "2026-09-14", swapsSample[key]);
    assert.deepStrictEqual(b.who, a.who, key);
    assert.deepStrictEqual(b.swapped, a.swapped, key);
    assert.strictEqual(b.idx, a.idx, key);
    m = O.addWeeks(m, 1);
  }
});

check("Semana del 28/09/2026 es la semana 3", () => assert.strictEqual(R.cycleIndex("2026-09-28", R.DEFAULT_EPOCH) + 1, 3));
check("Basura: Rocío → Ana → Alejandro → Natalia desde el 28/09", () => {
  const seq = [0, 1, 2, 3].map(i => R.assignFor(R.addWeeks("2026-09-28", i), R.DEFAULT_EPOCH).who.basura);
  assert.deepStrictEqual(seq, ["Rocío", "Ana", "Alejandro", "Natalia"]);
});
check("Lavabo solo alterna Alejandro / Rocío", () => {
  for (let i = 0; i < 12; i++) assert.ok(["Alejandro", "Rocío"].includes(R.assignFor(R.addWeeks("2026-09-14", i)).who.lavabo));
});
check("mondayOf / madridDate", () => {
  assert.strictEqual(R.mondayOf("2026-10-04"), "2026-09-28"); // domingo
  assert.strictEqual(R.mondayOf("2026-09-28"), "2026-09-28");
  assert.strictEqual(R.mondayOf("2026-10-25"), "2026-10-19"); // cambio de hora
  // Domingo 23:30 en España = 21:30/22:30 UTC: sigue siendo la semana del domingo
  assert.strictEqual(R.weekKeyNow(Date.UTC(2026, 9, 4, 21, 30)), "2026-09-28");
  // Lunes 00:30 en España (domingo 22:30 UTC): ya es semana nueva
  assert.strictEqual(R.weekKeyNow(Date.UTC(2026, 9, 4, 22, 30)), "2026-10-05");
});

console.log("\nSemanas a revisar (original vs nueva):");
["2026-09-28", "2026-10-05", "2026-10-12"].forEach(k => {
  const p = k.split("-").map(Number);
  const O2 = Orig({ epoch: "2026-09-14", swaps: {} }, 86400000);
  const a = O2.assignFor(O2.mondayOf(new Date(p[0], p[1] - 1, p[2]))), b = R.assignFor(k, "2026-09-14");
  const line = x => `🍽️ ${x.who.A.padEnd(9)} 🚪 ${x.who.B.padEnd(9)} 🚿 ${x.who.lavabo.padEnd(9)} 🗑️ ${x.who.basura}`;
  console.log(`  ${k} · semana ${b.idx + 1}`);
  console.log("    original: " + line(a));
  console.log("    nueva:    " + line(b) + (JSON.stringify(a.who) === JSON.stringify(b.who) ? "  ✔" : "  ✘"));
});

console.log(failures ? `\n${failures} fallo(s)` : "\nTodo OK");
process.exit(failures ? 1 : 0);
