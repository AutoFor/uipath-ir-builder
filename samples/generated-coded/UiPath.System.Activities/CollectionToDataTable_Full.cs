using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CollectionToDataTable_Full）から生成。手で直さず IR を直す
    public class CollectionToDataTable_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<Int32> items = new List<int>() { 10, 20 };
            DataTable dt = default;
            // コレクションを表にする
            // CollectionToDataTable はCoded API が無い（Coded API なし（ISystemService に CollectionToDataTable が無い））ので XAML 経由（coded/_xaml/CollectionToDataTable_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/CollectionToDataTable_Full_1.xaml", new Dictionary<string, object> { ["items"] = items, ["dt"] = dt });
            dt = (DataTable)__xaml1["dt"];
            Log(message: Convert.ToString("rows=" + dt.Rows.Count), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("columns=" + dt.Columns.Count), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
