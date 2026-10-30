using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（LookupDataTable_Full）から生成。手で直さず IR を直す
    public class LookupDataTable_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = new DataTable();
            Object v1 = default;
            Object v2 = default;
            Object v3 = default;
            Int32 idx = default;
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
            // 列名で探す
            v1 = system.LookupDataTable(dataTable: dt, lookupValue: "Bob", lookupColumnName: "Name", targetColumnName: "Age", rowIndex: out idx);
            // 列番号で探す
            v2 = system.LookupDataTable(dataTable: dt, lookupValue: "Carol", lookupColumnName: dt.Columns[0].ColumnName, targetColumnName: dt.Columns[1].ColumnName, rowIndex: out _);
            // DataColumn で探す
            v3 = system.LookupDataTable(dataTable: dt, lookupValue: "Alice", lookupColumnName: dt.Columns["Name"].ColumnName, targetColumnName: dt.Columns["Age"].ColumnName, rowIndex: out _);
            Log(message: Convert.ToString("byName=" + v1.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("rowIndex=" + idx.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("byIndex=" + v2.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("byColumn=" + v3.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
