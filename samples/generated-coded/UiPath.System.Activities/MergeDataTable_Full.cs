using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（MergeDataTable_Full）から生成。手で直さず IR を直す
    public class MergeDataTable_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dest = new DataTable();
            DataTable src = new DataTable();
            DataTable src2 = new DataTable();
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
            {
                var __col = src.Columns.Add("City", typeof(String));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            src.Rows.Add(new object[] {"Carol", 35, "Tokyo"});
            src.Rows.Add(new object[] {"Dave", 40, "Osaka"});
            {
                var __col = src2.Columns.Add("Name", typeof(String));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            {
                var __col = src2.Columns.Add("Age", typeof(Int32));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            {
                var __col = src2.Columns.Add("Zip", typeof(String));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            src2.Rows.Add(new object[] {"Eve", 20, "100"});
            // 列を足して結合
            system.MergeDataTable(src, ref dest, System.Data.MissingSchemaAction.Add);
            Log(message: Convert.ToString("rows=" + dest.Rows.Count), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("columns=" + string.Join(",", dest.Columns.Cast<DataColumn>().Select(c => c.ColumnName))), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("city2=" + dest.Rows[2]["City"].ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            // 足りない列は無視
            system.MergeDataTable(src2, ref dest, System.Data.MissingSchemaAction.Ignore);
            Log(message: Convert.ToString("rows=" + dest.Rows.Count), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("columns2=" + string.Join(",", dest.Columns.Cast<DataColumn>().Select(c => c.ColumnName))), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
