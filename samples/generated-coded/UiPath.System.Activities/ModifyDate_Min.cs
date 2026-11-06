using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ModifyDate_Min）から生成。手で直さず IR を直す
    public class ModifyDate_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DateTime d = default;
            DateTime r = default;
            d = new DateTime(2024, 1, 31);
            // ModifyDate はCoded API が無い（Coded API なし（ISystemService に該当するメソッドが無い。個々の加工は AddOrSubtractFromDate などで書き分ける））ので XAML 経由（coded/_xaml/ModifyDate_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/ModifyDate_Min_1.xaml", new Dictionary<string, object> { ["d"] = d, ["r"] = r });
            r = (DateTime)__xaml1["r"];
            Log(message: Convert.ToString(r.ToString("yyyy-MM-dd")), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
