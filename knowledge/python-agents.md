# Python のエージェント（Coded Agent）

UiPath のエージェントを Python で作るときに分かったこと（2026-11-14）。

- 公式の文書とスキル（`uipath-agents`）を読んだ。
- トライアルのテナントで、手元の実行・評価・デプロイして動かすまで確かめた。
- CLI の使い分けは [uipath-clis.md](uipath-clis.md)。

## 結論

- **生成器（IR → Python）は作らない**。
  - 雛形と JSON（`entry-points.json`、`bindings.json`、`project.uiproj`）は、`new` と `init` が Python のコードから自動で作る。
  - AI が書くのは `main.py` だけで、それはふつうの LangGraph の Python。IR を挟んでも短くも安全にもならない。
  - 守るべき約束事（下の「書くときの約束」）を、この文書と見本で渡す。
- **始め方**：見本を写して直す。エージェントは `samples/pyagent/quote-agent/`、Playwright でブラウザを操作する関数は `samples/pyagent/playwright-form/`、アセットと Data Fabric を読む関数は `samples/pyagent/sdk-probe/`、人の承認を挟むエージェントは `samples/pyagent/hitl-agent/`。手順は下の「作り方」。
- **フレームワークは LangGraph**（`uipath-langchain`）。スキルの第一の推奨で、人のタスク（HITL）やプロセスの呼び出しの形がいちばんそろっている。
- **LLM の API キーは要らない**。UiPath の LLM Gateway を通るので、テナントで使えるモデル（Claude・GPT・Gemini）がそのまま使える。
- **単純なエージェント**（道具を呼ぶだけ・人の確認を挟むだけ）なら、Studio Web の low-code のエージェント（`agent.json`、`uip agent`）の方が公式の推奨に合う（[agents.md](agents.md)。IR から生成器で作れる）。Python にするのは、独自のグラフ、外部のライブラリ、複雑な HITL、コードでの評価が要るとき。

## 作り方（確かめた手順）

`uipath`（Python）を直接呼ばず、**`uip codedagent` を使う**。`uip` のログイン（`--profile` も）のトークンを Python に渡してくれるので、`uipath auth` が要らない。

```bash
mkdir <名前> && cd <名前>
uv venv --python 3.13                       # 3.11〜3.13
source .venv/Scripts/activate               # Windows の Git Bash
uv pip install uipath-langchain
uip codedagent setup --force                # venv を有効にしてから。uipath の場所を覚えさせる
uip codedagent new <名前>                   # main.py・langgraph.json・pyproject.toml
uv add uipath-dev --dev && uv sync
uip codedagent setup --force                # uv sync のあとにもう一度
uip codedagent init                         # entry-points.json などを作る。Input / Output を変えたら毎回
uip codedagent list-models --profile trial  # テナントで使えるモデル
uip codedagent run agent '{"question":"…"}' --output-file out.json --profile trial
uip codedagent eval agent evaluations/eval-sets/smoke-test.json --no-report --output-file eval.json --profile trial
uip codedagent deploy --my-workspace --profile trial      # パッケージにして個人ワークスペースに出す
uip codedagent invoke agent '{"question":"…"}' --profile trial   # クラウドで動かす（ジョブを始めるだけで、待たない）
```

見本を写すときは、`new` の代わりに `main.py`・`langgraph.json`・`pyproject.toml`・`uipath.json`・`evaluations/` を写し、`uv sync` → `setup --force` → `init` から始める。

### 確かめた結果（見本 quote-agent）

- **何をするか**：見積もりの相談に答える。合計とランクは、デプロイ済みの API ワークフロー（Probe、[api-workflow.md](api-workflow.md)）を道具として呼んで出す。LLM は Claude Haiku 4.5（Bedrock）。
- **手元の run**：16 秒。LLM が自分で道具を 1 回呼び、Orchestrator に Probe のジョブ（Source `AgentService`）ができて、「合計 1650 円・GOLD」と答えた。
- **評価**：2 件とも 1.0（答えにランクが入っているか、道具を 1 回だけ呼んだか）。20 秒。
- **クラウド**：`deploy` で個人ワークスペースに出し、`invoke` で動かした。
  - ジョブは ProcessType `Agent`、35 秒で Successful。
  - `OutputArguments` は `{"answer": "合計は 350円、ランクは SILVER", "tool_calls": 1}`。
  - Linux のコンテナで動く（ログのパスが `/tmp/home/...`）。
- 片付け：`uip or processes delete <Key> --yes` と、`uip or packages delete <名前>:<版> --feed-id <個人ワークスペースのフィード> --yes`。フィードの Id は `uip or feeds list` の「Orchestrator Personal Workspace Feed」。

## Playwright でブラウザを操作する（見本 playwright-form）

Python の関数（LLM を使わない）から Playwright で DOM を操作し、Orchestrator のジョブとして動かせた。

- **見本**：`samples/pyagent/playwright-form/`。
  - 試し用の公開ページ https://httpbin.org/forms/post を開き、名前・サイズ・トッピング・コメントを入れて送信する。
  - サーバーが受け取った値を返す。
- **作り方**：
  - 雛形は `uipath new <名前> --type function`（`uip codedagent new` は `--type` を受け取らずに落ちた。`new` はログインが要らないので `uipath` で直接作る）。
  - `pyproject.toml` の `dependencies` に `playwright` を足す。
  - 手元では `python -m playwright install chromium` でブラウザを入れる（この PC で 43 秒）。
- **手元の run**：9 秒で送信まで終わり、受け取った値が入力と一致した。
- **クラウド**：`deploy` → `invoke` で Successful（57 秒。うちパッケージの入れ込み 15 秒）。
  - **コンテナにブラウザは入っていない**（`Executable doesn't exist at /tmp/home/.cache/ms-playwright/...`）。
  - 起動に失敗したら、その場で `python -m playwright install chromium` を流すようにした。Chrome Headless Shell（125.7 MiB）が入り、そのまま起動・送信できた。OS のライブラリ（`--with-deps`）は要らなかった。
  - 毎回ブラウザを取ってくるので、そのぶん遅く、ネットワークも使う。
- **ログ**：`logging.info` も `print` も、Orchestrator のジョブのログ（`uip or jobs logs <ジョブ>`）に出た。
- **向き・不向き**：
  - 向く：画面の無い（headless）取得や入力を、ロボットなしにクラウドだけで回したいとき。LLM に判断させながら操作したいとき。
  - 向かない：社内のサイト（クラウドから届かない）、ログインの画面や二段階認証、デスクトップのアプリ。これらはロボットで動く RPA（UI Automation。この道具の IR の生成器）を使う。
  - パスワードは Orchestrator の資格情報のアセットから読める（`UiPath().assets.retrieve_credential`）。クラウドのジョブの中なら読めた（下の「アセットと Data Fabric を読む」）。

## アセットと Data Fabric を読む（見本 sdk-probe）

`samples/pyagent/sdk-probe/`。Python の関数から、Orchestrator のアセットと Data Fabric の表を読む。トライアルのテナントで、手元の run とクラウドのジョブの両方で確かめた。

| 読むもの | 書き方 | 結果 |
| --- | --- | --- |
| テキストのアセット | `await uip.assets.retrieve_async("名前", folder_path="Shared")` の `.value` | 値が読めた |
| Data Fabric のレコードの一覧 | `entity = await uip.entities.retrieve_by_name_async("表の名前")` → `await uip.entities.list_records_async(entity.id, limit=50)` | 足した 2 件が読めた。列は表の列名（`Title`、`Amount`）で取れる |
| Data Fabric の SQL | `await uip.entities.query_entity_records_async("SELECT Title, Amount FROM 表 WHERE Amount >= 500")` | 条件に合う 1 件だけが返った。DECIMAL の列は `880.0` のように小数になる |
| 資格情報のアセット | `await uip.assets.retrieve_credential_async("名前", folder_path=…)` → 復号したパスワード | **クラウドのジョブの中では読めた**（8 文字）。**手元の run では読めない**（下の注意） |

- 手元の run は 5.6 秒。
- クラウドのジョブ（個人ワークスペースで動く）からも、`Shared` のアセットと tenant の表が読めた。フォルダが違っても `folder_path` を書けば読める（デプロイした本人の権限で動くため、と考えられる。ロボットのアカウントで動かす場合は未確認）。
- **資格情報は、ロボットの鍵が無いと読めない**。
  - 手元の `uip codedagent run` では `ValueError: No robot key available and 'AllowDirectApiAccess' is disabled for asset '…'` になった。
  - Orchestrator のジョブの中（デプロイして `invoke`）なら、そのまま読めた。
  - 手元でも読みたいときは、アセットの「Access」の「Expose value to API」をオンにする（`AllowDirectApiAccess`）。API から値が見えるようになるので、試し以外では勧めない。
- 資格情報のアセットは、作るときにパスワードを入れる（画面か `uip or assets create <名前> <値> --type Credential --credential-store-key <キー>`）。AI はパスワードを入れないので、人に作ってもらう。
- 見本は、資格情報を読んでも値を返さず、読めたかどうかと文字数だけを返す。パスワードを出力やログに出さない。
- 試しに作ったアセット・レコード・プロセス・パッケージは消した。

## 人の承認を挟む（HITL。見本 hitl-agent）

`samples/pyagent/hitl-agent/`。経費の申請を受け、上限（`limit`）以下なら自動で承認し、超えたら Action Center のタスクで人に承認・却下してもらい、その結果で分岐して終わる。

- **書き方**：ノードの中で `task = interrupt(CreateEscalation(title=…, data={…}, app_name=…, app_folder_path=…))`（`from uipath.platform.common import CreateEscalation`）。
  - 止まって、再開すると `task` に完了したタスクが返る。`task.action`（`Approve` / `Reject`。ボタンの名前）、`task.data`（人が書いた値）、`task.completed_by_user`（`displayName` などの dict）。
  - 承認・却下で分けたいときは `CreateEscalation`。`CreateTask` は `data` しか返らず、どちらを押したか分からない（スキルの決まり）。
- **Action Center のアプリが要る**。`app_name` を書かないと `Failed to create HITL action: appName or appKey is required` で落ちる。
  - 見本の画面は `approval-app.json`（申請者・金額・用途を見せ、コメントを書いて「承認する」「却下する」）。`tools/apps/coded-action.ts` で作る（[apps.md](apps.md)）。
  - `data` のキーは、アプリの入力（`dir: in`）の名前と合わせる。合わないと画面の欄が空になる。
  - 出し方：`npm run build` → `uip codedapp pack dist -n <アプリ> -v 1.0.0` → `uip codedapp publish -n <アプリ> -v 1.0.0 -t Action` → `uip codedapp deploy -n <アプリ> --folder-key <フォルダの Key>`。
- **手元で動かす**（トライアルで確かめた）：
  1. `uip codedagent run agent '{…}'`：タスクができて止まる。出力のファイルには、止まったところの中身（`CreateEscalation` の値）が入る。
  2. 人がタスクを完了する。
  3. `uip codedagent run agent --resume`：続きから動き、`{"decision":"approved","note":"出張なので承認"}` が返った。タスクがまだ終わっていなければ、もう一度止まるだけ。
- **クラウド**：`invoke` したジョブはタスクを作って `Suspended` になり、タスクを完了すると自動で再開して Successful になった（却下で `{"decision":"rejected","decided_by":"<完了した人の表示名>","note":"…"}`）。
- **タスクを CLI で完了する**（人の代わりに試すとき）：
  - タスクは割り当てられていない（Unassigned）と完了できない（「This action is no longer assigned to you」）。先に `uip tasks assign <Id> --user-id <ユーザーの Id>` で自分に割り当てる。
  - ユーザーの Id は `uip tasks users --folder-key <フォルダの Key>`（`--folder-id` は受け取らない）。
  - 完了は `uip tasks complete <Id> --type AppTask --folder-id <フォルダの Id> --action Approve --data '{…}'`。
- 片付け：プロセスとパッケージ（ほかの見本と同じ）、アプリは `uip codedapp delete --display-name <アプリ> --folder-key <Key> --yes`。publish したアプリのパッケージは残る（`uip` に消すコマンドが無い）。

## 書くときの約束（守らないと落ちる）

- `from uipath.platform import UiPath`。`UiPath()` と LLM は**関数の中で作る**。モジュールの最上位で作ると `init` が落ちる。
- Input・Output は Pydantic のモデル。変えたら `uip codedagent init` をやり直す（`entry-points.json` が古いまま残る）。
- `pyproject.toml` に `[build-system]` を書かない。
- **Claude の答えは `content` がブロックの配列になることがある**。`Output` の文字列にそのまま入れると Pydantic が「Input should be a valid string」で落ちる。テキストだけを取り出す（見本の `answer` を参照）。
- LangGraph の出力は、最後のノードが返した差分だけ。集めた値は各ノードで持ち回る。
- 手元の `--output-file` は、ノードの名前と Output の項目の名前が同じとき `{"answer": {"answer": …}}` と入れ子になった（クラウドのジョブの出力は入れ子でない）。ノードの名前を出力の項目と別にすると紛れない。
- 道具は `@tool` の関数。中で SDK（`uip.processes.invoke_async` → `uip.jobs.retrieve_async` で待つ）を呼べる。
  - 待たずに止まって再開したいときは、`interrupt(InvokeProcess(...))`（ジョブが終わると再開する）。
- `.env` はクラウドに送られない。設定はプロセスの環境変数か、`%ASSETS/<名前>%`（解決に失敗しても何も言わない）。
- 評価：`evaluations/eval-sets/*.json` と `evaluations/evaluators/*.json`。評価器の `id` と、セットの `evaluatorRefs` を合わせる。
  - 文字列が入っているか：`uipath-contains`（`targetOutputKey` を書く）。
  - 道具の回数：`uipath-tool-call-count`。
  - 言い回しの近さ：`uipath-llm-judge-output-semantic-similarity`。LLM を使うのでログインが要る。

## Python から使えるもの

`UiPath()` のサービス（2.15.2）：`processes`、`jobs`、`assets`、`queues`、`buckets`、`attachments`、`tasks`（Action Center）、`entities`（Data Fabric。SQL の照会もある）、`connections`（Integration Service の活動）、`context_grounding`（検索・DeepRAG・Batch Transform）、`documents`（IXP・DU の抽出と検証）、`business_rules`、`llm`（LLM Gateway）、`mcp`、`memory`、`guardrails`、`resource_catalog` ほか。

LangGraph で決まった形があるもの（スキルの `references/coded/capabilities/`）：

| やりたいこと | 書き方 |
| --- | --- |
| RPA・API ワークフロー・ほかのエージェントを呼んで、終わったら再開 | `interrupt(InvokeProcess(name=…, process_folder_path=…, input_arguments=…))` |
| 人に確かめる（Action Center） | `interrupt(CreateTask(...))` / `CreateEscalation` |
| 文書の検索（RAG） | Context Grounding の Retriever |
| Data Fabric の表を自然言語で照会 | `create_datafabric_tool` |
| MCP のサーバーの道具 | `open_mcp_tools` |
| トレース | LangGraph は自動。ほかは `@traced` |

確かめたのは「SDK でプロセスを呼んで待つ道具」と、`CreateEscalation` による人の承認（下の「人の承認を挟む」）。`InvokeProcess` の止めて再開、RAG、MCP は手で動かしていない。

## ほかのフレームワーク

| フレームワーク | パッケージ（版） | 注意 |
| --- | --- | --- |
| LangGraph | `uipath-langchain`（0.19.11） | 第一の推奨。手で確かめたのはこれ |
| LlamaIndex | `uipath-llamaindex`（0.6.3） | |
| OpenAI Agents | `uipath-openai-agents`（0.1.2） | HITL とプロセスの呼び出しの形が無い。入力に `messages` が要る |
| 関数（エージェントでない） | `uipath` だけ（`new --type function`） | LLM を使わない処理。ログインせずに手元で `run` できた |

SDK の文書には PydanticAI・Google ADK・Microsoft Agent Framework・Claude Agent SDK（`uipath-claude-sdk`）の連携も載っているが、試していない。

## 呼び出し方・課金・状態

- **呼び出し元**：Orchestrator のジョブ（API・トリガー）、Maestro Flow のノード（`uipath.core.agent.<key>`）、low-code のエージェントの道具。low-code と違い、Flow の中への埋め込み（inline）はできない。
- **課金**：1 回 1 Agent Unit か 0.2 Platform Units（Standard。公式の licensing のページ）。LLM の呼び出しは LLM Gateway 側。
- **状態**：Studio Web 上の coded agent と Coded Function は Preview。Python の会話型エージェントは「本番向けではない。low-code を使う」とされている。
- **未確認**：`uip codedagent pack` / `publish` を直接使えるか（スキルは「wrapper が止める」、CLI の文書は「素通し」で食い違う）。今回は `deploy` だけを使った。

## 出典

- スキル `uipath-agents` の `references/coded/`（quickstart、lifecycle、frameworks、capabilities）
- https://uipath.github.io/uipath-python/ （CLI、LangChain の連携、HITL、MCP）
- https://docs.uipath.com/uipath-cli/standalone/latest/user-guide/uip-codedagent
- https://docs.uipath.com/agents/automation-cloud/latest/user-guide/licensing
- 調べた素材：`uipath` 2.15.2 のソース（`uipath/_cli/cli_new.py`、`cli_auth.py`）
