using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetFolderInfoX_Min）から生成。手で直さず IR を直す
    public class GetFolderInfoX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DirectoryInfo di = default;
            system.CreateFolder(path: "output\\GetFolderInfoX_Min.d");
            // GetFolderInfoX はCoded API が無い（Coded API なし（DirectoryInfo は System.IO の型。サービスにメソッドが無い））ので XAML 経由（coded/_activities/GetFolderInfoX.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/GetFolderInfoX.xaml", new Dictionary<string, object> { ["in_FolderPath"] = "output\\GetFolderInfoX_Min.d" });
            di = (System.IO.DirectoryInfo)__xaml1["out_Output"];
            Log(message: Convert.ToString(di.Name), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: di.Exists.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
