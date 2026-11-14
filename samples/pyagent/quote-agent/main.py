"""見積もりの相談に答えるエージェント。合計とランクは、デプロイ済みの API ワークフロー（Probe）を道具として呼んで出す。"""

import asyncio
import json

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import create_react_agent
from pydantic import BaseModel
from uipath.platform import UiPath
from uipath_langchain.chat import UiPathChatAnthropicBedrock

FOLDER = "Shared/ApiwfControlTour"


class Item(BaseModel):
    name: str
    price: float


@tool
async def price_tier(items: list[Item], limit: float) -> str:
    """品目（name・price）の合計とランク（GOLD / SILVER）を、UiPath の API ワークフロー Probe で計算する。limit は合計の上限。"""
    uip = UiPath()  # 関数の中で作る（モジュールの上で作らない）
    job = await uip.processes.invoke_async(
        "Probe", {"items": [i.model_dump() for i in items], "limit": limit}, folder_path=FOLDER
    )
    for _ in range(60):
        job = await uip.jobs.retrieve_async(job.key, folder_path=FOLDER)
        if job.state in ("Successful", "Faulted", "Stopped"):
            break
        await asyncio.sleep(2)
    return json.dumps({"state": job.state, "output": job.output_arguments}, ensure_ascii=False)


class Input(BaseModel):
    question: str


class Output(BaseModel):
    answer: str
    tool_calls: int


async def answer(state: Input) -> Output:
    llm = UiPathChatAnthropicBedrock(model="anthropic.claude-haiku-4-5-20251001-v1:0")
    agent = create_react_agent(llm, [price_tier])
    result = await agent.ainvoke({
        "messages": [
            SystemMessage("見積もりの相談に日本語で短く答える。合計とランクは必ず price_tier で計算し、自分で暗算しない。"),
            HumanMessage(state.question),
        ]
    })
    calls = sum(len(getattr(m, "tool_calls", []) or []) for m in result["messages"])
    last = result["messages"][-1].content
    # Claude は content をブロックの配列で返すことがある（文字列だけを取り出す）
    text = last if isinstance(last, str) else "".join(b.get("text", "") for b in last if isinstance(b, dict))
    return Output(answer=text, tool_calls=calls)


builder = StateGraph(Input, output=Output)
builder.add_node("answer", answer)
builder.add_edge(START, "answer")
builder.add_edge("answer", END)
graph = builder.compile()
