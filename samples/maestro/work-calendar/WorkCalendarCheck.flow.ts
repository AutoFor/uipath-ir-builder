// Maestro Automate の見本：稼働日カレンダー（Data Fabric の表 WorkCalendar）を読み、今日 RPA を動かすかを決める。
// 表は samples/apps/work-calendar.json の App で編集する。RPA 側の同じ判定は samples/apps/work-calendar-rpa/ir/IsRunDay.json。
// 決めごと：今日の行が無い → 動かさない。祝日 → 動かさない。それ以外は RunRpa の値。
//
//   node tools/maestro/verify.mjs --automate --pack samples/maestro/work-calendar/WorkCalendarCheck.flow.ts

import { flow, script, dataFabricRead, js } from "@uipath/maestro-builder-sdk";

export default flow("WorkCalendarCheck")
  .name("WorkCalendarCheck")
  // 今日の日付（日本時間）を yyyy-MM-dd にする
  .step("today", script({ code: `const d = new Date(Date.now() + 9 * 3600 * 1000); return { date: d.toISOString().slice(0, 10) };` }))
  .step("day", dataFabricRead({ entity: "WorkCalendar", resultMode: "multiple", limit: 1, filters: [{ field: "WorkDate", operator: "=", value: js`$vars.today.output.date` }] }))
  .step("decide", script({
    code: `const r = ($vars.day.output.results || [])[0];
if (!r) return { run: false, reason: "登録が無い日", date: $vars.today.output.date };
if (r.IsHoliday) return { run: false, reason: "祝日（" + (r.HolidayName || "") + "）", date: $vars.today.output.date };
return { run: !!r.RunRpa, reason: r.RunRpa ? "RPA を動かす日" : "RPA を動かさない日", date: $vars.today.output.date };`,
  }))
  .build();
