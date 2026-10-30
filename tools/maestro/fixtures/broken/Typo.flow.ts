// 綴りの間違い。types だけが「code では？」と言う。check は内部エラー、validate は warning
import { flow, script } from "@uipath/maestro-builder-sdk";
export default flow("typo").name("Typo")
  .step("a", script({ cod: "return 1;" }))
  .build();
