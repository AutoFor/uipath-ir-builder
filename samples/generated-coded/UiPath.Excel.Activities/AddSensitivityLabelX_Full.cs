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
    // tools/ir/gen-coded.ts で IR（AddSensitivityLabelX_Full）から生成。手で直さず IR を直す
    public class AddSensitivityLabelX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IExcelLabelObject lbl = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\AddSensitivityLabelX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = false, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                lbl = Excel.GetSensitivityLabel();
                // ラベルを付ける
                Excel.AddSensitivityLabel(label: (UiPath.Excel.IExcelLabelObject)lbl);
            }
        }
    }
}
