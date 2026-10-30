using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;
using UiPath.Excel;
using UiPath.Excel.Activities.API;
using UiPath.Excel.Activities.API.Models;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（LookupX_Min）から生成。手で直さず IR を直す
    public class LookupX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object v = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Sample.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true }))
            {
                v = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Range["A1:B4"].LookupRange(label: "花子"), typeof(Object));
            }
            Log(message: "値: " + Convert.ToString(v), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
