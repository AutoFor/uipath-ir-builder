using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ReportStatus_Full）から生成。手で直さず IR を直す
    public class ReportStatus_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 pct = 50;
            // 進み具合を知らせる
            // ReportStatus はCoded API が無い（Coded API なし（ISystemService に ReportStatus が無い））ので XAML 経由（coded/_xaml/ReportStatus_Full_1.xaml）
            RunWorkflow("coded/_xaml/ReportStatus_Full_1.xaml", new Dictionary<string, object> { ["pct"] = pct });
            Log(message: "状態を報告した: " + pct.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
