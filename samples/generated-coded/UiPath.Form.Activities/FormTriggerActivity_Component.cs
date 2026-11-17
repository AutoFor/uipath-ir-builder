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
            // 名前・ボタン・年齢を 1 秒ずつあけて操作する（人の操作の代わり。同じ瞬間に変えると最後の部品の changed しか出ない）
            // ExecuteScriptActivity は対応表が無いので XAML 経由（coded/_activities/ExecuteScriptActivity_47aec8.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/ExecuteScriptActivity_47aec8.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "部品", ["in_Source"] = "function sv(k, v) { var i = document.querySelector('input[name=\"data[' + k + ']\"]'); i.focus(); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); } setTimeout(function () { sv('name', '十郎'); }, 3000); setTimeout(function () { document.querySelector('button[name=\"data[greet]\"]').click(); }, 4000); setTimeout(function () { sv('age', '21'); }, 5000)" });
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
