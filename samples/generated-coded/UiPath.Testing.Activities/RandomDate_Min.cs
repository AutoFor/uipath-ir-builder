using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RandomDate_Min）から生成。手で直さず IR を直す
    public class RandomDate_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DateTime d = default;
            // 2020 年の日付
            d = testing.RandomDate(minDate: new DateTime(2020, 1, 1), maxDate: new DateTime(2020, 12, 31));
            Log(message: Convert.ToString("year=" + d.Year), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
