using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GenerateDataTable_Full）から生成。手で直さず IR を直す
    public class GenerateDataTable_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            // 文字列から表を作る
            // GenerateDataTable はCoded API が無い（Coded API なし（ISystemService に GenerateDataTable が無い））ので XAML 経由（coded/_activities/GenerateDataTable_3f6a1c.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/GenerateDataTable_3f6a1c.xaml", new Dictionary<string, object> { ["in_CSVParsing"] = true, ["in_ColumnSeparators"] = ";", ["in_ContinueOnError"] = false, ["in_Input"] = "Name;Age;Note\nAlice;30;\"x;y\"\nBob;25", ["in_NewLineSeparator"] = "\n" });
            dt = (System.Data.DataTable)__xaml1["out_DataTable"];
            Log(message: Convert.ToString("rows=" + dt.Rows.Count), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("columns=" + dt.Columns.Count), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("note0=" + dt.Rows[0]["Note"].ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("Age.Type=" + dt.Columns["Age"].DataType.Name), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("name1=" + dt.Rows[1]["Name"].ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
