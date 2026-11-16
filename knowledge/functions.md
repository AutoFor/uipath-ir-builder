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
