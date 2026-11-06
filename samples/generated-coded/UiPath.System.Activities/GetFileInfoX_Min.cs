using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetFileInfoX_Min）から生成。手で直さず IR を直す
    public class GetFileInfoX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            FileInfo fi = default;
            system.WriteTextFile(text: "hello", file: LocalResource.FromPath("output\\GetFileInfoX_Min.txt"));
            // GetFileInfoX はCoded API が無い（Coded API なし（FileInfo は System.IO の型。サービスにメソッドが無い））ので XAML 経由（coded/_activities/GetFileInfoX_79eba2.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/GetFileInfoX_79eba2.xaml", new Dictionary<string, object> { ["in_FilePath"] = "output\\GetFileInfoX_Min.txt" });
            fi = (System.IO.FileInfo)__xaml1["out_Output"];
            Log(message: Convert.ToString(fi.Name), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: fi.Length.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
