using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（UpdateRowItem_Full）から生成。手で直さず IR を直す
    public class UpdateRowItem_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = new DataTable();
            DataRow row = default;
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
            row = dt.Rows[2];
            // 列名で更新
            system.UpdateRowItem(value: "Zed", row: row, columnName: "Name");
            // 列番号で更新
            row[1] = 99;
            Log(message: Convert.ToString("name2=" + dt.Rows[2]["Name"].ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("age2=" + dt.Rows[2]["Age"].ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
