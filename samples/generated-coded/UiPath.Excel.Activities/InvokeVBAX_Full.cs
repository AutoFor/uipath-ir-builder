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
    // tools/ir/gen-coded.ts で IR（InvokeVBAX_Full）から生成。手で直さず IR を直す
    public class InvokeVBAX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object r = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\InvokeVBAX_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\InvokeVBAX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                // 足し算
                var __collect1 = new List<object>();
                __collect1.Add(2);
                __collect1.Add(3);
                r = Excel.InvokeVBA(codeFilePath: "data\\excel\\vba\\AddNumbers.bas", entryMethodname: "AddNumbers", arguments: __collect1);
                Log(message: "結果: [" + Convert.ToString(r) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
