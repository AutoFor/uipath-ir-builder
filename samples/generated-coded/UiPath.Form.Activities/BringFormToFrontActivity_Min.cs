using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（BringFormToFrontActivity_Min）から生成。手で直さず IR を直す
    public class BringFormToFrontActivity_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // ShowFormActivity は対応表が無いので XAML 経由（coded/_activities/ShowFormActivity_ff54cc.xaml）
            RunWorkflow("coded/_activities/ShowFormActivity_ff54cc.xaml", null);
            // HideFormActivity は対応表が無いので XAML 経由（coded/_activities/HideFormActivity_70b846.xaml）
            RunWorkflow("coded/_activities/HideFormActivity_70b846.xaml", null);
            // BringFormToFrontActivity は対応表が無いので XAML 経由（coded/_activities/BringFormToFrontActivity_57cb6e.xaml）
            RunWorkflow("coded/_activities/BringFormToFrontActivity_57cb6e.xaml", null);
            Log(message: "前に出した");
            // CloseFormActivity は対応表が無いので XAML 経由（coded/_activities/CloseFormActivity_126197.xaml）
            RunWorkflow("coded/_activities/CloseFormActivity_126197.xaml", null);
        }
    }
}
