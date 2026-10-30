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
    // tools/ir/gen-coded.ts で IR（ExcelProcessScopeX_Min）から生成。手で直さず IR を直す
    public class ExcelProcessScopeX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object a = default;
            using (var ExcelProcessScopeTag = excel.ExcelProcessScope(options: new ScopeOptions {  }))
            {
                using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Sample.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true, ExcelProcess = ExcelProcessScopeTag }))
                {
                    a = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A2"].ReadCellValue(getFormattedText: true), typeof(Object));
                }
                Log(message: "A2: [" + Convert.ToString(a) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
