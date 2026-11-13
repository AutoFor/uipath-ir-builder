// テナントで確かめる見本：キューに項目を足す（Automate の flow）。queue はキューの名前、key はキューの Key、folderPath はキューのあるフォルダ。
// PERSONAL_WORKSPACE と QUEUE_KEY は実際の値に置き換えて流す（uip or queues create で作った試しのキュー）。
import { flow, queueItem, script } from "@uipath/maestro-builder-sdk";

export default flow("QueueTour")
  .name("QueueTour")
  .step("enqueue", queueItem({ queue: "MaestroTestQueue", folderPath: "PERSONAL_WORKSPACE/MaestroDeployTest", key: "QUEUE_KEY", reference: "maestro-test-1", item: { invoice: "INV-1", amount: 1200 } }))
  .step("done", script({ code: "return { queued: true };" }))
  .build();
