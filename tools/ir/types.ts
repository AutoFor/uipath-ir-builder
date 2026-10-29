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
export type Value = string | number | boolean | { lit: string };

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
  item?: string; // ForEach などのデリゲート引数名（既定 "item"）
  args?: InvokeArg[]; // InvokeWorkflowFile の引数
};

export type InvokeArg = { name: string; dir: "In" | "Out" | "InOut"; type: string; value: Value };

export type Issue = { path: string; code: string; message: string };
