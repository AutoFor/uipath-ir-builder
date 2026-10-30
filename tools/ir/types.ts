// IR（中間表現）の型。AI が書くのはこの形の JSON だけ。
// XAML の書式（xmlns、[...] の付け方、x:TypeArguments、IdRef）は generate.ts が1か所で付ける。

export type Workflow = {
  workflow: string;
  arguments?: ArgumentDecl[];
  variables?: VariableDecl[];
  body: Node[];
};

export type ArgumentDecl = { name: string; dir: "In" | "Out" | "InOut"; type: string };

export type VariableDecl = { name: string; type: string; default?: string };

// 値の書き方:
//   "row(0).ToString"   … VB の式。[...] は生成器が付ける
//   { lit: "こんにちは" } … 文字列リテラル。引用符のエスケープは生成器がやる
//   30 / true           … 数値・真偽値のリテラル
//   "Info"              … enum のプロパティなら、メンバー名はそのままリテラルになる
//   { vb: "...", cs: "..." } … VB と C# を別々に書く式。XAML には vb、Coded には cs を使う。
//                          VB の式を C# に機械的に直せないとき（If(...)、ラムダなど）に使う
export type Value = string | number | boolean | { lit: string } | { vb: string; cs: string };

export type Node = {
  act: string; // ClassName（例 "LogMessage"）。曖昧なときは完全名（例 "System.Activities.Statements.ForEach"）
  name?: string; // DisplayName
  typeArg?: string; // ジェネリックの型引数（ForEach の要素型、Assign の型など）
  props?: Record<string, Value>;
  variables?: VariableDecl[]; // Sequence など Variables を持つアクティビティ
  body?: Node[]; // 既定の子の置き場所（Sequence.Activities、ForEach.Body など）
  then?: Node[]; // If.Then
  else?: Node[]; // If.Else
  slots?: Record<string, Node[]>; // それ以外の子（プロパティ名で指定）
  item?: string | string[]; // ForEach などのデリゲート引数名（既定 "item"）。ForEachFileX のように2つ取るものは配列
  args?: InvokeArg[]; // InvokeWorkflowFile の引数（dicts.Arguments と同じ）
  dicts?: Record<string, InvokeArg[]>; // Dictionary<String, Argument> 型のプロパティ（InvokeCode.Arguments、AddLogFields.Fields など）。IDictionary<String, String> と Dictionary<String, InArgument<String>> は { name, value } だけ（dir と type は書かない）
  cases?: Record<string, Node[]>; // Switch の分岐（キーは値の文字列表記）。既定の分岐は slots.Default
  catches?: CatchDecl[]; // TryCatch の Catch。Try は body、Finally は slots.Finally
  assigns?: AssignOp[]; // MultipleAssign の代入（上から順に実行）
  lists?: Record<string, ListItem[]>; // 一覧のプロパティ。List<String> / IEnumerable<String>（NSelectItem.Items など）は式を持てないので { lit } の配列、List<DayOfWeek> はメンバー名の配列。InArgument の一覧（AppendItemToCollection.Items、FilterDataTable.SelectColumns など）は式の配列、オブジェクト型の List（FilterDataTable.Filters、JoinDataTables.Arguments など）はプロパティの辞書の配列
  objs?: Record<string, ObjValue>; // 要素で書くオブジェクトのプロパティ（UI のターゲット Target / TargetApp など）。書き方は tools/ir/uia.ts
};

// オブジェクトの中身。キーはそのオブジェクトの型のプロパティ名（カタログ *.objects.json）、値は Value か、入れ子のオブジェクト、
// その配列（TargetAnchorable.Anchors など）
export type ObjValue = { [prop: string]: Value | ObjValue | ObjValue[] };

// List の要素。InArgument の List なら Value、オブジェクト型（FilterOperationArgument など）なら { プロパティ名: Value }
export type ListItem = Value | { [prop: string]: Value };

export type CatchDecl = { type: string; var?: string; body: Node[] }; // var の既定は "exception"

export type AssignOp = { to: string; value: Value };

export type InvokeArg = { name: string; dir: "In" | "Out" | "InOut"; type: string; value: Value };

export type Issue = { path: string; code: string; message: string };
