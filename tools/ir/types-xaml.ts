// IR に書く型名（"String"、"List<String>"、"DataTable" など）を XAML の型表記にする。
// 知らない型はエラーにする（推測で書かない）。

import { excelXamlTypes } from "./excel.ts";

export type XamlType = { text: string; xmlns: Record<string, string> };

const S = "clr-namespace:System;assembly=System.Private.CoreLib";
const SCG = "clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib";
const SD = "clr-namespace:System.Data;assembly=System.Data.Common";
const UCORE = "clr-namespace:UiPath.Core;assembly=UiPath.System.Activities";
const UCA = "clr-namespace:UiPath.Core.Activities;assembly=UiPath.System.Activities";
const SSEC = "clr-namespace:System.Security;assembly=System.Private.CoreLib";
const UCAS = "clr-namespace:UiPath.Core.Activities.Storage;assembly=UiPath.System.Activities";
const UPRH = "clr-namespace:UiPath.Platform.ResourceHandling;assembly=UiPath.Platform";
const SRX = "clr-namespace:System.Text.RegularExpressions;assembly=System.Text.RegularExpressions";
const UPT = "clr-namespace:UiPath.Platform.Triggers;assembly=UiPath.Platform";
const SDIAG = "clr-namespace:System.Diagnostics;assembly=System.Diagnostics.Process";
const SCOM = "clr-namespace:System.Collections.ObjectModel;assembly=System.Private.CoreLib";
const SIO = "clr-namespace:System.IO;assembly=System.Private.CoreLib";

const UI = "http://schemas.uipath.com/workflow/activities";

const simple: Record<string, [string, Record<string, string>]> = {
  String: ["x:String", {}],
  Int32: ["x:Int32", {}],
  Int64: ["x:Int64", {}],
  Boolean: ["x:Boolean", {}],
  Double: ["x:Double", {}],
  Decimal: ["x:Decimal", {}],
  Object: ["x:Object", {}],
  TimeSpan: ["x:TimeSpan", {}],
  DateTime: ["s:DateTime", { s: S }],
  Exception: ["s:Exception", { s: S }],
  ArgumentException: ["s:ArgumentException", { s: S }],
  InvalidOperationException: ["s:InvalidOperationException", { s: S }],
  TimeoutException: ["s:TimeoutException", { s: S }],
  IOException: ["sio:IOException", { sio: SIO }],
  FileNotFoundException: ["sio:FileNotFoundException", { sio: SIO }],
  FileInfo: ["sio:FileInfo", { sio: SIO }],
  DirectoryInfo: ["sio:DirectoryInfo", { sio: SIO }],
  DataTable: ["sd:DataTable", { sd: SD }],
  Activity: ["Activity", {}],
  Timer: ["ucore:Timer", { ucore: UCORE }],
  QueueItem: ["ucore:QueueItem", { ucore: UCORE }],
  "UiPath.Platform.Triggers.TriggerArgs": ["upt:TriggerArgs", { upt: UPT }],
  FileChangeInfo: ["ucore:FileChangeInfo", { ucore: UCORE }],
  ProcessInfo: ["ucore:ProcessInfo", { ucore: UCORE }],
  PasswordCredentials: ["uca:PasswordCredentials", { uca: UCA }],
  SecureString: ["ssec:SecureString", { ssec: SSEC }],
  DataRow: ["sd:DataRow", { sd: SD }],
  // UiPath.System.Activities / UiPath.Platform の型
  OrchestratorJob: ["uca:OrchestratorJob", { uca: UCA }],
  CurrentJobInfo: ["uca:CurrentJobInfo", { uca: UCA }],
  GenericValue: ["ucore:GenericValue", { ucore: UCORE }],
  StorageFileInfo: ["ucas:StorageFileInfo", { ucas: UCAS }],
  ILocalResource: ["upr:ILocalResource", { upr: UPRH }],
  IResource: ["upr:IResource", { upr: UPRH }],
  Process: ["sdiag:Process", { sdiag: SDIAG }],
  Match: ["srx:Match", { srx: SRX }],
  // UiPath.Persistence.Activities の型（Action Center のタスク、ジョブの参照）
  FormTaskData: ["upaf:FormTaskData", { upaf: "clr-namespace:UiPath.Persistence.Activities.FormTask;assembly=UiPath.Persistence.Activities" }],
  ExternalTaskData: ["upae:ExternalTaskData", { upae: "clr-namespace:UiPath.Persistence.Activities.ExternalTask;assembly=UiPath.Persistence.Activities" }],
  // UiPath.UIAutomation.Activities の型（UI 要素）。"UiPath.Core.UiElement" もこの名前で引ける
  UiElement: ["uuia:UiElement", { uuia: "clr-namespace:UiPath.Core;assembly=UiPath.UiAutomation.Activities" }],
  TextInfo: ["uuia:TextInfo", { uuia: "clr-namespace:UiPath.Core;assembly=UiPath.UiAutomation.Activities" }], // GetOCRText.WordsInfo の要素
  Window: ["ui:Window", { ui: UI }],
  Browser: ["ui:Browser", { ui: UI }],
  Region: ["ui:Region", { ui: UI }],
  Anchor: ["ui:Anchor", { ui: UI }], // AnchorBase.Action の引数
  Anchor2Data: ["ui:Anchor2Data", { ui: UI }], // AnchorContextAware の AnchorProvider / TargetProvider の引数
  "UiPath.Core.Image": ["ui:Image", { ui: UI }], // "Image" は System.Drawing.Image（CV の OCREngine の引数）。UiPath の Image はこの完全名で書く
  // UI 操作の出力の型（Out の変数に使う）
  "UiPath.UIAutomationNext.Enums.NPopupHandleState": ["uuinx:NPopupHandleState", { uuinx: "clr-namespace:UiPath.UIAutomationNext.Enums;assembly=UiPath.UIAutomationNext" }],
  "UiPath.UIAutomationNext.Activities.Models.AccessibilityCheckResult": ["uuinm:AccessibilityCheckResult", { uuinm: "clr-namespace:UiPath.UIAutomationNext.Activities.Models;assembly=UiPath.UIAutomationNext.Activities" }],
  Point: ["sdp:Point", { sdp: "clr-namespace:System.Drawing;assembly=System.Drawing.Primitives" }],
  DayOfWeek: ["s:DayOfWeek", { s: S }],
  DataColumn: ["sd:DataColumn", { sd: SD }],
  UInt32: ["x:UInt32", {}],
  Image: ["sdc:Image", { sdc: "clr-namespace:System.Drawing;assembly=System.Drawing.Common" }],
  OcrActivityResult: ["uoc:OcrActivityResult", { uoc: "clr-namespace:UiPath.OCR.Contracts;assembly=UiPath.OCR.Contracts" }], // OCR エンジン（GoogleOCR など）の Output
  Rectangle: ["sdp:Rectangle", { sdp: "clr-namespace:System.Drawing;assembly=System.Drawing.Primitives" }],
};

const generic: Record<string, [string, Record<string, string>]> = {
  List: ["scg:List", { scg: SCG }],
  Dictionary: ["scg:Dictionary", { scg: SCG }],
  Collection: ["scom:Collection", { scom: SCOM }],
  IEnumerable: ["scg:IEnumerable", { scg: SCG }],
  KeyValuePair: ["scg:KeyValuePair", { scg: SCG }],
  IList: ["scg:IList", { scg: SCG }],
  ICollection: ["scg:ICollection", { scg: SCG }],
};

// エイリアス（VB / C# の書き方も受ける）
const alias: Record<string, string> = {
  string: "String", int: "Int32", Integer: "Int32", long: "Int64", Long: "Int64",
  bool: "Boolean", double: "Double", decimal: "Decimal", object: "Object",
};

export function toXamlType(t: string): XamlType | { error: string } {
  if (simple[t.trim()]) return { text: simple[t.trim()][0], xmlns: simple[t.trim()][1] }; // 完全名で登録したもの（UiPath.Core.Image）
  // カタログの型（"System.Data.DataRow" など）も受ける。名前空間は捨てて短い名前で引く
  const s = t.trim().replace(/^UiPath\.Core\.(?:Activities\.)?(?=\w+$)/, "").replace(/^System\.(?:(?:IO|Data|Drawing|Activities|Collections\.Generic)\.)?(?=\w+(?:$|<|\[))/, "");
  if (s.endsWith("[]")) {
    const inner = toXamlType(s.slice(0, -2));
    if ("error" in inner) return inner;
    // 配列は x:TypeArguments では "s:String[]" の形
    const text = inner.text.startsWith("x:") ? `s:${inner.text.slice(2)}[]` : `${inner.text}[]`;
    return { text, xmlns: { ...inner.xmlns, s: S } };
  }
  const g = s.match(/^(\w+)\s*(?:<(.+)>|\(Of (.+)\))$/);
  if (g) {
    const base = generic[g[1]];
    if (!base) return { error: `未知のジェネリック型 "${g[1]}"` };
    const args = splitArgs(g[2] ?? g[3]).map(toXamlType);
    const bad = args.find((a) => "error" in a);
    if (bad) return bad;
    const ok = args as XamlType[];
    return { text: `${base[0]}(${ok.map((a) => a.text).join(", ")})`, xmlns: Object.assign({}, base[1], ...ok.map((a) => a.xmlns)) };
  }
  const hit = simple[alias[s] ?? s] ?? excelXamlTypes[s];
  if (!hit) return { error: `未知の型 "${t}"（types-xaml.ts に足す）` };
  return { text: hit[0], xmlns: hit[1] };
}

function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "<" || ch === "(") depth++;
    if (ch === ">" || ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}
