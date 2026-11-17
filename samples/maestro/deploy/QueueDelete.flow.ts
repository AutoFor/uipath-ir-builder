// Maestro Flow の見本：キューの項目を消す（Delete queue items、core.action.queue.delete-items 1.0）（AUT-1211）。
// このノードは SDK 6.66.5 に無く、テナントの登録簿でも「not enabled for this tenant」（uip maestro flow node add が断る）。
// ただし実行はできた（trial の debug で deletedCount 1）。rawNode に、uip の CLI（@uipath/maestro-tool）が持つ定義をそのまま渡す。
// 定義は CLI の版で変わりうる。取り直すときは knowledge/maestro.md の「キューのノード」の手順。
// 消せるのは New の項目だけ（各項目に Id と RowVersion が要る。queueItem の出力をそのまま渡せる）。
// キーとキューは試しの組織 sorahaneworks の Shared の AUT1211Queue。テナントが変われば作り直す。
// 動かす：node tools/maestro/verify.mjs --out <dir> samples/maestro/deploy/QueueDelete.flow.ts
//        node tools/maestro/debug.mjs <dir>/QueueDelete.flow/QueueDelete.flow --profile trial

import { flow, queueItem, rawNode, script, js } from "@uipath/maestro-builder-sdk";

// uip 1.204.0 の @uipath/maestro-tool の core.action.queue.delete-items@1.0（latest）
const deleteItems = {"nodeType":"core.action.queue.delete-items","version":"1.0","category":"queue-tools","description":"Delete items with New status from an Orchestrator queue","tags":["queue","orchestrator","delete","items"],"sortOrder":76,"supportsErrorHandling":true,"display":{"label":"Delete queue items","icon":"list-x"},"handleConfiguration":[{"position":"left","handles":[{"id":"input","type":"target","handleType":"input"}]},{"position":"right","handles":[{"id":"success","type":"source","handleType":"output"}]}],"debug":{"runtime":"bpmnEngine"},"model":{"type":"bpmn:ServiceTask","serviceType":"Orchestrator.DeleteQueueItems","version":"v1","context":[{"name":"_label","type":"string","value":""}]},"inputDefinition":{"type":"object","properties":{"items":{"type":"array"}},"required":["items"]},"inputDefaults":{"items":null},"outputDefinition":{"output":{"type":"number","description":"The number of queue items deleted","source":"=deletedCount","var":"output"},"error":{"type":"object","description":"Error information if the node fails","source":"=Error","var":"error","schema":{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","required":["code","message","detail","category","status"],"properties":{"code":{"type":"string","description":"Error code as a string"},"message":{"type":"string","description":"High-level error message"},"detail":{"type":"string","description":"Detailed error description"},"category":{"type":"string","description":"Error category"},"status":{"type":"integer","description":"HTTP status code"}},"additionalProperties":false}}},"form":{"id":"delete-queue-items-properties","title":"Delete queue items","sections":[{"id":"items","title":"Items","collapsible":true,"defaultExpanded":true,"fields":[{"name":"inputs.items","type":"custom","component":"code-editor","label":"Queue items","description":"An array of queue items to delete — each needs Id and RowVersion, e.g. the items returned by a queue trigger","componentProps":{"singleLine":true,"mode":"expression","showVariableButton":true,"showAiButton":false,"placeholder":"[{ \"Id\": 123, \"RowVersion\": \"...\" }]","expectedType":"array"},"validation":{"required":true,"messages":{"required":"At least one queue item is required"}}}]}]},"runtimeConstraints":{"exclude":["api-function"]}};

export default flow("QueueDelete")
  .name("QueueDelete")
  .step("enqueue", queueItem({ queue: "AUT1211Queue", folderPath: "Shared", key: "8f85b4ea-2ff2-43b5-a652-a997a7ee8c3b", reference: "aut1211-del", item: { n: 1 } }))
  .step("drop", rawNode({ nodeType: "core.action.queue.delete-items", version: "1.0", manifest: deleteItems, inputs: { items: js`[$vars.enqueue.output]` } }))
  .step("done", script({ code: "return { deleted: $vars.drop.output };" }))
  .build();
