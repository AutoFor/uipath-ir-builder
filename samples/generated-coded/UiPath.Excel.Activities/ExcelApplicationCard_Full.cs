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
    // tools/ir/gen-coded.ts で IR（ExcelApplicationCard_Full）から生成。手で直さず IR を直す
    public class ExcelApplicationCard_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String name = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Sample.xlsx", SaveChanges = false, CreateIfNotExist = false, ReadOnly = true, KeepExcelOpen = false, ReadFormatting = UiPath.Excel.ReadFormattingOptions.DisplayValue, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None, SensitivityOperation = UiPath.Excel.ExcelLabelOperation.None }))
            {
                name = (String)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A3"].ReadCellValue(getFormattedText: true), typeof(String));
            }
            Log(message: "A3: " + name, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
