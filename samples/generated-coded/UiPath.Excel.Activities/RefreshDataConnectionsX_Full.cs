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
    // tools/ir/gen-coded.ts で IR（RefreshDataConnectionsX_Full）から生成。手で直さず IR を直す
    public class RefreshDataConnectionsX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object a = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\RefreshDataConnectionsX_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\RefreshDataConnectionsX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                // 接続を更新（接続なし）
                Excel.RefreshDataConnections();
                a = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["B2"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "B2: [" + Convert.ToString(a) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
