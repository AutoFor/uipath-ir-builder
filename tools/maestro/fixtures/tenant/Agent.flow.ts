// テナントの資源（AUT-1079）：テスト用エージェント uipath-ir-test-agent（語を大文字にして返すだけ）を呼ぶ。実行で確かめた
import { flow, agent } from "@uipath/maestro-builder-sdk";
export default flow("agent-node").name("AgentNode")
  .step("ask", agent({ key: "f168598c-3b3a-4873-ab20-022c5798f19d", name: "uipath-ir-test-agent", folderPath: "PERSONAL_WORKSPACE/uipath-ir-test-agent", inputs: { input: "ok" } }))
  .build();
