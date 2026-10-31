using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FormatDateAsText_Min）から生成。手で直さず IR を直す
    public class FormatDateAsText_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DateTime d = default;
            String r = default;
            d = new DateTime(2024, 1, 31);
            r = system.FormatDateAsText(source: d, format: "yyyy-MM-dd", localizationCode: new System.Globalization.CultureInfo("ja-JP"));
            Log(message: r, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
