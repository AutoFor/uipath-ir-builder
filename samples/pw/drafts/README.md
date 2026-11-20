# 作る・変える画面の操作（下書き。まだ流していない。AUT-1214）

ここの台本は、テナント（Sorahane Trial）に何かを作る・変える操作なので、**題材ごとに利用者の了承が出るまで流さない**。セレクター（objects）は、画面の DOM を見てから決める（今は仮の書き方）。

作るものの名前は、テスト用と分かるように `ircu-` で始める（例：`ircu-memory-20261119-1530`）。名前に日時を入れ、前の回の残りと見分ける。

## 題材ごとの了承用のまとめ

| 題材 | 何を作るか | どこに作るか | あとで消せるか | 消す手順 | 下書き |
| --- | --- | --- | --- | --- | --- |
| A. Agents のメモリスペースを作って消す | メモリスペース 1 つ（`ircu-memory-<日時>`、説明だけ。中身は入れない） | Orchestrator のフォルダ `Shared` | ○ | 同じ台本の最後で、画面の Delete（名前を打って確かめる）。台本が途中で落ちたら、`ircu-` で始まるものを画面で消す | `memory-space.ts` |
| B. Studio Web にソリューションを取り込む（Import） | ソリューション 1 つ（`ircu-import-<日時>`。中身はリポジトリの見本の `.uis`） | Studio Web の自分のワークスペース（`trial@…'s workspace`。Orchestrator のフォルダには出ない。Debug しないので `Debug_` のフォルダも作らない） | ○ | `uip solution list` で Id を見て、`uip solution delete <Id> --yes --profile trial` | `studioweb-import.ts`（ファイルを選ぶ窓は UiPath に変換できないので、Playwright だけで流す） |
| C. Integration Service のイベントのトリガーを作る | トリガー 1 つ（`ircu-trigger-<日時>`） | Orchestrator のフォルダ `Shared` | ○ | `uip or triggers delete <Id> --profile trial` | まだ |
| D. Action Center の Validation Station で Submit | タスクを 1 つ完了する。前に、IXP のプロセスを流してタスクを作る | Orchestrator のフォルダ `Shared`（Action Center のタスク） | × 完了したタスクは戻せない。履歴に残る | 消せない（タスクは毎回作り直す） | まだ |
| E. Agents の評価を画面から流す | 評価の実行の記録 1 つ | Studio Web の自分のワークスペースのエージェント | × 実行の記録は残る。Agent Units / Platform Units を使う | 消せない | まだ |
| （対象外）Integration Service の接続を作る | 接続（外のサービスへのアクセス権） | — | ○ `uip is connections delete` | — | 作らない（アクセス権を足す操作は自動化の対象外） |

### 前もって分かっていること

- **C は、今は流せない**。Trial にある IS の接続は「UiPath GenAI Activities」1 つだけで、イベントのトリガーに使える接続が無い（2026-11-19 に `uip is connections list` で確かめた）。使える接続を作るには OAuth の同意が要り、それは自動化の対象外。利用者が自分で接続を作ったら、題材にできる
- **D と E は、消せない記録が残る**。了承をもらうときは、この点をはっきり伝える
- A と B は、同じ台本の中で作って消す。消すところまでを 1 つのテストケースにし、消せなかったら Failed にする
