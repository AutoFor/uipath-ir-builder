// デプロイして確かめる見本：ビジネスルール（DMN のデシジョン テーブル）を BPMN から呼ぶ（Orchestrator.BusinessRules、bpmn:businessRuleTask）。
// ルールは uip rules init Tier で作った rules プロジェクト（"VIP" → "gold"、それ以外 → "standard"）を、同じソリューションでデプロイしたもの。
// 結果は <id>_businessRuleResponse に { <decision>: { <列の label>: 値 } } で入る（outputs の独自の写しは null のままだった）。
// 列の label を name と同じにしておく（label が "Output 1" だと Output_1 になる）。PERSONAL_WORKSPACE は実際の名前に置き換えて流す。
// パックした zip は tools/maestro/fix-entry-points.py で直してから publish する（.uirule を .dmn そのものにする）。
import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";

export default bpmn("RuleCall")
  .name("RuleCall")
  .startEvent("start")
  .businessRule("rule", { process: "Tier", folder: "PERSONAL_WORKSPACE/MaestroDeployTest", input: { input1: "VIP" } })
  .scriptTask("check", { script: "const tier = vars.rule_businessRuleResponse?.decision1?.output1; if (tier !== 'gold') throw new Error('RULE=' + JSON.stringify(vars.rule_businessRuleResponse)); return { tier };" })
  .endEvent("done")
  .sequenceFlow("start", "rule")
  .sequenceFlow("rule", "check")
  .sequenceFlow("check", "done")
  .build();
