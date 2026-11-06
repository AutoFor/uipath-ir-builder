using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（MessageBox_Full）から生成。手で直さず IR を直す
    public class MessageBox_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String b = default;
            // メッセージ
            // MessageBox はCoded API が無い（Coded API なし（メッセージボックスの API が ISystemService に無い））ので XAML 経由（coded/_xaml/MessageBox_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/MessageBox_Full_1.xaml", new Dictionary<string, object> { ["b"] = b });
            b = (String)__xaml1["b"];
            Log(message: "閉じた", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
