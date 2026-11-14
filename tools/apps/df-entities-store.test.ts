import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addEntities, toEntitiesJsonEntity, toStoreEntity } from "./df-entities-store.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
// df entities list の WorkCalendar と、同じ表を Studio Web が書き出したもの（2026-11-13）
const df = read("./fixtures/df-workcalendar.json");
const store = read("./fixtures/store-workcalendar.json");

test("df の表から、Studio Web の書き出しと同じ EntitiesJson の表を作る（キーの順も同じ）", () => {
  assert.equal(JSON.stringify(toEntitiesJsonEntity(df)), JSON.stringify(JSON.parse(store.EntitiesJson).entities[0]));
});

test("df の表から、Studio Web の書き出しと同じ Entities の要約を作る", () => {
  assert.equal(JSON.stringify(toStoreEntity(df)), JSON.stringify(store.Entities[0]));
});

test("同じ名前の表は置き換え、選んだ表の名前に足す", () => {
  const base = { EntitiesJson: JSON.stringify({ entities: [{ name: "WorkCalendar", old: true }], choicesets: [] }), Entities: [{ Name: "WorkCalendar", old: true }], SelectedEntitiesNames: ["WorkCalendar"] };
  const out = addEntities(base, [df], ["WorkCalendar"]);
  const ej = JSON.parse(out.EntitiesJson);
  assert.equal(ej.entities.length, 1);
  assert.equal(ej.entities[0].old, undefined);
  assert.deepEqual(ej.choicesets, []);
  assert.deepEqual(out.SelectedEntitiesNames, ["WorkCalendar"]);
  assert.throws(() => addEntities(base, [df], ["Nope"]), /Nope/);
});

test("--rebase：組み込みの表と選択肢セットの id を、別のテナントの df の一覧の id に付け替える", async () => {
  const { rebaseStore } = await import("./df-entities-store.ts");
  const ej = JSON.parse(store.EntitiesJson);
  const e = ej.entities[0];
  const other = { ...df, Id: "11111111-1111-1111-1111-111111111111", Fields: df.Fields.map((f: any, i: number) => ({ ...f, Id: `22222222-2222-2222-2222-${String(i).padStart(12, "0")}` })) };
  const base = { ...store, EntitiesJson: JSON.stringify({ entities: [e, { name: "Gone", id: "x", fields: [] }], choicesets: [{ name: "UserType", id: "old" }, { name: "Nope", id: "y" }] }), Entities: [...store.Entities, { Name: "Gone", Id: "x", Fields: [] }], SelectedEntitiesNames: ["WorkCalendar", "Gone"] };
  const out = rebaseStore(base, [other], [{ Name: "UserType", Id: "new" }]);
  const r = JSON.parse(out.EntitiesJson);
  assert.deepEqual(r.entities.map((x: any) => x.name), ["WorkCalendar"]);
  assert.equal(r.entities[0].id, other.Id);
  assert.equal(r.entities[0].fields[0].id, other.Fields.find((f: any) => f.Name === e.fields[0].name).Id);
  assert.deepEqual(r.choicesets, [{ name: "UserType", id: "new" }]);
  assert.equal(out.Entities.length, 1);
  assert.equal(out.Entities[0].Id, other.Id);
  assert.deepEqual(out.SelectedEntitiesNames, ["WorkCalendar"]);
});
