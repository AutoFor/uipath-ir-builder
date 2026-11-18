using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ChangeFormPropertiesActivity_Min）から生成。手で直さず IR を直す
    public class ChangeFormPropertiesActivity_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // ShowFormActivity は対応表が無いので XAML 経由（coded/_activities/ShowFormActivity_ff54cc.xaml）
            RunWorkflow("coded/_activities/ShowFormActivity_ff54cc.xaml", null);
            // ChangeFormPropertiesActivity は対応表が無いので XAML 経由（coded/_activities/ChangeFormPropertiesActivity_5cf619.xaml）
            RunWorkflow("coded/_activities/ChangeFormPropertiesActivity_5cf619.xaml", new Dictionary<string, object> { ["in_Title"] = "題を変えた" });
            Log(message: "変えた");
            // CloseFormActivity は対応表が無いので XAML 経由（coded/_activities/CloseFormActivity_126197.xaml）
            RunWorkflow("coded/_activities/CloseFormActivity_126197.xaml", null);
        }
    }
}
