using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetSecret_Min）から生成。手で直さず IR を直す
    public class GetSecret_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            SecureString secret = default;
            // GetSecret はCoded API が無い（Coded API なし（ISystemService に GetSecret が無い））ので XAML 経由（coded/_xaml/GetSecret_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/GetSecret_Min_1.xaml", new Dictionary<string, object> { ["secret"] = secret });
            secret = (SecureString)__xaml1["secret"];
            Log(message: "シークレットを取得した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
