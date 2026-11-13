// Maestro Flow の見本：電話（着信 → 音声のエージェント → 切る）。手元の検証だけ。
// 着信のトリガーはキャンバスからデバッグできず、デプロイして番号を結び、実際に電話する。発信（createOutgoingCall）はデバッグでも本当にかけて課金される。
import { flow, voiceTrigger, voiceAgent, endCall, out } from "@uipath/maestro-builder-sdk";

export default flow("Voice")
  .name("Voice")
  .trigger(voiceTrigger())
  .step("greet", voiceAgent({ systemPrompt: "Greet the caller and find out why they called.", callContext: out("start", "callContext") }))
  .step("hangUp", endCall({ callContext: out("start", "callContext") }))
  .build();
