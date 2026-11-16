// Flow の Extract（Studio Web の「Extract document」、SDK の dynamicExtract）の項目の定義が、設計時の上限を超えていないか見る（AUT-1203 の 13）。
// 上限（IXP の flow-user-guide の faq-design-time）：1 フィールド グループ 32 項目まで、名前 64 文字まで、指示（description）4,096 文字まで。
// 項目の定義は、ノードの inputs.schemaDocument.outputSchema（knowledge/maestro.md の 10 節）：
//   最上位の各プロパティがフィールド グループ。1 件なら properties、繰り返しなら items.properties に項目が並ぶ。

export const LIMITS = { fields: 32, name: 64, instruction: 4096 };

/** .flow の JSON の文字列から、上限を超えた所を [{ where, message }] で返す */
export function extractLimitIssues(flowText) {
  let flow;
  try { flow = JSON.parse(flowText); } catch { return []; }
  const out = [];
  for (const node of flow?.nodes ?? []) {
    const doc = node?.inputs?.schemaDocument;
    const schema = typeof doc === "string" ? safeParse(doc)?.outputSchema : doc?.outputSchema;
    if (!schema?.properties) continue;
    for (const [group, g] of Object.entries(schema.properties)) {
      const at = `${node.id}.${group}`;
      if (group.length > LIMITS.name) out.push({ where: at, message: `フィールド グループの名前が ${LIMITS.name} 文字を超える（${group.length} 文字）` });
      const fields = g?.properties ?? g?.items?.properties ?? {};
      const names = Object.keys(fields);
      if (names.length > LIMITS.fields) out.push({ where: at, message: `1 つのフィールド グループの項目が ${LIMITS.fields} を超える（${names.length} 個）` });
      for (const n of names) {
        if (n.length > LIMITS.name) out.push({ where: `${at}.${n}`, message: `項目の名前が ${LIMITS.name} 文字を超える（${n.length} 文字）` });
        const d = fields[n]?.description;
        if (typeof d === "string" && d.length > LIMITS.instruction) out.push({ where: `${at}.${n}`, message: `項目の指示が ${LIMITS.instruction} 文字を超える（${d.length} 文字）` });
      }
    }
  }
  return out;
}

function safeParse(s) { try { return JSON.parse(s); } catch { return undefined; } }
