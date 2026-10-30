using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AddOrSubtractFromDate_Min）から生成。手で直さず IR を直す
    public class AddOrSubtractFromDate_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DateTime d = default;
            DateTime r = default;
            d = new DateTime(2024, 1, 31);
            r = system.AddOrSubtractFromDate(source: d, unitOfTime: UiPath.Core.Activities.DateTimeUtilities.UnitsOfTime.Days, amountOfTime: 1, selectedOperation: UiPath.Activities.System.Date.AddOrSubtractFromDate.DateOperations.Add);
            Log(message: Convert.ToString(r.ToString("yyyy-MM-dd")), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
