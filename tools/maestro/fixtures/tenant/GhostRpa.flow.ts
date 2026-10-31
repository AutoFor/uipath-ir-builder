// 穴：テナントに無い RPA。ローカルの検証は通る
import { flow, rpaWorkflow } from "@uipath/maestro-builder-sdk";
export default flow("ghost").name("GhostRpa")
  .step("hello", rpaWorkflow({ key: "00000000-0000-4000-8000-000000000001", name: "NoSuchProcess", folderPath: "NoSuchFolder" }))
  .build();
