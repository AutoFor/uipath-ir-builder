using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（MergeDataTable_Min）から生成。手で直さず IR を直す
    public class MergeDataTable_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dest = new DataTable();
            DataTable src = new DataTable();
            {
                var __col = dest.Columns.Add("Name", typeof(String));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            {
                var __col = dest.Columns.Add("Age", typeof(Int32));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            dest.Rows.Add(new object[] {"Alice", 30});
            dest.Rows.Add(new object[] {"Bob", 25});
            {
                var __col = src.Columns.Add("Name", typeof(String));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            {
                var __col = src.Columns.Add("Age", typeof(Int32));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            src.Rows.Add(new object[] {"Carol", 35});
            src.Rows.Add(new object[] {"Dave", 40});
            system.MergeDataTable(src, ref dest);
            Log(message: Convert.ToString("rows=" + dest.Rows.Count), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("names=" + string.Join(",", dest.Rows.Cast<DataRow>().Select(r => r["Name"].ToString()))), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
