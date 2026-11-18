using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ShowFormActivity_Full）から生成。手で直さず IR を直す
    public class ShowFormActivity_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String name = "次郎";
            Double age = default;
            Boolean agree = default;
            Nullable<Boolean> shown = default;
            // フォームを表示
            // ShowFormActivity は対応表が無いので XAML 経由（coded/_activities/ShowFormActivity_5f842d.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/ShowFormActivity_5f842d.xaml", new Dictionary<string, object> { ["in_Height"] = 360, ["in_InstanceName"] = "全部入り", ["in_Left"] = 100, ["in_ShowInTaskbar"] = true, ["in_ShowMargin"] = true, ["in_Title"] = "あいさつ（全部入り）", ["in_Top"] = 80, ["in_TopMost"] = false, ["in_Width"] = 480, ["in_Arguments_age"] = 42, ["io_Arguments_name"] = name });
            shown = (System.Nullable<System.Boolean>)__xaml1["out_Result"];
            agree = (Boolean)__xaml1["out_Arguments_agree"];
            name = (String)__xaml1["io_Arguments_name"];
            // GetFormFieldsActivity は対応表が無いので XAML 経由（coded/_activities/GetFormFieldsActivity_0cd63b.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/GetFormFieldsActivity_0cd63b.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "全部入り" });
            age = (Double)__xaml2["out_Arguments_age"];
            Log(message: "名前: " + name + " 年齢: " + age.ToString());
            // CloseFormActivity は対応表が無いので XAML 経由（coded/_activities/CloseFormActivity_295689.xaml）
            RunWorkflow("coded/_activities/CloseFormActivity_295689.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "全部入り" });
        }
    }
}
