# 作る・変える画面の操作（下書き。まだ流していない。AUT-1214）

ここの台本は、テナントに何かを作る・変える操作なので、利用者の了承が出るまで流さない。セレクター（objects）は、画面の DOM を見てから決める（今は仮の書き方）。

| 題材 | 画面 | 作るもの・変えるもの | あとで消せるか | 下書き |
| --- | --- | --- | --- | --- |
| Agents のメモリスペースを作って消す | `agents_` → Memory spaces → Create | メモリスペース 1 つ（名前・説明・フォルダ Shared） | ○ 同じ台本の最後で Delete（名前を打って確かめる） | `memory-space.ts` |
| Studio Web にソリューションを取り込む（Import） | `studio_/projects` → Create New → Import | ソリューション 1 つ（`.uis` から） | ○ `uip solution delete <Id> --yes` | `studioweb-import.ts` |
| Integration Service のイベントのトリガーを作る | Orchestrator のトリガー → Event | トリガー 1 つ（接続のイベント） | ○ `uip or triggers delete` | まだ（要るのは IS の接続。接続を作るのは OAuth の同意なので自動化しない） |
| Action Center の Validation Station で Submit | Action Center → タスク → Validation Station | タスクを完了する（戻せない）。前に、エージェントを流してタスクを作る | × 完了したタスクは戻せない（タスクは毎回作り直す） | まだ |
| Agents の評価を画面から流す | Studio Web → Evaluations → 再生 | 評価の実行の記録（消せない）。Agent Units / Platform Units を使う | × 実行の記録は残る | まだ |
| Integration Service の接続を作る（OAuth の同意） | `uip is connections create --no-wait` の URL | 接続（外のサービスへのアクセス権） | ○ `uip is connections delete` | 作らない（アクセス権を足す操作は自動化の対象外） |
