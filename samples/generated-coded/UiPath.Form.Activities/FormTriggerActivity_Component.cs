using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FormTriggerActivity_Component）から生成。手で直さず IR を直す
    public class FormTriggerActivity_Component : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean stp = default;
            Int32 n = default;
            UiPath.Studio.Forms.Runtime.ExecuteScriptResult[] scr = default;
            // ShowFormActivity は対応表が無いので XAML 経由（coded/_activities/ShowFormActivity_062ec4.xaml）
            RunWorkflow("coded/_activities/ShowFormActivity_062ec4.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "部品" });
            // 3 秒後にボタンを押して年齢を変える（人の操作の代わり）
            // ExecuteScriptActivity は対応表が無いので XAML 経由（coded/_activities/ExecuteScriptActivity_47aec8.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/ExecuteScriptActivity_47aec8.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "部品", ["in_Source"] = "setTimeout(function () { document.querySelector('button[name=\"data[greet]\"]').click(); var a = document.querySelector('input[name=\"data[age]\"]'); a.focus(); a.value = '21'; a.dispatchEvent(new Event('input', { bubbles: true })); a.blur(); }, 3000)" });
            scr = (UiPath.Studio.Forms.Runtime.ExecuteScriptResult[])__xaml1["out_Result"];
            // TriggerScope はCoded API が無い（Coded API なし（トリガーは ISystemService に無い））ので XAML 経由（coded/_xaml/FormTriggerActivity_Component_1.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/FormTriggerActivity_Component_1.xaml", new Dictionary<string, object> { ["n"] = n, ["stp"] = stp });
            n = (Int32)__xaml2["n"];
            stp = (Boolean)__xaml2["stp"];
            // CloseFormActivity は対応表が無いので XAML 経由（coded/_activities/CloseFormActivity_295689.xaml）
            RunWorkflow("coded/_activities/CloseFormActivity_295689.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "部品" });
        }
    }
}
