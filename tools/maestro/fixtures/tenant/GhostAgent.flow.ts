// テナントにエージェントが無い（registry で 0 件）ので、架空の名前で形だけ確かめる
import { flow, agent } from "@uipath/maestro-builder-sdk";
export default flow("ghost-agent").name("GhostAgent")
  .step("ask", agent({ key: "00000000-0000-4000-8000-000000000001", name: "NoSuchAgent", folderPath: "NoSuchFolder", inputs: { q: "x" } }))
  .build();
