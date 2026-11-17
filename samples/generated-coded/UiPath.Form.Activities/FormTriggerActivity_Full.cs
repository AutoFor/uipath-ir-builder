using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FormTriggerActivity_Full）から生成。手で直さず IR を直す
    public class FormTriggerActivity_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean stp = default;
            Int32 n = default;
            // ShowFormActivity は対応表が無いので XAML 経由（coded/_activities/ShowFormActivity_062ec4.xaml）
            RunWorkflow("coded/_activities/ShowFormActivity_062ec4.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "トリガー" });
            // TriggerScope はCoded API が無い（Coded API なし（トリガーは ISystemService に無い））ので XAML 経由（coded/_xaml/FormTriggerActivity_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/FormTriggerActivity_Full_1.xaml", new Dictionary<string, object> { ["stp"] = stp, ["n"] = n });
            stp = (Boolean)__xaml1["stp"];
            n = (Int32)__xaml1["n"];
            // CloseFormActivity は対応表が無いので XAML 経由（coded/_activities/CloseFormActivity_295689.xaml）
            RunWorkflow("coded/_activities/CloseFormActivity_295689.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "トリガー" });
        }
    }
}
