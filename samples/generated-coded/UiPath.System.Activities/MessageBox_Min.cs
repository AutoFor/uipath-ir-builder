using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（MessageBox_Min）から生成。手で直さず IR を直す
    public class MessageBox_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // MessageBox はCoded API が無い（Coded API なし（メッセージボックスの API が ISystemService に無い））ので XAML 経由（coded/_xaml/MessageBox_Min_1.xaml）
            RunWorkflow("coded/_xaml/MessageBox_Min_1.xaml", null);
            Log(message: "閉じた", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
