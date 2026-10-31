// テナントに Action App が見当たらないので、架空の名前で形だけ確かめる
import { flow, hitl } from "@uipath/maestro-builder-sdk";
export default flow("ghost-app").name("GhostApp")
  .step("review", hitl({ variant: "action-app", title: "確認", app: { name: "NoSuchApp", key: "00000000-0000-4000-8000-000000000001", folderPath: "NoSuchFolder" }, outcomes: ["Submit"] }))
  .build();
