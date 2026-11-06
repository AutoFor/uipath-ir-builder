using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetFolderInfoX_Full）から生成。手で直さず IR を直す
    public class GetFolderInfoX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DirectoryInfo di = default;
            system.CreateFolder(path: "output\\GetFolderInfoX_Full.d");
            // フォルダー情報
            // GetFolderInfoX はCoded API が無い（Coded API なし（DirectoryInfo は System.IO の型。サービスにメソッドが無い））ので XAML 経由（coded/_xaml/GetFolderInfoX_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/GetFolderInfoX_Full_1.xaml", new Dictionary<string, object> { ["di"] = di });
            di = (DirectoryInfo)__xaml1["di"];
            Log(message: Convert.ToString(di.Name), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: di.Exists.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(di.Parent.Name), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
