using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ShowFormActivity_Design）から生成。手で直さず IR を直す
    public class ShowFormActivity_Design : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable items = new DataTable();
            String outName = default;
            Double outAmount = default;
            String outDept = default;
            DateTime outDate = default;
            DataTable outItems = default;
            // 明細の表を作る
            // InvokeCode はCoded API が無い（Coded では C# をそのまま書くので InvokeCode は要らない）ので XAML 経由（coded/_activities/InvokeCode_83ad7a.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/InvokeCode_83ad7a.xaml", new Dictionary<string, object> { ["io_Arguments_io_dt"] = items });
            items = (DataTable)__xaml1["io_Arguments_io_dt"];
            // 経費の申請を出す（入れ物を使ったフォーム）
            // ShowFormActivity は対応表が無いので XAML 経由（coded/_activities/ShowFormActivity_74ce18.xaml）
            RunWorkflow("coded/_activities/ShowFormActivity_74ce18.xaml", new Dictionary<string, object> { ["in_Top"] = 16, ["in_Arguments_amount"] = 12800, ["in_Arguments_date"] = new DateTime(2026, 11, 17), ["in_Arguments_dept"] = "dev", ["in_Arguments_email"] = "taro@example.com", ["in_Arguments_items"] = items, ["in_Arguments_name"] = "山田 太郎", ["in_Arguments_payment"] = "self", ["in_Arguments_phone"] = "090-1234-5678", ["in_Arguments_reason"] = "顧客先への出張（大阪）" });
            // GetFormFieldsActivity は対応表が無いので XAML 経由（coded/_activities/GetFormFieldsActivity_010651.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/GetFormFieldsActivity_010651.xaml", null);
            outAmount = (Double)__xaml2["out_Arguments_amount"];
            outDate = (DateTime)__xaml2["out_Arguments_date"];
            outDept = (String)__xaml2["out_Arguments_dept"];
            outItems = (DataTable)__xaml2["out_Arguments_items"];
            outName = (String)__xaml2["out_Arguments_name"];
            Log(message: "読んだ: " + outName + " " + outAmount.ToString() + " " + outDept + " " + outDate.ToString("yyyy-MM-dd") + " 明細 " + outItems.Rows.Count.ToString() + " 行 " + outItems.Rows[0]["item"].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            // CloseFormActivity は対応表が無いので XAML 経由（coded/_activities/CloseFormActivity_0a2862.xaml）
            RunWorkflow("coded/_activities/CloseFormActivity_0a2862.xaml", null);
        }
    }
}
