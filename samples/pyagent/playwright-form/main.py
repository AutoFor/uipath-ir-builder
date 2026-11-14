"""Playwright でフォームを入力・送信し、サーバーが受け取った値を返す（DOM の操作の試し）。

試し用の公開ページ https://httpbin.org/forms/post を使う。送信すると、受け取った値が JSON で返る。
クラウドのコンテナにブラウザが無いときは、その場で `playwright install chromium` を試し、経過を返す。
"""

import json
import logging
import subprocess
import sys
from dataclasses import dataclass, field

from playwright.async_api import async_playwright

log = logging.getLogger(__name__)


@dataclass
class FormIn:
    customer: str
    size: str = "medium"  # small / medium / large
    toppings: list[str] = field(default_factory=lambda: ["cheese"])  # bacon / cheese / onion / mushroom
    comments: str = ""


@dataclass
class FormOut:
    ok: bool
    received: dict
    steps: list[str]


async def _launch(p, steps: list[str]):
    try:
        return await p.chromium.launch(headless=True)
    except Exception as e:  # ブラウザが無い（クラウドのコンテナなど）
        steps.append(f"launch に失敗: {str(e).splitlines()[0][:200]}")
        r = subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], capture_output=True, text=True, timeout=600)
        steps.append(f"playwright install chromium: 終了コード {r.returncode} {(r.stderr or r.stdout)[-300:]}")
        return await p.chromium.launch(headless=True)


async def main(input: FormIn) -> FormOut:
    steps: list[str] = []
    try:
        async with async_playwright() as p:
            browser = await _launch(p, steps)
            page = await browser.new_page()
            await page.goto("https://httpbin.org/forms/post", timeout=60000)
            steps.append(f"開いた: {await page.title() or '(タイトルなし)'}")
            log.info("フォームを開いた")

            await page.fill("input[name=custname]", input.customer)
            await page.check(f"input[name=size][value={input.size}]")
            for t in input.toppings:
                await page.check(f"input[name=topping][value={t}]")
            await page.fill("textarea[name=comments]", input.comments)
            steps.append("入力した")
            log.info("入力した: %s / %s / %s", input.customer, input.size, ",".join(input.toppings))

            await page.click("button")
            await page.wait_for_load_state()
            body = await page.inner_text("body")
            received = json.loads(body).get("form", {})
            steps.append("送信して、受け取った値を読んだ")
            log.info("受け取った値: %s", received)
            print(f"[pwfn] 送信できた: {received}")
            await browser.close()
            return FormOut(ok=True, received=received, steps=steps)
    except Exception as e:
        steps.append(f"失敗: {type(e).__name__}: {str(e)[:400]}")
        log.error("失敗: %s", e)
        return FormOut(ok=False, received={}, steps=steps)
