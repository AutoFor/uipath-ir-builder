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
    // tools/ir/gen-coded.ts で IR（ExcelProcessScopeX_Full）から生成。手で直さず IR を直す
    public class ExcelProcessScopeX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object a = default;
            using (var ExcelProcessScopeTag = excel.ExcelProcessScope(options: new ScopeOptions { DisplayAllerts = false, ExistingProcessAction = UiPath.Excel.ExistingExcelProcessAction.None, FileConflictResolution = UiPath.Excel.ExcelFileConflictResolution.None, LaunchMethod = UiPath.Excel.ExcelStartMethod.Automation, LaunchTimeout = 60, MacroSetting = UiPath.Excel.MacroSetting.EnableAll, ProcessMode = UiPath.Excel.ExcelProcessMode.AlwaysCreateNew, ShowExcelWindow = false }))
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
