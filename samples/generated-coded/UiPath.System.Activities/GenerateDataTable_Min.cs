using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GenerateDataTable_Min）から生成。手で直さず IR を直す
    public class GenerateDataTable_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            // GenerateDataTable はCoded API が無い（Coded API なし（ISystemService に GenerateDataTable が無い））ので XAML 経由（coded/_xaml/GenerateDataTable_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/GenerateDataTable_Min_1.xaml", new Dictionary<string, object> { ["dt"] = dt });
            dt = (DataTable)__xaml1["dt"];
            Log(message: Convert.ToString("rows=" + dt.Rows.Count), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("columns=" + string.Join(",", dt.Columns.Cast<DataColumn>().Select(c => c.ColumnName))), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("name=" + dt.Rows[1]["Name"].ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
