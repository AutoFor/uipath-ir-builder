// Maestro Flow の見本：チャット（会話のトリガー → 次の発言を待つ → 会話のエージェントが答える → 決まった文を送る）。
// 会話のトリガーは既定の入口にする（でないと発火しない）。エージェントの返事は out("reply", "uipath__agent_response_messages")。
// conversationalAgent の maxIterations は 8 以下（Studio Web の検証）。SDK の既定はそれを超え、verify.mjs は止めないので明示する。
import { flow, conversationTrigger, waitForMessage, conversationalAgent, sendMessage, out } from "@uipath/maestro-builder-sdk";

export default flow("Chat")
  .name("Chat")
  .trigger(conversationTrigger())
  .step("listen", waitForMessage({ conversationId: out("start", "conversationId") }))
  .step("reply", conversationalAgent({ model: "gpt-4o-mini-2024-07-18", systemPrompt: "You are a support agent. Be brief.", maxIterations: 5, settings: { context: out("listen", "conversationContext") } }))
  .step("bye", sendMessage({ conversationId: out("start", "conversationId"), exchangeId: out("listen", "conversationContext.latestExchangeId"), content: "Thanks. Anything else?" }))
  .build();
