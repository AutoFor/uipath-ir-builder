using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetFormFieldsActivity_Full）から生成。手で直さず IR を直す
    public class GetFormFieldsActivity_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String name = default;
            Double age = default;
            Boolean agree = default;
            UiPath.Studio.Forms.Runtime.GetFormValuesResult res = default;
            // ShowFormActivity は対応表が無いので XAML 経由（coded/_activities/ShowFormActivity_9a2a47.xaml）
            RunWorkflow("coded/_activities/ShowFormActivity_9a2a47.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "読む", ["in_Arguments_age"] = 30, ["in_Arguments_agree"] = true, ["in_Arguments_name"] = "四郎" });
            // 値を読む
            // GetFormFieldsActivity は対応表が無いので XAML 経由（coded/_activities/GetFormFieldsActivity_5db2b5.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/GetFormFieldsActivity_5db2b5.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "読む" });
            res = (UiPath.Studio.Forms.Runtime.GetFormValuesResult)__xaml1["out_Result"];
            age = (Double)__xaml1["out_Arguments_age"];
            agree = (Boolean)__xaml1["out_Arguments_agree"];
            name = (String)__xaml1["out_Arguments_name"];
            Log(message: "読んだ: " + name + " " + age.ToString() + " " + agree.ToString() + " OK=" + res.OK.ToString());
            // CloseFormActivity は対応表が無いので XAML 経由（coded/_activities/CloseFormActivity_295689.xaml）
            RunWorkflow("coded/_activities/CloseFormActivity_295689.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "読む" });
        }
    }
}
