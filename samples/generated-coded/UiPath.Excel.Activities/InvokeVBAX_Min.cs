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
    // tools/ir/gen-coded.ts で IR（InvokeVBAX_Min）から生成。手で直さず IR を直す
    public class InvokeVBAX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\InvokeVBAX_Min.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\InvokeVBAX_Min.xlsx", SaveChanges = true, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                var __collect1 = new List<object>();
                Excel.InvokeVBA(codeFilePath: "data\\excel\\vba\\AddNumbers.bas", entryMethodname: "Hello", arguments: __collect1);
                Log(message: "実行した", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
