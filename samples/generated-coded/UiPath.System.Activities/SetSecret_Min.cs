using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SetSecret_Min）から生成。手で直さず IR を直す
    public class SetSecret_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // SetSecret はCoded API が無い（Coded API なし（ISystemService に SetSecret が無い））ので XAML 経由（coded/_xaml/SetSecret_Min_1.xaml）
            RunWorkflow("coded/_xaml/SetSecret_Min_1.xaml", null);
            Log(message: "シークレットを設定した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
