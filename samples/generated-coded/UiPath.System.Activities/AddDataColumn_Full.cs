using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AddDataColumn_Full）から生成。手で直さず IR を直す
    public class AddDataColumn_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = new DataTable();
            // ID列を足す
            {
                var __col = dt.Columns.Add("Id", typeof(Int32));
                __col.AllowDBNull = false;
                __col.AutoIncrement = true;
                __col.Unique = true;
                __col.MaxLength = -1;
                __col.DefaultValue = DBNull.Value;
            }
            {
                var __col = dt.Columns.Add("Code", typeof(String));
                __col.AllowDBNull = true;
                __col.AutoIncrement = false;
                __col.Unique = false;
                __col.MaxLength = 10;
                __col.DefaultValue = "N/A";
            }
            dt.Columns.Add(new DataColumn("Memo", typeof(string)));
            Log(message: Convert.ToString("columns=" + dt.Columns.Count), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("Id.AutoIncrement=" + dt.Columns["Id"].AutoIncrement.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("Id.Unique=" + dt.Columns["Id"].Unique.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("Id.AllowDBNull=" + dt.Columns["Id"].AllowDBNull.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("Code.DefaultValue=" + dt.Columns["Code"].DefaultValue.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("Code.MaxLength=" + dt.Columns["Code"].MaxLength.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("Memo.Type=" + dt.Columns["Memo"].DataType.Name), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
