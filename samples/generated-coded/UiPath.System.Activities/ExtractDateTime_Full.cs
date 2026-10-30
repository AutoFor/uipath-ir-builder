using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ExtractDateTime_Full）から生成。手で直さず IR を直す
    public class ExtractDateTime_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<DateTime> ds = default;
            DateTime first = default;
            // 日付を取り出す
            {
                var __dates = system.ExtractDateAndTimeFromText("dd/MM/yyyy", "期限: 17/05/2024 と 01/06/2024", new System.Globalization.CultureInfo("ja-JP"));
                ds = __dates;
                first = __dates.FirstOrDefault();
            }
            Log(message: Convert.ToString(ds.Count().ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(first.ToString("yyyy-MM-dd")), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
