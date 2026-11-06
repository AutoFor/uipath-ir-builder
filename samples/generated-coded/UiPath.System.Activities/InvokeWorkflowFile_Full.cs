using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InvokeWorkflowFile_Full）から生成。手で直さず IR を直す
    public class InvokeWorkflowFile_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String msg = default;
            // 全部のプロパティ
            // InvokeWorkflowFile はこの形の Coded API が無い（InvokeWorkflowFile の ContinueOnError は、呼び先の例外を握りつぶす try / catch を、RunWorkflow に被せる形をまだ作っていない）ので XAML 経由（coded/_xaml/InvokeWorkflowFile_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/InvokeWorkflowFile_Full_1.xaml", new Dictionary<string, object> { ["msg"] = msg });
            msg = (String)__xaml1["msg"];
            Log(message: "戻り値: " + msg, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
