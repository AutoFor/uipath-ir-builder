using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（MoveFolderX_Min）から生成。手で直さず IR を直す
    public class MoveFolderX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            String txt = default;
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\MoveFolderX_Min.src"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\MoveFolderX_Min.dst"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.CreateFolder(path: "output\\MoveFolderX_Min.src");
            system.WriteTextFile(text: "move folder", file: LocalResource.FromPath("output\\MoveFolderX_Min.src\\a.txt"));
            system.CreateFolder(path: "output\\MoveFolderX_Min.dst");
            // MoveFolderX はCoded API が無い（Coded API なし（サービスの MoveFile はファイルのリソース用で、フォルダーの移動は無い））ので XAML 経由（coded/_activities/MoveFolderX.xaml）
            RunWorkflow("coded/_activities/MoveFolderX.xaml", new Dictionary<string, object> { ["in_From"] = "output\\MoveFolderX_Min.src", ["in_To"] = "output\\MoveFolderX_Min.dst" });
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\MoveFolderX_Min.dst\\MoveFolderX_Min.src\\a.txt"));
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
            ex = system.PathExists(path: "output\\MoveFolderX_Min.src", pathType: UiPath.Core.Activities.PathType.Folder);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
