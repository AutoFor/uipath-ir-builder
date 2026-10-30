using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RemoveDataColumn_Full）から生成。手で直さず IR を直す
    public class RemoveDataColumn_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = new DataTable();
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
            {
                var __col = dt.Columns.Add("Note", typeof(String));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            {
                var __col = dt.Columns.Add("City", typeof(String));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            {
                var __col = dt.Columns.Add("Zip", typeof(String));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            dt.Rows.Add(new object[] {"Alice", 30, "n", "Tokyo", "100"});
            // 列名で消す
            system.RemoveDataColumn(ref dt, "Note");
            // 列番号で消す
            dt.Columns.RemoveAt(1);
            // DataColumn で消す
            dt.Columns.Remove(dt.Columns["Zip"]);
            Log(message: Convert.ToString("columns=" + string.Join(",", dt.Columns.Cast<DataColumn>().Select(c => c.ColumnName))), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("rows=" + dt.Rows.Count), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
