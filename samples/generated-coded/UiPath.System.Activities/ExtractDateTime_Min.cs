using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ExtractDateTime_Min）から生成。手で直さず IR を直す
    public class ExtractDateTime_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<DateTime> ds = default;
            {
                var __dates = system.ExtractDateAndTimeFromText("yyyy-MM-dd", "開始は2024-05-17、終了は2024-06-01です", new System.Globalization.CultureInfo("ja-JP"));
                ds = __dates;
                _ = __dates.FirstOrDefault();
            }
            Log(message: Convert.ToString(ds.Count().ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(ds.First().ToString("yyyy-MM-dd")), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
