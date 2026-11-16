# Coded Functions（JS / TS）

UiPath の関数（Coded Functions）のうち、JavaScript / TypeScript で書くもの（2026-09-17 から Preview）。Python の関数とエージェントは [python-agents.md](python-agents.md)。2026-11-17、`uip` 1.204（function-tool 1.204.0）、`@uipath/coded-functions-js-sdk` 0.6.2 で確かめた（AUT-1195）。

## 見本

`samples/function-ts/quote/`：見積りの合計に、会員の区分の割引を掛ける関数 `quote`。業務の規則を関数に閉じ込める例。

- `functions/quote.ts`：`defineFunction({ name, description, input: defineSchema<型>(), output: defineSchema<型>(), handler })`
- `uipath.json`：`functions` に `"quote": "functions/quote.ts:default"`
- 入出力の JSON Schema は TypeScript の型から作られる。`/** @default "NONE" */` の JSDoc が既定値になり、`?` の無い項目が `required` になる（pack の `entry-points.json` で確かめた）

## 作る・動かす・出す

```bash
uip function new <名前> --language ts         # 雛形（hello 関数つき。--empty で空）。中で npm install
uip function run <関数名> --input '{…}'        # 手元で 1 回動かす（初回は runtime の npm install）
uip function serve                              # 手元でずっと動かす（ポート 7070、変更で読み直す）
uip function pack                               # .uipath/<名前>.<版>.nupkg
uip or packages upload .uipath/<名前>.<版>.nupkg --profile <名前>
uip or processes create --name <名前> --package-key <名前> --package-version <版> --entry-point content/functions/<関数>.ts --folder-path <フォルダ>
uip or jobs start <プロセスの Key> --folder-path <フォルダ> --input-arguments '{…}' --wait-for-completion
```

- **`uip function publish --feed-id <テナントのフィード>` は 403 で断られた**（`Packages.Create` の権限が無い、と出る）。同じログインの `uip or packages upload` は通るので、`pack` → `or packages upload` で出す。
- **プロセスの入口は関数の名前ではなく、パッケージの中のパス**（`content/functions/quote.ts`）。`--entry-point quote` は 404「entry point … was not found」。入口は `uip or packages entry-points <パッケージ>:<版>` で見られる。
- 試した結果：手元の `run` も、Shared のジョブ（`--wait-for-completion`）も Successful。`OutputArguments` は `{"subtotal":4600,"discount":460,"total":4140}`。

## HTTP にするか、ジョブにするか

- `defineFunction` に `method` と `path` を書くと HTTP のエンドポイントになる（雛形の hello は `POST /hello`）。Coded App の裏側として、ブラウザに見せてはいけない資格情報と業務の規則を持てる（文書）。
- 書かなければジョブとして動く（見本の quote）。
- Maestro の Service Task（`publishedFunction`）からも、pack → publish → deploy した関数を呼べる（文書。[maestro.md](maestro.md)）。

## 文書で分かったこと（2026-11-15 の突き合わせ、AUT-1205）

番号は AUT-1205 の一覧の番号。印の無いものは、まだテナントで試していない。

- **Functions は Coded Agent とは別の製品**（1、2026-06 に Preview）：課金は実行時間で決まる（サーバーレスの Standard 2 GB なら 12 分 30 秒で 1 Platform Unit、15 秒単位で切り上げ）。pack → publish → Orchestrator のプロセスとして deploy する。呼び出し元は Maestro の Service Task・Studio の Run Job・Orchestrator API・ジョブのトリガー。
- **`uip function` は JS / TS と Python の両方を扱う**（27。1.204 の help：「Build, serve, and publish UiPath JS/TS and Python Functions」。`init` は Python だけ）。Python の関数は今まで `uipath`（Python の CLI）で作っていた（[python-agents.md](python-agents.md)）。
- **動く場所**（5）：サーバーレスのロボット（Small 1 GB〜Large 10 GB、大きさで課金が違う）か、自分のロボット（Robot 2026.10 LTS 以上、ランタイムの種類「Local - Function」。マシンのテンプレートで「Use Production (Unattended)」なら Units を使わない）。Automation Cloud Robots - VM と Elastic では動かない。
- **権限**（6）：関数は呼び出したときの ID で動く。JS は `ctx.user`（呼んだ人）と `ctx.robot`（関数のサービスアカウント。ジョブと HTTP のときだけ、手元の `serve` では null）を受け取る。資格情報のアセットのユーザー名とパスワードは、デプロイ後の実行（`ctx.robot.key` があるとき）だけ読める。
- **`bindings.json` は手で書く**（4）：書き漏らしても何も言わずに設計時の名前・Id のまま呼ぶ（ログに `No resource overwrite matched`）。付け替えが効く SDK の呼び出しは `assets.retrieve*`・`buckets.*`・`queues.create_item*`・`processes.invoke`・`tasks.create` / `retrieve`・`context_grounding.*`・`connections.retrieve`・`mcp.retrieve`（`entities` と `llm` には無い）。`key` は接続なら Id、ほかは `名前.フォルダ`。
- **Python の書き方**（22）：型は `pydantic.dataclasses.dataclass` を勧める（stdlib の `@dataclass` も通るが、入力を検証せず、入れ子の JSON Schema が不完全）。`@traced` を entry point に付けない（span が二重）。例外を投げると `USER` のエラーで Faulted、Output に状態を入れて返すと Successful。1 つのプロジェクトに `uipath.json` の `functions` で entry point を複数置ける。ジョブのキューのトリガーは関数に使えない。
- **Integration Service を呼ぶ**（23）：`uip is activities list <コネクタ>` と `uip is resources describe … --connection-id` で名前をパスに直し、`connections.invoke_activity(ActivityMetadata(object_path, method_name, parameter_location_info), connection_id, activity_input)`。`GETBYID` は `method_name="GET"`。`parameter_location_info` に書かなかった入力は黙って捨てられる。
- **JS の HTTP の上限と落とし穴**（24）：入力は約 1 万文字（超えると 500、`errorCode 4801`）、出力は約 512 KB（超えると 200 で中身が空）。Output に数値の `status` があると HTTP のステータスと読まれ、中身が消える。`console.*` はジョブのログに出ない（SDK の `logger`）。`@uipath/uipath-typescript` は `dependencies` に入れる。アセットの `folderId` は数値の Id。HTTP のトリガーの名前は `<パッケージ>_<関数>`。
- **Coded App から HTTP で呼ぶ課金**（25）：100 ミリ秒単位。利用者のライセンスごとに月の分が含まれ、使い切るとテナント、組織の順に Units を使う。
- **Studio Web の Autopilot**（26、2026-09-23）：Function のプロジェクトのコードを読み・説明し・点検できるが、ブラウザでは書く・動かす・publish はできない（手元の CLI で作る）。
