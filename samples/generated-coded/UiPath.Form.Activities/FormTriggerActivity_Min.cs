using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FormTriggerActivity_Min）から生成。手で直さず IR を直す
    public class FormTriggerActivity_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean stp = default;
            // ShowFormActivity は対応表が無いので XAML 経由（coded/_activities/ShowFormActivity_de60fb.xaml）
            RunWorkflow("coded/_activities/ShowFormActivity_de60fb.xaml", null);
            // SetFormFieldsActivity は対応表が無いので XAML 経由（coded/_activities/SetFormFieldsActivity_b72e56.xaml）
            RunWorkflow("coded/_activities/SetFormFieldsActivity_b72e56.xaml", new Dictionary<string, object> { ["in_Arguments_name"] = "花子" });
            // ExecuteScriptActivity は対応表が無いので XAML 経由（coded/_activities/ExecuteScriptActivity_d57abe.xaml）
            RunWorkflow("coded/_activities/ExecuteScriptActivity_d57abe.xaml", new Dictionary<string, object> { ["in_Source"] = "setTimeout(function () { document.querySelector('button').click(); }, 3000)" });
            // TriggerScope はCoded API が無い（Coded API なし（トリガーは ISystemService に無い））ので XAML 経由（coded/_xaml/FormTriggerActivity_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/FormTriggerActivity_Min_1.xaml", new Dictionary<string, object> { ["stp"] = stp });
            stp = (Boolean)__xaml1["stp"];
            // CloseFormActivity は対応表が無いので XAML 経由（coded/_activities/CloseFormActivity_19e5b0.xaml）
            RunWorkflow("coded/_activities/CloseFormActivity_19e5b0.xaml", null);
        }
    }
}
