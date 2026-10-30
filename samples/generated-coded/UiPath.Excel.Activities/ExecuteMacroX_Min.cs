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
    // tools/ir/gen-coded.ts で IR（ExecuteMacroX_Min）から生成。手で直さず IR を直す
    public class ExecuteMacroX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Macro.xlsm", destination: "output\\ExecuteMacroX_Min.xlsm", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\ExecuteMacroX_Min.xlsm", SaveChanges = true, CreateIfNotExist = true }))
            {
                var __collect1 = new List<object>();
                Excel.ExecuteMacro(macroName: "Hello", macroArguments: __collect1);
                Log(message: "実行した", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
