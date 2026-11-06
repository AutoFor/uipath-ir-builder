using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（JoinDataTables_Min）から生成。手で直さず IR を直す
    public class JoinDataTables_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable a = new DataTable();
            DataTable b = new DataTable();
            DataTable res = default;
            {
                var __col = a.Columns.Add("Name", typeof(String));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            {
                var __col = a.Columns.Add("Age", typeof(Int32));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            a.Rows.Add(new object[] {"Alice", 30});
            a.Rows.Add(new object[] {"Bob", 25});
            a.Rows.Add(new object[] {"Carol", 35});
            {
                var __col = b.Columns.Add("Name", typeof(String));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            {
                var __col = b.Columns.Add("City", typeof(String));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            b.Rows.Add(new object[] {"Alice", "Tokyo"});
            b.Rows.Add(new object[] {"Bob", "Osaka"});
            b.Rows.Add(new object[] {"Dave", "Nagoya"});
            // JoinDataTables はCoded API が無い（Coded API なし（ISystemService に JoinDataTables が無い））ので XAML 経由（coded/_xaml/JoinDataTables_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/JoinDataTables_Min_1.xaml", new Dictionary<string, object> { ["a"] = a, ["b"] = b, ["res"] = res });
            res = (DataTable)__xaml1["res"];
            Log(message: Convert.ToString("rows=" + res.Rows.Count), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("city0=" + res.Rows[0][3].ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("city1=" + res.Rows[1][3].ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
