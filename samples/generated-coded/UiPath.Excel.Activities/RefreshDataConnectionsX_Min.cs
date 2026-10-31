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
    // tools/ir/gen-coded.ts で IR（RefreshDataConnectionsX_Min）から生成。手で直さず IR を直す
    public class RefreshDataConnectionsX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object a = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\RefreshDataConnectionsX_Min.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\RefreshDataConnectionsX_Min.xlsx", SaveChanges = true, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                Excel.RefreshDataConnections();
                a = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A2"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "A2: [" + Convert.ToString(a) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
