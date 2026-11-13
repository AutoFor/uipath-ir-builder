// デプロイして確かめる見本：ビジネスルール（DMN のデシジョン テーブル）を BPMN から呼ぶ（Orchestrator.BusinessRules、bpmn:businessRuleTask）。
// ルールは uip rules init Tier で作った rules プロジェクト（"VIP" → "gold"、それ以外 → "standard"）を、同じソリューションでデプロイしたもの。
// 結果はデシジョンの名前で入る：=result.<decision>.<列>。PERSONAL_WORKSPACE は実際の名前に置き換えて流す。
import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";

export default bpmn("RuleCall")
  .name("RuleCall")
  .var("tier", "string")
  .startEvent("start")
  .businessRule("rule", { process: "Tier", folder: "PERSONAL_WORKSPACE/MaestroDeployTest", input: { input1: "VIP" }, outputs: { tier: "=result.decision1.output1" } })
  .scriptTask("check", { script: "if (vars.tier !== 'gold') throw new Error('TIER=' + JSON.stringify(vars.tier)); return { ok: true };" })
  .endEvent("done")
  .sequenceFlow("start", "rule")
  .sequenceFlow("rule", "check")
  .sequenceFlow("check", "done")
  .build();
