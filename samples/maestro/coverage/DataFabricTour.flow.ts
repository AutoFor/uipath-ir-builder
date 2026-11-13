// Maestro Flow の見本：Data Fabric の 4 つのノード（作成・クエリ・更新・削除）を 1 本で通す。
// 表は WorkCalendar（samples/apps/work-calendar.json）。2099-01-01 の試しの行を作り、最後に消す。
// Data Fabric のノードはエラーの道を付けられない（knowledge/maestro.md）。途中で落ちたら試しの行が残るので、uip df records で消す。

import { flow, script, dataFabricCreate, dataFabricRead, dataFabricUpdate, dataFabricDelete, js } from "@uipath/maestro-builder-sdk";

export default flow("DataFabricTour")
  .name("DataFabricTour")
  .step("add", dataFabricCreate({ entity: "WorkCalendar", values: { WorkDate: "2099-01-01", IsHoliday: js`false`, RunRpa: js`false`, HolidayName: "maestro-test" } }))
  .step("find", dataFabricRead({ entity: "WorkCalendar", resultMode: "single", filters: [{ field: "WorkDate", operator: "=", value: "2099-01-01" }] }))
  .step("before", script({ code: "return { run: $vars.find.output.RunRpa, id: $vars.add.output.Id };" }))
  .step("turnOn", dataFabricUpdate({ entity: "WorkCalendar", record: { fromRead: "find" }, set: { RunRpa: js`true` } }))
  .step("after", script({ code: "return { run: $vars.turnOn.output.RunRpa };" }))
  .step("remove", dataFabricDelete({ entity: "WorkCalendar", record: { byId: js`$vars.add.output.Id` } }))
  .step("done", script({ code: "return { before: $vars.before.output.run, after: $vars.after.output.run };" }))
  .build();
