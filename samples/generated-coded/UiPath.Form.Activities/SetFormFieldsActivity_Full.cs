using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SetFormFieldsActivity_Full）から生成。手で直さず IR を直す
    public class SetFormFieldsActivity_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String name = default;
            Double age = default;
            UiPath.Studio.Forms.Runtime.SetFormValuesResult[] res = default;
            // ShowFormActivity は対応表が無いので XAML 経由（coded/_activities/ShowFormActivity_062ec4.xaml）
            RunWorkflow("coded/_activities/ShowFormActivity_062ec4.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "書く" });
            // 値を書く
            // SetFormFieldsActivity は対応表が無いので XAML 経由（coded/_activities/SetFormFieldsActivity_996db1.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/SetFormFieldsActivity_996db1.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "書く", ["in_Arguments_age"] = 7, ["in_Arguments_agree"] = true, ["in_Arguments_name"] = "六郎" });
            res = (UiPath.Studio.Forms.Runtime.SetFormValuesResult[])__xaml1["out_Result"];
            // GetFormFieldsActivity は対応表が無いので XAML 経由（coded/_activities/GetFormFieldsActivity_965d56.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/GetFormFieldsActivity_965d56.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "書く" });
            age = (Double)__xaml2["out_Arguments_age"];
            name = (String)__xaml2["out_Arguments_name"];
            Log(message: "書いた: " + name + " " + age.ToString() + " OK=" + res[0].OK.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            // CloseFormActivity は対応表が無いので XAML 経由（coded/_activities/CloseFormActivity_295689.xaml）
            RunWorkflow("coded/_activities/CloseFormActivity_295689.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "書く" });
        }
    }
}
