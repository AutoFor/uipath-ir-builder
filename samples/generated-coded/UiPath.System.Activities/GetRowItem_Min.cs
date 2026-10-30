using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetRowItem_Min）から生成。手で直さず IR を直す
    public class GetRowItem_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = new DataTable();
            DataRow row = default;
            Object v = default;
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
            row = dt.Rows[1];
            v = (Object)system.GetRowItem(row: row, columnName: "Name");
            Log(message: Convert.ToString("value=" + v.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
