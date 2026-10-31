// テナントの資源（AUT-1079）：公開済みの RPA を呼ぶ。キーと名前は registry search で取った実在のもの。実行はしていない
import { flow, rpaWorkflow } from "@uipath/maestro-builder-sdk";
export default flow("rpa-node").name("RpaNode")
  .step("hello", rpaWorkflow({ key: "802eeeb8-d037-4b4c-badf-e6cfc39591a7", name: "TestHelloWorld", folderPath: "Common" }))
  .build();
