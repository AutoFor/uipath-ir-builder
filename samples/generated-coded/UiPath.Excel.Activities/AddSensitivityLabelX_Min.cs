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
    // tools/ir/gen-coded.ts で IR（AddSensitivityLabelX_Min）から生成。手で直さず IR を直す
    public class AddSensitivityLabelX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IExcelLabelObject lbl = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\AddSensitivityLabelX_Min.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = false }))
            {
                lbl = Excel.GetSensitivityLabel();
                Excel.AddSensitivityLabel(label: (UiPath.Excel.IExcelLabelObject)lbl);
            }
        }
    }
}
