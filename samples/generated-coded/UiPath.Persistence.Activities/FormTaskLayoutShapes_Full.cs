using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FormTaskLayoutShapes_Full）から生成。手で直さず IR を直す
    public class FormTaskLayoutShapes_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute(String in_InvoiceNo)
        {
            FormTaskData task = default;
            String action = default;
            String comment = default;
            // 配列の形
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateFormTask_d04dc1.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateFormTask_d04dc1.xaml", new Dictionary<string, object> { ["in_FormLayout"] = "[{\"type\":\"textfield\",\"key\":\"InvoiceNo\",\"label\":\"請求書\",\"input\":true,\"disabled\":true},{\"type\":\"content\",\"key\":\"guide\",\"label\":\"案内\",\"input\":false,\"html\":\"<p>請求書 <b>{{data.InvoiceNo}}</b> を確認してください</p>\"},{\"type\":\"textarea\",\"key\":\"Comment\",\"label\":\"コメント\",\"input\":true,\"rows\":3},{\"type\":\"button\",\"label\":\"承認\",\"key\":\"approve\",\"theme\":\"primary\",\"input\":true,\"tableView\":false},{\"type\":\"button\",\"label\":\"却下\",\"key\":\"reject\",\"theme\":\"danger\",\"input\":true,\"tableView\":false}]", ["in_Labels"] = "uipath-ir-test", ["in_TaskTitle"] = "uipath-ir-test-shape-array " + in_InvoiceNo, ["in_FormData_InvoiceNo"] = in_InvoiceNo });
            task = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml1["out_TaskOutput"];
            comment = (String)__xaml1["out_FormData_Comment"];
            Log(message: "created array=" + Convert.ToString(task.Id), level: UiPath.CodedWorkflows.LogLevel.Info);
            // 配列の形のタスクを待つ
            // WaitForFormTaskAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/WaitForFormTaskAndResume_102572.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/WaitForFormTaskAndResume_102572.xaml", new Dictionary<string, object> { ["in_StatusMessage"] = "uipath-ir-test shape", ["in_TaskInput"] = task });
            action = (System.String)__xaml2["out_TaskAction"];
            task = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml2["out_TaskOutput"];
            Log(message: "resume action=" + action + " comment=" + comment, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
