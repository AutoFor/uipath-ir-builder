// デプロイして確かめる見本：デプロイ済みの別の BPMN（Child）を呼んで待つ（Call activity。Orchestrator.StartAgenticProcess）。
// folder は Child をデプロイしたフォルダ。PERSONAL_WORKSPACE は実際の個人ワークスペースの名前に置き換えて流す（メールアドレスが入るのでコミットしない）。
// 子の戻り値は =result（{ doubled: 42 }）と =result.doubled（42）で読めた。子は終了イベントの mapping で返す（Child.bpmn.ts）。違えば投げる。
import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";

export default bpmn("Parent")
  .name("Parent")
  .var("whole", "object")
  .var("doubled", "number")
  .startEvent("start")
  .startAgenticProcess("callChild", { process: "Child", folder: "PERSONAL_WORKSPACE/MaestroDeployTest", input: { n: 21 }, outputs: { whole: "=result", doubled: "=result.doubled" } })
  .scriptTask("check", { script: "if (vars.doubled !== 42) throw new Error('CHILD=' + JSON.stringify({ whole: vars.whole, doubled: vars.doubled })); return { ok: true };" })
  .endEvent("done")
  .sequenceFlow("start", "callChild")
  .sequenceFlow("callChild", "check")
  .sequenceFlow("check", "done")
  .build();
