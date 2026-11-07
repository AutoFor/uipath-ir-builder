using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RenameFileX_Resource）から生成。手で直さず IR を直す
    public class RenameFileX_Resource : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            ILocalResource src = default;
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\RenameFileX_Resource.new.txt"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.WriteTextFile(text: "rename me", file: LocalResource.FromPath("output\\RenameFileX_Resource.txt"));
            src = system.PathExists("output\\RenameFileX_Resource.txt", UiPath.Core.Activities.PathType.File) ? LocalResource.FromPath("output\\RenameFileX_Resource.txt") : null;
            // リソースで名前を変える
            // RenameFileX はCoded API が無い（Coded API なし（名前の変更はサービスにメソッドが無い））ので XAML 経由（coded/_activities/RenameFileX_c465ef.xaml）
            RunWorkflow("coded/_activities/RenameFileX_c465ef.xaml", new Dictionary<string, object> { ["in_FileResource"] = src, ["in_NewName"] = "RenameFileX_Resource.new" });
            ex = system.PathExists(path: "output\\RenameFileX_Resource.new.txt", pathType: UiPath.Core.Activities.PathType.File);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            ex = system.PathExists(path: "output\\RenameFileX_Resource.txt", pathType: UiPath.Core.Activities.PathType.File);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
