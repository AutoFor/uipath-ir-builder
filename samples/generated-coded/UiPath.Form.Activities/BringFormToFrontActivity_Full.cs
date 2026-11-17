using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（BringFormToFrontActivity_Full）から生成。手で直さず IR を直す
    public class BringFormToFrontActivity_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Studio.Forms.Runtime.HideFormResult[] res = default;
            // ShowFormActivity は対応表が無いので XAML 経由（coded/_activities/ShowFormActivity_062ec4.xaml）
            RunWorkflow("coded/_activities/ShowFormActivity_062ec4.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "前へ" });
            // HideFormActivity は対応表が無いので XAML 経由（coded/_activities/HideFormActivity_67972b.xaml）
            RunWorkflow("coded/_activities/HideFormActivity_67972b.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "前へ" });
            // 前に出す
            // BringFormToFrontActivity は対応表が無いので XAML 経由（coded/_activities/BringFormToFrontActivity_913b5e.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/BringFormToFrontActivity_913b5e.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "前へ" });
            res = (UiPath.Studio.Forms.Runtime.HideFormResult[])__xaml1["out_Result"];
            Log(message: "前に出した: OK=" + res[0].OK.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            // CloseFormActivity は対応表が無いので XAML 経由（coded/_activities/CloseFormActivity_295689.xaml）
            RunWorkflow("coded/_activities/CloseFormActivity_295689.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "前へ" });
        }
    }
}
