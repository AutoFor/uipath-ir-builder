using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AddDataRow_Min）から生成。手で直さず IR を直す
    public class AddDataRow_Min : CodedWorkflow
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
            dt.Rows.Add(new object[] {"Alice", 30});
            Log(message: Convert.ToString("rows=" + dt.Rows.Count), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("name=" + dt.Rows[0]["Name"].ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("age=" + dt.Rows[0]["Age"].ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
