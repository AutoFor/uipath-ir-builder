// `uip df entities list --output json` の出力から、Studio Web の書き出しと同じ形の .entities/EntitiesStore.json を作る。
// Studio Web の書き出しは、その App を保存したときのテナントの表しか入っていない（あとで作った表は入らない）。
// 新しく作った表を RPA から使うときに、Studio Web で開き直さずに定義を足すためのもの。
//
//   node tools/apps/df-entities-store.ts <df entities list の JSON> <元の EntitiesStore.json> <表の名前>... --out <EntitiesStore.json>
//
// 元の EntitiesStore.json（Studio Web の書き出し）から SystemUser と選択肢セットを引き継ぎ、指定した表を df の出力から作って足す
// （同じ名前の表があれば置き換える）。そのあと tools/apps/rpa-app-entities.ts で使う表だけに絞れる。
// 別のテナントの表を使うときは --rebase で、元の書き出しの組み込みの表（SystemUser）と選択肢セットの id をそのテナントのものにする。
// 作った人・直した人の id は 0 にする（rpa-app-entities.ts と同じ）。

import { readFileSync, writeFileSync } from "node:fs";

const ZERO = "00000000-0000-0000-0000-000000000000";

// df の型名（論理名）→ 書き出しの sqlType の名前（SQL の型）。Studio Web の書き出しと df の一覧を突き合わせて決めた（2026-11-14）。
// FILE は書き出しの例が無く、参照の列（RELATIONSHIP）と同じ UNIQUEIDENTIFIER とみなす
export const SQL_TYPE: Record<string, string> = {
  STRING: "NVARCHAR", MULTILINE_TEXT: "NVARCHAR", DATETIME_WITH_TZ: "DATETIMEOFFSET", DECIMAL: "DECIMAL", DATE: "DATE",
  BOOLEAN: "BIT", UUID: "UNIQUEIDENTIFIER", RELATIONSHIP: "UNIQUEIDENTIFIER", FILE: "UNIQUEIDENTIFIER", CHOICE_SET_SINGLE: "INT",
};
// 入れ子の参照の定義で、df と書き出しで名前が違うキー
const RENAME: Record<string, string> = { fieldDataType: "sqlType", createdTime: "createTime", updatedTime: "updateTime", isAnalyticsEnabled: "isInsightsEnabled" };

type Json = Record<string, any>;

/** df の表（PascalCase）を、書き出しの EntitiesJson の表（camelCase）にする */
export function toEntitiesJsonEntity(e: Json): Json {
  return {
    entityClass: "Native",
    name: e.Name,
    displayName: e.DisplayName,
    entityTypeId: e.EntityTypeId,
    entityType: e.EntityType,
    description: e.Description,
    folderId: e.FolderId,
    fields: (e.Fields ?? []).map((f: Json) => {
      const out: Json = {
        id: f.Id,
        name: f.Name,
        isPrimaryKey: f.IsPrimaryKey,
        isForeignKey: f.IsForeignKey,
        isExternalField: f.IsExternalField,
        isHiddenField: f.IsHiddenField,
        fieldCategoryId: f.FieldCategoryId,
        isUnique: f.IsUnique,
        ...(f.ReferenceName ? { referenceName: f.ReferenceName } : {}),
        ...(f.ReferenceEntity ? { referenceEntity: deepLower(f.ReferenceEntity) } : {}),
        ...(f.ReferenceField ? { referenceField: deepLower(f.ReferenceField) } : {}),
        ...(f.ReferenceChoiceSet ? { referenceChoiceSet: deepLower(f.ReferenceChoiceSet) } : {}),
        referenceType: f.ReferenceType,
        sqlType: sqlType(f.FieldDataType),
        isRequired: f.IsRequired,
        isEncrypted: f.IsEncrypted,
        displayName: f.DisplayName,
        description: f.Description,
        createTime: f.CreatedTime,
        createdBy: ZERO,
        updateTime: f.UpdatedTime,
        updatedBy: ZERO,
        isSystemField: f.IsSystemField,
        ...(f.ReferenceEntity ? { fieldDisplayType: displayType(f) } : {}),
        isAttachment: f.IsAttachment,
        isRbacEnabled: f.IsRbacEnabled,
        isModelReserved: f.IsModelReserved,
        orderable: f.Orderable,
      };
      return out;
    }),
    // 書き出しは件数と容量を 0 で持つ（その時点の値は型に関係しない）
    recordCount: 0,
    storageSizeInMB: 0,
    usedStorageSizeInMB: 0,
    isRbacEnabled: e.IsRbacEnabled,
    isInsightsEnabled: e.IsAnalyticsEnabled,
    invalidIdentifiers: e.InvalidIdentifiers,
    isModelReserved: e.IsModelReserved,
    id: e.Id,
    createdBy: ZERO,
    createTime: e.CreatedTime,
    updateTime: e.UpdatedTime,
    updatedBy: ZERO,
  };
}

/** df の表を、書き出しの Entities（PascalCase の要約）にする */
export function toStoreEntity(e: Json): Json {
  return {
    Id: e.Id,
    Name: e.Name,
    DisplayName: e.DisplayName,
    Description: e.Description,
    CreateTime: e.CreatedTime,
    UpdateTime: e.UpdatedTime,
    Fields: (e.Fields ?? []).map((f: Json) => ({
      Id: f.Id,
      Name: f.Name,
      DisplayName: f.DisplayName,
      Description: f.Description,
      CreateTime: f.CreatedTime,
      UpdateTime: f.UpdatedTime,
      SqlType: { Name: SQL_TYPE[f.FieldDataType?.Name] ?? f.FieldDataType?.Name, LengthLimit: f.FieldDataType?.LengthLimit ?? null, MaxValue: f.FieldDataType?.MaxValue ?? null, MinValue: f.FieldDataType?.MinValue ?? null, DecimalPrecision: f.FieldDataType?.DecimalPrecision ?? null },
      IsSystemField: f.IsSystemField,
      IsEncrypted: f.IsEncrypted,
      IsRequired: f.IsRequired,
      ReferenceEntity: f.ReferenceEntity ? { Name: f.ReferenceEntity.Name, Id: f.ReferenceEntity.Id, FolderId: f.ReferenceEntity.FolderId } : null,
      ReferenceType: f.ReferenceType,
      FieldDisplayType: f.ReferenceEntity ? displayType(f) : (f.FieldDisplayType ?? "Basic"),
      ReferenceChoiceSet: f.ReferenceChoiceSet ?? null,
      ReferenceField: f.ReferenceField ? { Id: f.ReferenceField.Id } : null,
      IsAttachment: f.IsAttachment,
      IsExternalField: f.IsExternalField,
      ExternalFieldMappingDetail: null,
      Searchability: f.Searchability ?? null,
      Orderable: f.Orderable,
    })),
    RecordCount: 0,
    FolderId: e.FolderId,
    EntityType: e.EntityType,
    EntityClass: "Native",
  };
}

/** 参照の列の表示の種類。ファイルの列（EntityAttachment を指す）は File、ほかは Relationship（ファイルの列は書き出しの例が無く推測） */
function displayType(f: Json): string {
  return f.FieldDataType?.Name === "FILE" || f.ReferenceEntity?.Name === "EntityAttachment" ? "File" : "Relationship";
}
function sqlType(t: Json | undefined): Json | undefined {
  if (!t) return t;
  const o: Json = { name: SQL_TYPE[t.Name] ?? t.Name };
  // 参照の列は名前だけ（書き出しと同じ）
  if (!["RELATIONSHIP", "UUID", "FILE"].includes(t.Name)) for (const [k, v] of Object.entries(t)) if (k !== "Name" && v !== null && v !== undefined) o[k[0].toLowerCase() + k.slice(1)] = v;
  return o;
}
function deepLower(v: any): any {
  if (Array.isArray(v)) return v.map(deepLower);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => {
    const lk = k[0].toLowerCase() + k.slice(1);
    return [RENAME[lk] ?? lk, lk === "fieldDataType" ? deepLower(x) : deepLower(x)];
  }));
  return v;
}

/** 元の書き出しに、df の表を足す（同じ名前は置き換える） */
export function addEntities(store: Json, dfEntities: Json[], names: string[]): Json {
  const ej = JSON.parse(store.EntitiesJson);
  const picked = names.map((n) => {
    const e = dfEntities.find((x) => x.Name === n);
    if (!e) throw new Error(`df の一覧に表 ${n} が無い`);
    return e;
  });
  ej.entities = [...ej.entities.filter((e: Json) => !names.includes(e.name)), ...picked.map(toEntitiesJsonEntity)];
  const entities = [...(store.Entities ?? []).filter((e: Json) => !names.includes(e.Name)), ...picked.map(toStoreEntity)];
  const selected = [...new Set([...(store.SelectedEntitiesNames ?? []), ...names])];
  return { ...store, EntitiesJson: JSON.stringify(ej), Entities: entities, SelectedEntitiesNames: selected };
}

/**
 * 元の書き出しを、別のテナントの id に付け替える（--rebase）。SystemUser のような組み込みの表と選択肢セットは、
 * 中身が同じで id だけがテナントごとに違うので、元の書き出しの形のまま id だけ差し替える。
 * df の一覧に無い表（そのテナントに無い業務の表）は落とす。
 */
export function rebaseStore(store: Json, dfEntities: Json[], dfChoiceSets: Json[]): Json {
  const ej = JSON.parse(store.EntitiesJson);
  const byName = new Map(dfEntities.map((e) => [e.Name, e]));
  const fieldId = (entity: string | undefined, field: string | undefined) => byName.get(entity ?? "")?.Fields?.find((x: Json) => x.Name === field)?.Id;
  const csId = new Map(dfChoiceSets.map((c) => [c.Name, c.Id]));
  const csOldToNew = new Map<string, string>((ej.choicesets ?? []).filter((c: Json) => csId.has(c.name)).map((c: Json) => [c.id, csId.get(c.name)]));
  const entOldName = new Map<string, string>((ej.entities ?? []).map((e: Json) => [e.id, e.name]));
  const fieldOldName = new Map<string, string>((ej.entities ?? []).flatMap((e: Json) => (e.fields ?? []).map((x: Json) => [x.id, x.name])));
  const remapField = (x: Json, owner: string) => {
    const r = { ...x, id: fieldId(owner, x.name) ?? x.id };
    if (x.referenceEntity) {
      const target = x.referenceEntity.name;
      r.referenceEntity = { ...x.referenceEntity, id: byName.get(target)?.Id ?? x.referenceEntity.id };
      if (x.referenceField) {
        const fname = x.referenceField.definition?.name ?? fieldOldName.get(x.referenceField.id);
        const nid = fieldId(target, fname) ?? x.referenceField.id;
        r.referenceField = { ...x.referenceField, id: nid, ...(x.referenceField.definition ? { definition: { ...x.referenceField.definition, id: nid } } : {}) };
      }
    }
    if (x.choiceSetId) r.choiceSetId = csOldToNew.get(x.choiceSetId) ?? x.choiceSetId;
    return r;
  };
  ej.entities = (ej.entities ?? []).filter((e: Json) => byName.has(e.name)).map((e: Json) => ({ ...e, id: byName.get(e.name)!.Id, fields: (e.fields ?? []).map((x: Json) => remapField(x, e.name)) }));
  ej.choicesets = (ej.choicesets ?? []).filter((c: Json) => csId.has(c.name)).map((c: Json) => ({ ...c, id: csId.get(c.name) }));
  const entities = (store.Entities ?? []).filter((e: Json) => byName.has(e.Name)).map((e: Json) => ({
    ...e,
    Id: byName.get(e.Name)!.Id,
    Fields: (e.Fields ?? []).map((x: Json) => {
      const r: Json = { ...x, Id: fieldId(e.Name, x.Name) ?? x.Id };
      if (x.ReferenceEntity) r.ReferenceEntity = { ...x.ReferenceEntity, Id: byName.get(x.ReferenceEntity.Name)?.Id ?? x.ReferenceEntity.Id };
      if (x.ReferenceField) r.ReferenceField = { ...x.ReferenceField, Id: fieldId(x.ReferenceEntity?.Name ?? entOldName.get(x.ReferenceEntity?.Id), fieldOldName.get(x.ReferenceField.Id)) ?? x.ReferenceField.Id };
      if (x.ReferenceChoiceSet) r.ReferenceChoiceSet = { ...x.ReferenceChoiceSet, Id: csId.get(x.ReferenceChoiceSet.Name) ?? x.ReferenceChoiceSet.Id };
      return r;
    }),
  }));
  const names = new Set(entities.map((e: Json) => e.Name));
  return { ...store, EntitiesJson: JSON.stringify(ej), Entities: entities, SelectedEntitiesNames: (store.SelectedEntitiesNames ?? []).filter((n: string) => names.has(n)) };
}

function main() {
  const args = process.argv.slice(2);
  const take = (flag: string) => { const i = args.indexOf(flag); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
  const out = take("--out");
  const rebase = take("--rebase"); // df choice-sets list の JSON。元の書き出しを df の一覧のテナントの id に付け替える
  const rest = args;
  const [listPath, basePath, ...names] = rest;
  if (!listPath || !basePath || names.length === 0 || !out) {
    console.error("使い方: node tools/apps/df-entities-store.ts <df entities list の JSON> <元の EntitiesStore.json> <表の名前>... --out <EntitiesStore.json> [--rebase <df choice-sets list の JSON>]");
    process.exit(2);
  }
  const list = JSON.parse(readFileSync(listPath, "utf8"));
  const dfEntities: Json[] = list.Data ?? list;
  let store = JSON.parse(readFileSync(basePath, "utf8"));
  if (rebase) { const cs = JSON.parse(readFileSync(rebase, "utf8")); store = rebaseStore(store, dfEntities, cs.Data ?? cs); }
  writeFileSync(out, JSON.stringify(addEntities(store, dfEntities, names), null, 2));
  console.log(`OK  ${names.join(", ")} を足した → ${out}`);
}

if (process.argv[1] && process.argv[1].endsWith("df-entities-store.ts")) main();
