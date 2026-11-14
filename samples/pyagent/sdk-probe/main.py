"""Orchestrator のアセットと Data Fabric の表を Python の SDK で読む（試し）。

- テキストのアセットの値を読む
- 資格情報のアセットは、読めたかどうかと文字数だけを返す（値は返さない・ログに出さない）
- Data Fabric の表のレコードを、一覧（list_records）と SQL（query_entity_records）の 2 通りで読む
"""

import logging
from dataclasses import dataclass, field

from uipath.platform import UiPath

log = logging.getLogger(__name__)


@dataclass
class ProbeIn:
    folder_path: str = "Shared"
    text_asset: str = "IrProbeText"
    credential_asset: str = ""  # 空なら資格情報は試さない
    entity_name: str = "IrProbeItem"


@dataclass
class ProbeOut:
    text_value: str | None
    credential: dict
    records: list[dict]
    sql_rows: list[dict]
    errors: list[str] = field(default_factory=list)


async def main(input: ProbeIn) -> ProbeOut:
    uip = UiPath()  # 関数の中で作る
    errors: list[str] = []

    text_value = None
    try:
        asset = await uip.assets.retrieve_async(input.text_asset, folder_path=input.folder_path)
        text_value = getattr(asset, "value", None) or getattr(asset, "string_value", None)
        log.info("アセット %s を読んだ", input.text_asset)
    except Exception as e:
        errors.append(f"アセット: {type(e).__name__}: {str(e)[:300]}")

    credential: dict = {"tried": bool(input.credential_asset)}
    if input.credential_asset:
        try:
            pw = await uip.assets.retrieve_credential_async(input.credential_asset, folder_path=input.folder_path)
            credential.update(read=pw is not None, length=len(pw or ""))  # 値は返さない
            log.info("資格情報 %s を読んだ（%d 文字）", input.credential_asset, len(pw or ""))
        except Exception as e:
            credential.update(read=False)
            errors.append(f"資格情報: {type(e).__name__}: {str(e)[:300]}")

    records: list[dict] = []
    sql_rows: list[dict] = []
    try:
        entity = await uip.entities.retrieve_by_name_async(input.entity_name)
        res = await uip.entities.list_records_async(entity.id, limit=50)
        items = getattr(res, "value", None) or getattr(res, "items", None) or res
        for r in items:
            d = r.model_dump() if hasattr(r, "model_dump") else dict(r)
            records.append({k: d.get(k) for k in ("Title", "Amount", "Id") if k in d})
        log.info("一覧で %d 件", len(records))
    except Exception as e:
        errors.append(f"list_records: {type(e).__name__}: {str(e)[:300]}")
    try:
        sql_rows = await uip.entities.query_entity_records_async(
            f"SELECT Title, Amount FROM {input.entity_name} WHERE Amount >= 500"
        )
        log.info("SQL で %d 件", len(sql_rows))
    except Exception as e:
        errors.append(f"SQL: {type(e).__name__}: {str(e)[:300]}")

    return ProbeOut(text_value=text_value, credential=credential, records=records, sql_rows=sql_rows, errors=errors)
