using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AddOrSubtractFromDate_Full）から生成。手で直さず IR を直す
    public class AddOrSubtractFromDate_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DateTime d = default;
            DateTime r1 = default;
            DateTime r2 = default;
            d = new DateTime(2024, 3, 15);
            // 1か月前
            r1 = system.AddOrSubtractFromDate(source: d, unitOfTime: UiPath.Core.Activities.DateTimeUtilities.UnitsOfTime.Months, amountOfTime: 1, selectedOperation: UiPath.Activities.System.Date.AddOrSubtractFromDate.DateOperations.Subtract);
            // 36時間後
            r2 = system.AddOrSubtractFromDate(source: d, unitOfTime: UiPath.Core.Activities.DateTimeUtilities.UnitsOfTime.Hours, amountOfTime: 36, selectedOperation: UiPath.Activities.System.Date.AddOrSubtractFromDate.DateOperations.Add);
            Log(message: Convert.ToString(r1.ToString("yyyy-MM-dd")), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(r2.ToString("yyyy-MM-dd HH:mm")), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
