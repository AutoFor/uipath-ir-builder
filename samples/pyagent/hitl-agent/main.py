"""経費の申請を受け、上限を超えたら人に承認を求める（エスカレーション）エージェント。

- 上限（limit）以下：自動で承認する
- 上限を超える：Action Center にタスクを作り、止まる。人が承認か却下を押すと、その結果で分岐して再開する
"""

from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt
from pydantic import BaseModel
from uipath.platform.common import CreateEscalation


class Input(BaseModel):
    applicant: str
    amount: int
    purpose: str
    limit: int = 10000


class State(BaseModel):
    applicant: str
    amount: int
    purpose: str
    limit: int = 10000
    decision: str = ""
    decided_by: str = ""
    note: str = ""


class Output(BaseModel):
    decision: str  # approved / rejected / auto-approved
    decided_by: str
    note: str


async def review(state: State) -> State:
    if state.amount <= state.limit:
        return state.model_copy(update={"decision": "auto-approved", "decided_by": "agent", "note": f"上限 {state.limit} 円以下"})
    # 上限を超えた：人に上げる。再開すると、完了したタスク（action と data を含む）が返る
    task = interrupt(CreateEscalation(
        title=f"経費の承認: {state.applicant} {state.amount:,} 円",
        data={"applicant": state.applicant, "amount": state.amount, "purpose": state.purpose},
        app_name="hitl-expense-approval",
        app_folder_path="Shared",
        priority="Medium",
    ))
    action = (getattr(task, "action", None) or (task.get("action") if isinstance(task, dict) else None) or "").lower()
    data = getattr(task, "data", None) or (task.get("data") if isinstance(task, dict) else None) or {}
    # 完了した人は dict（displayName・emailAddress など）で来る
    who = getattr(task, "completed_by_user", None) or getattr(task, "assigned_to_user", None) or {}
    who_name = (who.get("displayName") or who.get("name")) if isinstance(who, dict) else (getattr(who, "display_name", None) or str(who))
    decision = "approved" if action in ("approve", "approved") else "rejected" if action in ("reject", "rejected") else (action or "unknown")
    return state.model_copy(update={"decision": decision, "decided_by": who_name or "human", "note": str(data.get("comment", ""))[:200]})


async def finish(state: State) -> Output:
    return Output(decision=state.decision, decided_by=state.decided_by, note=state.note)


builder = StateGraph(State, input=Input, output=Output)
builder.add_node("review", review)
builder.add_node("finish", finish)
builder.add_edge(START, "review")
builder.add_edge("review", "finish")
builder.add_edge("finish", END)
graph = builder.compile()
