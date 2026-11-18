using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ExecuteScriptActivity_Full）から生成。手で直さず IR を直す
    public class ExecuteScriptActivity_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Studio.Forms.Runtime.ExecuteScriptResult[] res = default;
            // ShowFormActivity は対応表が無いので XAML 経由（coded/_activities/ShowFormActivity_062ec4.xaml）
            RunWorkflow("coded/_activities/ShowFormActivity_062ec4.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "スクリプト" });
            // スクリプトを動かす
            // ExecuteScriptActivity は対応表が無いので XAML 経由（coded/_activities/ExecuteScriptActivity_47aec8.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/ExecuteScriptActivity_47aec8.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "スクリプト", ["in_Source"] = "1 + 2" });
            res = (UiPath.Studio.Forms.Runtime.ExecuteScriptResult[])__xaml1["out_Result"];
            Log(message: "結果: " + res[0].OK.ToString() + " " + (res[0].Value == null ? "(なし)" : res[0].Value.ToString()));
            // CloseFormActivity は対応表が無いので XAML 経由（coded/_activities/CloseFormActivity_295689.xaml）
            RunWorkflow("coded/_activities/CloseFormActivity_295689.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "スクリプト" });
        }
    }
}
