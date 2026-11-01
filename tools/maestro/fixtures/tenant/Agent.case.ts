// テナントの資源（AUT-1079）：Case のタスクからテスト用エージェントを呼ぶ
import { casePlan, rule } from "@uipath/maestro-builder-sdk/case";
export default casePlan("agent-node").name("AgentNode").identifier("AGT")
  .stage("Run", (s) => s.entryWhen(rule("case-entered"))
    .task("Ask", (t) => t.agent("uipath-ir-test-agent", { folder: "seiya-kawashima@autofor.co.jp's workspace/uipath-ir-test-agent" }).inputs({ input: "ok" }).entryWhen(rule("current-stage-entered")))
    .exitWhen(rule("selected-tasks-completed", { tasks: ["Ask"] }), { marksStageComplete: true }))
  .completeWhen(rule("selected-stage-completed", { stage: "Run" }), { marksCaseComplete: true })
  .build();
