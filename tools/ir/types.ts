// IR（中間表現）の型。AI が書くのはこの形の JSON だけ。
// XAML の書式（xmlns、[...] の付け方、x:TypeArguments、IdRef）は generate.ts が1か所で付ける。

export type Workflow = {
  workflow: string;
  // XAML の置き場所（プロジェクトからの相対パス。例 "Sub/Foo.xaml"）。無ければ "<workflow>.xaml"。
  // サブフォルダの XAML を取り込んだとき（import-xaml.ts --project、migrate-platform.ts）に付く。x:Class は workflow のまま
  file?: string;
  arguments?: ArgumentDecl[];
  variables?: VariableDecl[];
  body: Node[];
  // テストケースにする（knowledge/testing.md の「テストケース」）。XAML は project.json の designOptions.fileInfoCollection に載せ、
  // Coded は [TestCase] を付ける（fileInfoCollection には載せない）。id は Test Manager とつなぐ testCaseId（無ければ project.json の既存の値か新しい GUID）。
  // status は editingStatus（既定 Publishable。InProgress は publish に入らない）。id と status は XAML だけで使う
  // data はデータ駆動のテストの行（キーは In 引数の名前）。.variations\<名前>.json に書き、dataVariationFilePath でつなぐ（XAML だけ）
  testCase?: boolean | { id?: string; status?: "Publishable" | "InProgress"; data?: Record<string, string | number | boolean | null>[] };
  // テストケースの Given / When / Then。書くと body の代わりに、その名前の Sequence を 3 つ並べる（body と一緒には書けない）
  given?: Node[];
  when?: Node[];
  then?: Node[];
};

// default：In の引数の既定値（Studio の引数パネルの「既定値」。引数を渡さずに動かしたとき、デバッグのときに使う）。
// リテラルだけ書ける：文字列は { lit }、数値・真偽値はそのまま。XAML ではルートの this:<ワークフロー>.<引数>="値"、Coded では Execute の省略可能な引数になる
export type ArgumentDecl = { name: string; dir: "In" | "Out" | "InOut"; type: string; default?: { lit: string } | number | boolean };

// default：VB の式。C# の式のプロジェクトから取り込んだ既定値は { cs }（VB に直せないので vb は無いこともある）
export type VariableDecl = { name: string; type: string; default?: string | CsExpr };

// 値の書き方:
//   "row(0).ToString"   … VB の式。[...] は生成器が付ける
//   { lit: "こんにちは" } … 文字列リテラル。引用符のエスケープは生成器がやる
//   30 / true           … 数値・真偽値のリテラル
//   "Info"              … enum のプロパティなら、メンバー名はそのままリテラルになる
//   { vb: "...", cs: "..." } … VB と C# を別々に書く式。XAML には vb、Coded には cs を使う。
//                          VB の式を C# に機械的に直せないとき（If(...)、ラムダなど）に使う
//   { cs: "..." }        … C# だけの式。式の言語が C# の XAML から取り込んだもの（import-xaml.ts）。
//                          C# の XAML と Coded には使えるが、VB の XAML には書けない（生成器が VB_EXPR にする）
export type CsExpr = { vb?: string; cs: string };
export type Value = string | number | boolean | { lit: string } | CsExpr;

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
  // 図（ノードどうしが指し合うもの）。ノードに id を付け、矢印は行き先の id で書く。XAML では id が x:Name、矢印が x:Reference になる（tools/ir/graph.ts）
  flowchart?: FlowchartDecl; // Flowchart の StartNode と Nodes
  stateMachine?: StateMachineDecl; // StateMachine の InitialState と States
  branches?: BranchDecl[]; // Pick の Branches（PickBranch）
  process?: ProcessDecl; // 長時間実行の図（UiPath.FlowchartBuilder.Activities の ProcessDiagram）の StartNode・Nodes・EventSubProcesses
};

// 長時間実行の図（ProcessDiagram）。start は最初のノードの id。ノードの書き方は tools/ir/process.ts
export type ProcessDecl = { start: string; nodes: ProcessNodeDecl[]; eventSubProcesses?: ProcessNodeDecl[] };
// ノード。node はノードの型のクラス名（EventNode・TaskNode・DecisionNode など。カタログ *.objects.json）、name は DisplayName。
// ほかのキーはノードの型のプロパティ名の先頭を小文字にしたもの：行き先（next・true・false・default）は id、行き先の一覧（branches）は id の配列、
// 行き先の辞書（cases）は { 値: id }、式（condition・expression）は Value、behavior はオブジェクト（"$type" で型を選ぶ）、action は子、
// 中に持つノードの一覧（boundaryNodes）はノードの配列
export type ProcessNodeDecl = {
  id: string; node: string; name?: string; typeArg?: string; behavior?: ObjValue; action?: Node[];
  [prop: string]: string | string[] | Record<string, string> | Value | ObjValue | Node[] | ProcessNodeDecl[] | undefined;
};

// Flowchart。start は最初のノードの id
export type FlowchartDecl = { start: string; nodes: FlowNode[] };
// FlowStep：アクティビティのノードに id と next（次のノードの id。無ければ終わり）を足したもの
export type FlowStepDecl = Node & { id: string; next?: string };
// FlowDecision：decision は真偽の式。true / false は行き先の id（無ければ終わり）
export type FlowDecisionDecl = { id: string; decision: Value; name?: string; true?: string; false?: string };
// FlowSwitch<T>：switch は式、typeArg は式の型（既定 String）。cases のキーは値の文字列表記、値は行き先の id。default は既定の行き先
export type FlowSwitchDecl = { id: string; switch: Value; typeArg?: string; name?: string; cases?: Record<string, string>; default?: string };
export type FlowNode = FlowStepDecl | FlowDecisionDecl | FlowSwitchDecl;

// StateMachine。initial は最初の状態の id
export type StateMachineDecl = { initial: string; states: StateDecl[] };
// 状態。name は DisplayName（無ければ id）。final は終わりの状態（遷移と exit を持てない）
export type StateDecl = { id: string; name?: string; final?: boolean; variables?: VariableDecl[]; entry?: Node[]; exit?: Node[]; transitions?: TransitionDecl[] };
// 遷移。to は行き先の状態の id。trigger が終わり、condition（真偽の式）が真なら action を実行して to に移る
export type TransitionDecl = { to: string; name?: string; trigger?: Node[]; condition?: Value; action?: Node[] };

// Pick の分岐。最初に trigger が終わった分岐の action だけが実行され、ほかの trigger は取り消される
export type BranchDecl = { name?: string; variables?: VariableDecl[]; trigger: Node[]; action?: Node[] };

// オブジェクトの中身。キーはそのオブジェクトの型のプロパティ名（カタログ *.objects.json）、値は Value か、入れ子のオブジェクト、
// その配列（TargetAnchorable.Anchors など）
export type ObjValue = { [prop: string]: Value | ObjValue | ObjValue[] };

// List の要素。InArgument の List なら Value、オブジェクト型（FilterOperationArgument など）なら { プロパティ名: Value }
export type ListItem = Value | { [prop: string]: Value };

export type CatchDecl = { type: string; var?: string; body: Node[] }; // var の既定は "exception"

export type AssignOp = { to: string; value: Value };

export type InvokeArg = { name: string; dir: "In" | "Out" | "InOut"; type: string; value: Value };

export type Issue = { path: string; code: string; message: string };
