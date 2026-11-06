using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（BeginProcess_Full）から生成。手で直さず IR を直す
    public class BeginProcess_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // 待たずに呼ぶ
            // BeginProcess はCoded API が無い（Coded API なし（待たずに呼ぶ API は無い。InvokeProcessAsync を await せずに書くことはできるが、引数の受け渡しが InvokeProcess と同じ理由で対応表にできない））ので XAML 経由（coded/_xaml/BeginProcess_Full_1.xaml）
            RunWorkflow("coded/_xaml/BeginProcess_Full_1.xaml", null);
        }
    }
}
