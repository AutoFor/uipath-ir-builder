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
    // tools/ir/gen-coded.ts で IR（ExcelGetWorkbookSheet_Min）から生成。手で直さず IR を直す
    public class ExcelGetWorkbookSheet_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> sheets = default;
            String nm = default;
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "data\\excel\\Sample.xlsx", CreateNew = true }))
            {
                nm = ExcelWorkbookScope.GetSheets(false).ElementAt(0);
            }
            Log(message: "sheet0=" + nm, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
