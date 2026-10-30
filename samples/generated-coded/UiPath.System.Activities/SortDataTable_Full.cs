using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SortDataTable_Full）から生成。手で直さず IR を直す
    public class SortDataTable_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = new DataTable();
            DataTable r1 = default;
            DataTable r2 = default;
            DataTable r3 = default;
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
            // 列名・降順
            r1 = system.SortDataTable(dataTable: dt, columnName: "Name", sortOrder: UiPath.Core.Activities.SortOrder.Descending);
            // 列番号・昇順
            r2 = system.SortDataTable(dataTable: dt, columnName: dt.Columns[1].ColumnName, sortOrder: UiPath.Core.Activities.SortOrder.Ascending);
            // DataColumn・降順
            r3 = system.SortDataTable(dataTable: dt, columnName: dt.Columns["Age"].ColumnName, sortOrder: UiPath.Core.Activities.SortOrder.Descending);
            Log(message: Convert.ToString("byName=" + string.Join(",", r1.Rows.Cast<DataRow>().Select(r => r["Name"].ToString()))), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("byIndex=" + string.Join(",", r2.Rows.Cast<DataRow>().Select(r => r["Name"].ToString()))), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("byColumn=" + string.Join(",", r3.Rows.Cast<DataRow>().Select(r => r["Name"].ToString()))), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
