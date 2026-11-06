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
            // InvokeProcess はこの形の Coded API が無い（引数（Arguments / OutputArguments）を渡す形は、InvokeProcessAsync が辞書で受け渡すので対応表にできない（Out の引数を変数に戻す仕組みが生成器に無い））ので XAML 経由（coded/_activities/InvokeProcess_4c9ec9.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/InvokeProcess_4c9ec9.xaml", new Dictionary<string, object> { ["in_ContinueOnError"] = false, ["in_EntryPointPath"] = "Main.xaml", ["in_FolderPath"] = "Shared", ["in_ProcessName"] = "IrbSampleProcess", ["in_Timeout"] = TimeSpan.FromMinutes(5), ["in_Arguments_in_Name"] = "world" });
            outArgs = (System.Collections.Generic.Dictionary<System.String, System.Object>)__xaml1["out_OutputArguments"];
            resultText = (String)__xaml1["out_Arguments_out_Result"];
        }
    }
}
