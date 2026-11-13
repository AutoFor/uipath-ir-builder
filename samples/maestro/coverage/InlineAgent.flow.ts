// Maestro Flow の見本：flow の中で定義するエージェント（Autonomous agent）。AI の課金がある（小さいモデルと短い出力にした）。
// 実行には compile が .flow の横に書く <id>/agent.json もプロジェクトに要る（tools/maestro/debug.mjs が写す。無いと Package resolution failed）。
// 返す値は returns で宣言し、プロンプトでそれを返して終えるよう指示する（指示が無いと、モデルが「エラーとして終える」を選ぶことがある）。
import { flow, inlineAgent, script } from "@uipath/maestro-builder-sdk";

export default flow("InlineAgent")
  .name("InlineAgent")
  .step("triage", inlineAgent({
    model: "gpt-4o-mini-2024-07-18",
    systemPrompt: "You answer simple questions. Always finish by returning the answer in the output field `answer` (one word: yes or no). Never raise an error.",
    userPrompt: "Is 7 a prime number?",
    returns: { answer: "string" },
    maxTokenPerResponse: 256,
    maxIterations: 3,
  }))
  .step("show", script({ code: "return { answer: $vars.triage.output.answer };" }))
  .build();
