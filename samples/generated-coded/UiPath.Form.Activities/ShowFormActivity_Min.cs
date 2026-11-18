using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ShowFormActivity_Min）から生成。手で直さず IR を直す
    public class ShowFormActivity_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String name = default;
            // ShowFormActivity は対応表が無いので XAML 経由（coded/_activities/ShowFormActivity_ff54cc.xaml）
            RunWorkflow("coded/_activities/ShowFormActivity_ff54cc.xaml", null);
            // SetFormFieldsActivity は対応表が無いので XAML 経由（coded/_activities/SetFormFieldsActivity_998fb8.xaml）
            RunWorkflow("coded/_activities/SetFormFieldsActivity_998fb8.xaml", new Dictionary<string, object> { ["in_Arguments_name"] = "太郎" });
            // GetFormFieldsActivity は対応表が無いので XAML 経由（coded/_activities/GetFormFieldsActivity_3d1d13.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/GetFormFieldsActivity_3d1d13.xaml", null);
            name = (String)__xaml1["out_Arguments_name"];
            Log(message: "名前: " + name);
            // CloseFormActivity は対応表が無いので XAML 経由（coded/_activities/CloseFormActivity_126197.xaml）
            RunWorkflow("coded/_activities/CloseFormActivity_126197.xaml", null);
        }
    }
}
