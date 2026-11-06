using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FilterDataTable_Num）から生成。手で直さず IR を直す
    public class FilterDataTable_Num : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = new DataTable();
            DataTable res = default;
            {
                var __col = dt.Columns.Add("Name", typeof(String));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            {
                var __col = dt.Columns.Add("Age", typeof(Int32));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            dt.Rows.Add(new object[] {"Alice", 30});
            dt.Rows.Add(new object[] {"Bob", 25});
            dt.Rows.Add(new object[] {"Carol", 35});
            dt.Rows.Add(new object[] {"Bob", 25});
            // FilterDataTable はCoded API が無い（Coded API なし（ISystemService に FilterDataTable が無い。条件の List は DataView.RowFilter などで書き直すことになり、同じ挙動の保証がない））ので XAML 経由（coded/_xaml/FilterDataTable_Num_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/FilterDataTable_Num_1.xaml", new Dictionary<string, object> { ["dt"] = dt, ["res"] = res });
            res = (DataTable)__xaml1["res"];
            Log(message: Convert.ToString("rows=" + res.Rows.Count), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("names=" + string.Join(",", res.Rows.Cast<DataRow>().Select(r => r["Name"].ToString()))), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
