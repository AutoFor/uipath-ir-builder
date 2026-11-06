using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InvokeProcess_Full）から生成。手で直さず IR を直す
    public class InvokeProcess_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Dictionary<String, Object> outArgs = default;
            Dictionary<String, Object> inArgs = new Dictionary<String, Object>();
            String resultText = default;
            // プロセスを呼ぶ
            // InvokeProcess はこの形の Coded API が無い（引数（Arguments / OutputArguments）を渡す形は、InvokeProcessAsync が辞書で受け渡すので対応表にできない（Out の引数を変数に戻す仕組みが生成器に無い））ので XAML 経由（coded/_xaml/InvokeProcess_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/InvokeProcess_Full_1.xaml", new Dictionary<string, object> { ["outArgs"] = outArgs, ["resultText"] = resultText });
            outArgs = (Dictionary<String, Object>)__xaml1["outArgs"];
            resultText = (String)__xaml1["resultText"];
        }
    }
}
