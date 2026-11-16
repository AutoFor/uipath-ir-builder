// デプロイして確かめる見本：Quartz の Cron（6〜7 項目）で動く Automate の flow（AUT-1192）。
// SDK は every が Cron ならトリガーの 1.2 の定義（timerType / timerValue）で書く。タイムゾーンは書けず UTC で動くので、
// 日本時間の「毎朝 9 時」は UTC の 0 時：every: "0 0 0 * * ?"。確かめるときは毎分（"0 * * * * ?"）にして、確かめたら外す。
import { flow, scheduled, script } from "@uipath/maestro-builder-sdk";

export default flow("CronTick")
  .name("CronTick")
  .trigger(scheduled({ every: "0 * * * * ?" }))
  .step("tick", script({ code: "return { at: new Date().toISOString() };" }))
  .build();
