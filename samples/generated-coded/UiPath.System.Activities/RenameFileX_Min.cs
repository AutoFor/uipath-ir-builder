using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RenameFileX_Min）から生成。手で直さず IR を直す
    public class RenameFileX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\RenameFileX_Min.new.txt"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.WriteTextFile(text: "rename me", file: LocalResource.FromPath("output\\RenameFileX_Min.txt"));
            // RenameFileX はCoded API が無い（Coded API なし（名前の変更はサービスにメソッドが無い））ので XAML 経由（coded/_xaml/RenameFileX_Min_1.xaml）
            RunWorkflow("coded/_xaml/RenameFileX_Min_1.xaml", null);
            ex = system.PathExists(path: "output\\RenameFileX_Min.new.txt", pathType: UiPath.Core.Activities.PathType.File);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            ex = system.PathExists(path: "output\\RenameFileX_Min.txt", pathType: UiPath.Core.Activities.PathType.File);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
