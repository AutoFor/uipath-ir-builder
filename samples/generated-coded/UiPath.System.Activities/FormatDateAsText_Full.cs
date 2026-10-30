using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FormatDateAsText_Full）から生成。手で直さず IR を直す
    public class FormatDateAsText_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DateTime d = default;
            String r1 = default;
            String r2 = default;
            d = new DateTime(2024, 1, 31);
            // 日本語の書式
            r1 = system.FormatDateAsText(source: d, format: "yyyy年M月d日", localizationCode: new System.Globalization.CultureInfo("ja-JP"));
            // 英語の書式
            r2 = system.FormatDateAsText(source: d, format: "dddd, MMMM d, yyyy", localizationCode: new System.Globalization.CultureInfo("en-US"));
            Log(message: r1, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: r2, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
