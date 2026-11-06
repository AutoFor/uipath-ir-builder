using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RenameFileX_Full）から生成。手で直さず IR を直す
    public class RenameFileX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            IResource res = default;
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\RenameFileX_Full.new.dat"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.WriteTextFile(text: "rename me", file: LocalResource.FromPath("output\\RenameFileX_Full.txt"));
            // 拡張子ごと変える
            // RenameFileX はCoded API が無い（Coded API なし（名前の変更はサービスにメソッドが無い））ので XAML 経由（coded/_xaml/RenameFileX_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/RenameFileX_Full_1.xaml", new Dictionary<string, object> { ["res"] = res });
            res = (IResource)__xaml1["res"];
            Log(message: Convert.ToString(System.IO.Path.GetFileName(((UiPath.Platform.ResourceHandling.ILocalResource)(res)).LocalPath)), level: UiPath.CodedWorkflows.LogLevel.Info);
            ex = system.PathExists(path: "output\\RenameFileX_Full.new.dat", pathType: UiPath.Core.Activities.PathType.File);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            ex = system.PathExists(path: "output\\RenameFileX_Full.txt", pathType: UiPath.Core.Activities.PathType.File);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
