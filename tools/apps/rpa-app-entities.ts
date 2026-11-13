// Studio Web の書き出し（<App>/.entities/EntitiesStore.json）から、使う Data Fabric の表だけを残した定義を作る。
// 生成器（tools/apps/rpa-app.ts）は IR の "entities" にこのファイルを指定して、表の id・列の id・型を読む。
//
//   node tools/apps/rpa-app-entities.ts <EntitiesStore.json> <表の名前>... --out <file.json>
//
// 書き出しの定義にはテナントにある表がすべて入る（ほかの業務の表の名前や説明も）。ここで次だけに絞る：
//   - 指定した表と、その列が参照している表（CreatedBy などの SystemUser）
//   - それらが使う選択肢セット（choicesets）
// 作った人・直した人の id（createdBy / updatedBy）は 0 にする。

import { readFileSync, writeFileSync } from "node:fs";

type Json = any;
const ZERO = "00000000-0000-0000-0000-000000000000";

export function filterStore(store: Json, names: string[]): Json {
  const all = JSON.parse(store.EntitiesJson);
  const byName = new Map<string, Json>(all.entities.map((e: Json) => [e.name, e]));
  for (const n of names) if (!byName.has(n)) throw new Error(`表 ${n} が書き出しに無い（${[...byName.keys()].join(", ")}）`);
  const keep = new Set<string>();
  const visit = (n: string) => {
    if (keep.has(n) || !byName.has(n)) return;
    keep.add(n);
    for (const f of byName.get(n).fields) if (f.referenceEntity?.name) visit(f.referenceEntity.name);
  };
  names.forEach(visit);
  const entities = all.entities.filter((e: Json) => keep.has(e.name));
  const choiceIds = new Set<string>(entities.flatMap((e: Json) => e.fields.flatMap((f: Json) => [f.choiceSetId, f.referenceChoiceSet?.id].filter(Boolean))));
  const choicesets = (all.choicesets ?? []).filter((c: Json) => choiceIds.has(c.id) || entities.some((e: Json) => JSON.stringify(e).includes(c.id)));
  const scrub = (v: Json): Json => {
    if (Array.isArray(v)) return v.map(scrub);
    if (v && typeof v === "object") {
      const o: Json = {};
      for (const [k, x] of Object.entries(v)) o[k] = /^(createdBy|updatedBy|CreatedBy|UpdatedBy)$/.test(k) && typeof x === "string" ? ZERO : scrub(x);
      return o;
    }
    return v;
  };
  const keepNames = new Set(entities.map((e: Json) => e.name));
  const typed = Array.isArray(store.Entities) ? store.Entities.filter((e: Json) => keepNames.has(e.Name)) : store.Entities;
  return scrub({
    ExportedBy: store.ExportedBy, BundleHash: null, Namespace: store.Namespace, AssemblyName: null,
    EntitiesJson: JSON.stringify(scrub({ entities, choicesets })),
    Entities: typed, SelectedEntitiesNames: names,
  });
}

function main() {
  const args = process.argv.slice(2);
  const oi = args.indexOf("--out");
  if (oi < 0 || args.length < 4) { console.error("usage: node tools/apps/rpa-app-entities.ts <EntitiesStore.json> <表の名前>... --out <file.json>"); process.exit(2); }
  const out = args[oi + 1];
  const [src, ...names] = args.filter((_, i) => i !== oi && i !== oi + 1);
  const r = filterStore(JSON.parse(readFileSync(src, "utf8")), names);
  writeFileSync(out, JSON.stringify(r, null, 2) + "\n");
  const kept = JSON.parse(r.EntitiesJson).entities.map((e: Json) => e.name);
  console.log(`OK ${out}（表：${kept.join(", ")}）`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop()!)) main();
