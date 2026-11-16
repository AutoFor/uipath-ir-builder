using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（TestCase_Tdq）から生成。手で直さず IR を直す
    public class TestCase_Tdq : CodedWorkflow
    {
        [TestCase]
        public void Execute()
        {
            DataTable dt = new DataTable();
            List<UiPath.Testing.Core.TestDataQueueItem> items = default;
            Dictionary<String, Object> item = default;
            String path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uta-attach.txt");
            // Given
            {
                var __col = dt.Columns.Add("customer", typeof(String));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            {
                var __col = dt.Columns.Add("count", typeof(Int32));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            dt.Rows.Add(new Object[] { "B-002", 5 });
            dt.Rows.Add(new Object[] { "C-003", 7 });
            // 1 件追加
            testing.AddTestDataQueueItem(queueName: "IRTestDataQueue", itemInformation: new Dictionary<string, object> { ["customer"] = "A-001", ["count"] = 3 }, folderPath: "Shared");
            // 2 件まとめて追加
            testing.BulkAddTestDataQueueItems(queueName: "IRTestDataQueue", queueItemsDataTable: dt, folderPath: "Shared");
            // 全件を取る
            items = testing.GetTestDataQueueItems(queueName: "IRTestDataQueue", folderPath: "Shared", idFilter: null, testDataQueueItemStatus: UiPath.Testing.Activities.TestDataQueues.Enums.TestDataQueueItemStatus.All, skip: null, top: null, timeoutMs: 60000);
            Log(message: "all=" + items.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            // 3 件ある
            _ = testing.VerifyExpressionWithOperator(items.Count, UiPath.Testing.Comparison.Equality, 3, null, true, null, false, false);
            // When
            // 1 件取って使用済みにする
            item = testing.GetTestDataQueueItem(queueName: "IRTestDataQueue", folderPath: "Shared");
            Log(message: "got=" + item["customer"].ToString() + " count=" + item["count"].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            // 未使用を取る
            items = testing.GetTestDataQueueItems(queueName: "IRTestDataQueue", folderPath: "Shared", idFilter: null, testDataQueueItemStatus: UiPath.Testing.Activities.TestDataQueues.Enums.TestDataQueueItemStatus.OnlyNotConsumed, skip: null, top: null, timeoutMs: 60000);
            Log(message: "notConsumed=" + items.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            // 未使用は 2 件
            _ = testing.VerifyExpressionWithOperator(items.Count, UiPath.Testing.Comparison.Equality, 2, null, true, null, false, false);
            // 添付するファイルを書く
            system.WriteTextFile(text: "attach from TestCase_Tdq", file: LocalResource.FromPath(path));
            // ファイルを添付
            testing.AttachDocument(filePath: path, tags: new String[] { "ir", "sample" });
            // Then
            // 全件を取り直す
            items = testing.GetTestDataQueueItems(queueName: "IRTestDataQueue", folderPath: "Shared", idFilter: null, testDataQueueItemStatus: UiPath.Testing.Activities.TestDataQueues.Enums.TestDataQueueItemStatus.All, skip: null, top: null, timeoutMs: 60000);
            // 全件削除
            testing.DeleteTestDataQueueItems(testDataQueueItems: items, folderPath: "Shared");
            // 消えたか見る
            items = testing.GetTestDataQueueItems(queueName: "IRTestDataQueue", folderPath: "Shared", idFilter: null, testDataQueueItemStatus: UiPath.Testing.Activities.TestDataQueues.Enums.TestDataQueueItemStatus.All, skip: null, top: null, timeoutMs: 60000);
            Log(message: "afterDelete=" + items.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            // 0 件になった
            _ = testing.VerifyExpressionWithOperator(items.Count, UiPath.Testing.Comparison.Equality, 0, null, true, null, false, false);
        }
    }
}
