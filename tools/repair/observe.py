"""UI 操作が落ちたときの、今の画面の調査（browser-use 1.0.0）。ui-repair.ts から呼ぶ。読むだけで、ページを操作しない。

    tools/repair/.venv/Scripts/python.exe tools/repair/observe.py <in.json> <out.json>

in.json：ui-repair.ts が書く（activity、elementType、selector、expectedUrl、expectedTitle、currentTab、error）
out.json：Observation（下の型）

- 普段の Chrome（ログイン済み）に Browser('chrome') でつなぐ。Chrome の「リモート デバッグを許可」が要る（knowledge/ui-repair.md）
- AI は Anthropic（ChatAnthropic、ANTHROPIC_API_KEY）。モデルは環境変数 UI_REPAIR_MODEL（既定 claude-sonnet-5-5）
- UiPath（uip rpa run）と同時に動かさない。Chrome のデバッガーの接続がぶつかることがある
"""

import asyncio
import json
import os
import sys
from urllib.parse import urlparse

from pydantic import BaseModel, Field

from browser_use import Agent, Browser
from browser_use.llm import ChatAnthropic


class Element(BaseModel):
    found: bool = Field(description="探している要素が今のページにあるか")
    label: str | None = Field(default=None, description="画面に見えている名前・ラベル・プレースホルダー（無ければ null）")
    attributes: dict[str, str] = Field(default_factory=dict, description="その要素の HTML の属性のうち tag、id、name、type、aria-label、placeholder、class だけ（値は見たまま。パスワードや入力済みの値は入れない）")


class Observation(BaseModel):
    url: str = Field(description="今のタブの URL")
    title: str = Field(description="今のタブの題名")
    page_state: str = Field(description="今どんな画面か（ログイン画面、アカウント選択、ログイン後のトップ、エラー画面など）を1〜2文で")
    element: Element
    cause: str = Field(description="UiPath がその要素を見つけられなかった理由として、いちばんありそうなもの（1〜2文）")
    suggestion: str = Field(description="直し方の提案（セレクターを直す、前の手順で画面を整える、待ち時間を延ばす、など。1〜2文）")


RULES = """\
あなたは UiPath のロボットが失敗した直後の画面を調べる係です。次を必ず守ってください。
- ページを読むだけにする。クリック、文字の入力、送信、ページの移動（URL を開く、戻る、再読み込み）、タブを開く・閉じる、をしない
- フォームの値、パスワード、Cookie、個人情報を結果に書かない
- 今開いているタブ（下の「今のタブ」）を調べる。無ければ、期待する URL のホストのタブを探して読む
"""


def task_text(i: dict) -> str:
    return f"""{RULES}
## ロボットが失敗したこと
- 失敗したアクティビティ：{i.get('activity')}
- 探していた要素の種類：{i.get('elementType')}
- そのときのセレクター（UiPath の形）：{i.get('selector')}
- 期待していたページ：URL {i.get('expectedUrl')}、題名 {i.get('expectedTitle')}
- エラー：{i.get('error')}
- 今のタブ（UiPath から見えたもの）：{json.dumps(i.get('currentTab'), ensure_ascii=False)}

## 調べること
1. 今のタブの URL と題名、今どんな画面か
2. 探していた要素（例：メールアドレスの入力欄）が今のページにあるか。あればその見えている名前と HTML の属性（tag、id、name、type、aria-label、placeholder、class）
3. UiPath が見つけられなかった理由として、いちばんありそうなものと、直し方の提案
"""


async def main(inp: str, outp: str) -> int:
    i = json.load(open(inp, encoding="utf-8"))
    hosts = [h for h in {urlparse(i.get("expectedUrl") or "").hostname, urlparse((i.get("currentTab") or {}).get("url") or "").hostname} if h]
    browser = Browser("chrome", allowed_domains=[f"*.{h.split('.', 1)[1]}" if h.count(".") > 1 else h for h in hosts] or None)
    llm = ChatAnthropic(os.environ.get("UI_REPAIR_MODEL", "claude-sonnet-5-5"))
    agent = Agent(task_text(i), llm, browser=browser, output_model_schema=Observation, highlight_actions=False)
    result = await agent.run(max_steps=int(os.environ.get("UI_REPAIR_MAX_STEPS", "8")), timeout=300)
    out = result.structured_output
    if out is None:
        print("browser-use が結果を返さなかった: " + "; ".join(result.errors()[-3:] if result.errors() else []), file=sys.stderr)
        return 1
    data = out.model_dump() if hasattr(out, "model_dump") else out
    # 念のため、入力値らしいものは捨てる
    attrs = data.get("element", {}).get("attributes", {})
    data["element"]["attributes"] = {k: v for k, v in attrs.items() if k in ("tag", "id", "name", "type", "aria-label", "placeholder", "class")}
    json.dump(data, open(outp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("使い方: python tools/repair/observe.py <in.json> <out.json>", file=sys.stderr)
        sys.exit(2)
    sys.exit(asyncio.run(main(sys.argv[1], sys.argv[2])))
