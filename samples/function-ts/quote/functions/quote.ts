import { defineFunction, defineSchema, type FunctionContext } from "@uipath/coded-functions-js-sdk";

// 見本（AUT-1195）：見積りの合計に、会員の区分で割引を掛ける業務の規則を、関数に閉じ込める。
// method と path を書かないので、HTTP のエンドポイントにはならず、ジョブ（Orchestrator のプロセス）として動く。
interface QuoteInput {
  /** 品目の単価と数量 */
  items: { price: number; quantity: number }[];
  /**
   * 会員の区分（GOLD は 10% 引き、SILVER は 5% 引き）
   * @default "NONE"
   */
  tier?: "GOLD" | "SILVER" | "NONE";
}

interface QuoteOutput {
  subtotal: number;
  discount: number;
  total: number;
}

const RATES: Record<string, number> = { GOLD: 0.1, SILVER: 0.05, NONE: 0 };

function main(input: QuoteInput, _ctx: FunctionContext): QuoteOutput {
  const subtotal = (input.items ?? []).reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = Math.round(subtotal * (RATES[input.tier ?? "NONE"] ?? 0));
  return { subtotal, discount, total: subtotal - discount };
}

export default defineFunction({
  name: "quote",
  description: "品目の合計に、会員の区分の割引を掛けた見積りを返す。",
  input: defineSchema<QuoteInput>(),
  output: defineSchema<QuoteOutput>(),
  handler: main,
});
