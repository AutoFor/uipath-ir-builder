using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ForEachFolderX_Min）から生成。手で直さず IR を直す
    public class ForEachFolderX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\ForEachFolderX_Min.d"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.CreateFolder(path: "output\\ForEachFolderX_Min.d");
            system.CreateFolder(path: "output\\ForEachFolderX_Min.d\\b");
            system.CreateFolder(path: "output\\ForEachFolderX_Min.d\\a");
            system.CreateFolder(path: "output\\ForEachFolderX_Min.d\\c");
            // ForEachFolderX はCoded API が無い（Coded API なし（フォルダーの列挙は System.IO.Directory.EnumerateDirectories などの .NET の機能。サービスにメソッドが無い））ので XAML 経由（coded/_xaml/ForEachFolderX_Min_1.xaml）
            RunWorkflow("coded/_xaml/ForEachFolderX_Min_1.xaml", null);
        }
    }
}
