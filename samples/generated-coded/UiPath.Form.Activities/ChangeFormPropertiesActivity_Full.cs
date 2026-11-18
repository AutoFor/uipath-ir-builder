using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ChangeFormPropertiesActivity_Full）から生成。手で直さず IR を直す
    public class ChangeFormPropertiesActivity_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Studio.Forms.Runtime.UpdateFormResult[] res = default;
            // ShowFormActivity は対応表が無いので XAML 経由（coded/_activities/ShowFormActivity_062ec4.xaml）
            RunWorkflow("coded/_activities/ShowFormActivity_062ec4.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "変える" });
            // 窓を変える
            // ChangeFormPropertiesActivity は対応表が無いので XAML 経由（coded/_activities/ChangeFormPropertiesActivity_7a28c5.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/ChangeFormPropertiesActivity_7a28c5.xaml", new Dictionary<string, object> { ["in_Height"] = 400, ["in_InstanceName"] = "変える", ["in_Left"] = 50, ["in_ShowMargin"] = true, ["in_Title"] = "題を変えた", ["in_Top"] = 50, ["in_TopMost"] = true, ["in_Width"] = 500 });
            res = (UiPath.Studio.Forms.Runtime.UpdateFormResult[])__xaml1["out_Result"];
            Log(message: "変えた: OK=" + res[0].OK.ToString());
            // CloseFormActivity は対応表が無いので XAML 経由（coded/_activities/CloseFormActivity_295689.xaml）
            RunWorkflow("coded/_activities/CloseFormActivity_295689.xaml", new Dictionary<string, object> { ["in_InstanceName"] = "変える" });
        }
    }
}
