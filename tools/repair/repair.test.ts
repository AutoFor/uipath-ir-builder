// ui-repair（UI 操作の直し案）のテスト。外のコマンド（uip、browser-use）は呼ばない
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyProposal, currentTarget, hintsFromTarget, locateTarget, parseLiveAttrs, parseRunFailure, parseSelector, parseTree, proposalMarkdown, rankCandidates, scoreLive, wildMatch, type Proposal } from "./repair.ts";

const P = "C:\\Users\\me\\proj";
const envelope = (errorMessage: string) => `[Information] Starting execution...\n[Error] x\n{\n  "Result": "Failure",\n  "Message": ${JSON.stringify(JSON.stringify({ output: "{}", hasErrors: true, errorMessage }))}\n}\n`;

test("run のログ：Coded の UI 操作の失敗と、落ちた行", () => {
  const err = [
    "Source: Login__Coded",
    "Message: このアクションのユーザー インターフェイス (UI) 要素が見つかりませんでした。",
    "Exception Type: UiPath.UIAutomationNext.Exceptions.NodeNotFoundException",
    `   at MoneyForwardCrossPlatform.Login__Coded.Execute() in ${P}\\.local\\install\\coded\\Login__Coded+Login__CodedActivity.cs:line 58`,
    `   at MoneyForwardCrossPlatform.Login__Coded.Execute() in ${P}\\coded\\Login__Coded.cs:line 35`,
  ].join("\r\n");
  const f = parseRunFailure(envelope(err), P)!;
  assert.equal(f.ui, true);
  assert.equal(f.exceptionType, "UiPath.UIAutomationNext.Exceptions.NodeNotFoundException");
  assert.equal(f.file, "coded/Login__Coded.cs");
  assert.equal(f.line, 35);
});

test("run のログ：UI 操作でない失敗（資格情報のタイムアウト）は ui=false", () => {
  const f = parseRunFailure(envelope("Source: abc\r\nMessage: The operation has timed out.\r\nException Type: System.TimeoutException\r\n"), P)!;
  assert.equal(f.ui, false);
  assert.equal(f.exceptionType, "System.TimeoutException");
});

test("run のログ：成功（hasErrors false）は undefined ではなく読めて、失敗ではない", () => {
  const ok = `{\n  "Result": "Success",\n  "Data": { "output": "{}", "hasErrors": false, "errorMessage": null }\n}\n`;
  assert.equal(parseRunFailure(ok, P), undefined);
});

test("セレクターを読む・ワイルドカード", () => {
  assert.deepEqual(parseSelector("<webctrl tag='INPUT' type='email' /><webctrl aaname='*収入*' />"), [
    { tag: "webctrl", attrs: { tag: "INPUT", type: "email" } }, { tag: "webctrl", attrs: { aaname: "*収入*" } }]);
  assert.equal(wildMatch("*収入*", "  収入 "), true);
  assert.equal(wildMatch("マネーフォワード ID", "マネーフォワード ID"), true);
  assert.equal(wildMatch("マネーフォワード ID", "マネーフォワード ME"), false);
});

const tree = `- Container [ref=e1]:
  - Text "メールアドレス" [ref=e2]
  - InputBox "メールアドレス" [ref=e3]:
    - /placeholder: example@moneyforward.com
  - InputBox "パスワード" [ref=e4]
  - InputBox "検索" [ref=e5] [invisible]
  - Button "ログインする" [ref=e6]:
    - /data-testid: submit
`;

test("要素ツリーを読み、候補に点数を付ける（役割・言葉・属性）。見えない要素は外す", () => {
  const nodes = parseTree(tree);
  assert.deepEqual(nodes.map((n) => n.ref), ["e1", "e2", "e3", "e4", "e5", "e6"]);
  assert.equal(nodes[2].attrs.placeholder, "example@moneyforward.com");
  const r = rankCandidates(nodes, { elementType: "InputBox", words: ["メールアドレス"], attrs: {} });
  assert.deepEqual(r.map((x) => x.node.ref), ["e3", "e4"]);
  assert.ok(r[0].score > r[1].score);
  // 名前が言葉とちょうど同じものを、言葉を含むだけのものより上にする
  const same = rankCandidates(parseTree(['- Link "GitHub Homepage" [ref=e1]', '- Link "Homepage" [ref=e2]'].join("\n")), { elementType: "Link", words: ["Homepage"], attrs: {} });
  assert.equal(same[0].node.ref, "e2");
  const b = rankCandidates(nodes, { elementType: "Button", words: [], attrs: { "data-testid": "submit" } });
  assert.equal(b[0].node.ref, "e6");
});

test("interact get-all の出力：Cookie や HTML は持たない", () => {
  const live = parseLiveAttrs(`- tag: "INPUT"\n- type: "email"\n- cookie: "_session=secret"\n- outerhtml: "<input value=x>"\n- id: "mfid_user[email]"\n`);
  assert.deepEqual(live, { tag: "INPUT", type: "email", id: "mfid_user[email]" });
  const s = scoreLive(live, { tag: "INPUT", type: "email", name: "x" });
  assert.deepEqual(s.matched, ["tag=INPUT", "type=email"]);
  assert.equal(s.missed.length, 1);
});

test("元のターゲットから手がかりを作る（DisplayName の '…'、aaname、fuzzy の印は外す）", () => {
  const h = hintsFromTarget({ name: "文字を入力 'メールアドレス'" }, {
    ElementType: "InputBox",
    FuzzySelectorArgument: { lit: "<webctrl tag='INPUT' type='email' matching:type='fuzzy' />" },
  });
  assert.equal(h.elementType, "InputBox");
  assert.deepEqual(h.words, ["メールアドレス"]);
  assert.deepEqual(h.attrs, { tag: "INPUT", type: "email" });
});

function project() {
  const d = mkdtempSync(join(tmpdir(), "ui-repair-"));
  mkdirSync(join(d, "ir", "MoneyForward"), { recursive: true });
  mkdirSync(join(d, "coded"), { recursive: true });
  const wf = {
    workflow: "Login_", file: "MoneyForward/Login.xaml",
    body: [{ act: "NApplicationCard", name: "Chrome", objs: { TargetApp: { Selector: { lit: "<html app='chrome.exe' title='マネーフォワード ID' />" }, Url: { lit: "https://moneyforward.com/sign_in" } } },
      body: [{ act: "NTypeInto", name: "文字を入力 'メールアドレス'", props: { Text: "UserName" },
        objs: { Target: { ElementType: "InputBox", Reference: { lit: "R/abc" }, FuzzySelectorArgument: { lit: "<webctrl tag='INPUT' type='email' />" }, SearchSteps: "FuzzySelector", ScopeSelectorArgument: { lit: "<html app='chrome.exe' title='マネーフォワード ID' />" } } } }] }],
  };
  writeFileSync(join(d, "ir", "MoneyForward", "Login.json"), JSON.stringify(wf, null, 2));
  writeFileSync(join(d, "coded", "Login__Coded.cs"), ["a", "b", `app1.TypeInto(target: new TargetAnchorableModel { Reference = "R/abc" });`].join("\n"));
  return { d, wf };
}

test("IR の中で、落ちたターゲットを探す（Coded は Reference、XAML は DisplayName）", () => {
  const { d } = project();
  const a = locateTarget(d, { ui: true, message: "", file: "coded/Login__Coded.cs", line: 3 });
  assert.ok(!("error" in a));
  if ("error" in a) return;
  assert.equal(a.irFile, "ir/MoneyForward/Login.json");
  assert.deepEqual(a.path, ["body", 0, "body", 0]);
  assert.equal(a.app?.Url.lit, "https://moneyforward.com/sign_in");
  const b = locateTarget(d, { ui: true, message: "", file: "MoneyForward/Login.xaml", activity: "文字を入力 'メールアドレス'" });
  assert.ok(!("error" in b) && b.path.join(".") === "body.0.body.0");
  const c = locateTarget(d, { ui: true, message: "", file: "coded/Login__Coded.cs", line: 1 });
  assert.ok("error" in c);
});

test("直し案を当てる：セレクターと SearchSteps だけを変える。IR が変わっていたら当てない", () => {
  const { wf } = project();
  const t = wf.body[0].body[0].objs.Target;
  const p: Proposal = {
    version: 1, project: "x", irFile: "ir/MoneyForward/Login.json", path: ["body", 0, "body", 0], activity: "文字を入力 'メールアドレス'",
    failure: { ui: true, message: "m" }, current: currentTarget(t),
    proposed: { FullSelectorArgument: "<webctrl id='mfid_user[email]' tag='INPUT' />", SearchSteps: "Selector" }, candidates: [], notes: [],
  };
  const r = applyProposal(wf, p);
  assert.deepEqual(r, { changed: ["FullSelectorArgument", "SearchSteps"] });
  assert.deepEqual(t.FullSelectorArgument, { lit: "<webctrl id='mfid_user[email]' tag='INPUT' />" });
  assert.equal(t.SearchSteps, "Selector");
  assert.deepEqual(t.FuzzySelectorArgument, { lit: "<webctrl tag='INPUT' type='email' />" }, "ほかは変えない");
  // もう一度当てると、今の値が案を作ったときと違うので当てない
  assert.ok("error" in applyProposal(wf, p));
  assert.match(proposalMarkdown(p), /\| FullSelectorArgument \| `（なし）` \| `<webctrl id='mfid_user\[email\]' tag='INPUT' \/>` \|/);
});
