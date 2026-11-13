// デプロイして確かめる見本（knowledge/maestro.md の「デプロイして確かめたこと」）：5 分ごとに動く Automate の flow。
// 定期実行のトリガーはデプロイしないと動かない（デバッグは既定の入口だけ）。確かめたら solution deploy uninstall で外す。
import { flow, scheduled, script } from "@uipath/maestro-builder-sdk";

export default flow("Nightly")
  .name("Nightly")
  .trigger(scheduled({ every: "R/PT5M" }))
  .step("tick", script({ code: "return { at: new Date().toISOString() };" }))
  .build();
