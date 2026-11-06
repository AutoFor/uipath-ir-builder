using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（MoveFolderX_Full）から生成。手で直さず IR を直す
    public class MoveFolderX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            String txt = default;
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\MoveFolderX_Full.src"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\MoveFolderX_Full.dst"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.CreateFolder(path: "output\\MoveFolderX_Full.src");
            system.CreateFolder(path: "output\\MoveFolderX_Full.src\\sub");
            system.WriteTextFile(text: "new", file: LocalResource.FromPath("output\\MoveFolderX_Full.src\\a.txt"));
            system.WriteTextFile(text: "sub", file: LocalResource.FromPath("output\\MoveFolderX_Full.src\\sub\\b.txt"));
            system.CreateFolder(path: "output\\MoveFolderX_Full.dst");
            system.CreateFolder(path: "output\\MoveFolderX_Full.dst\\MoveFolderX_Full.src");
            system.WriteTextFile(text: "old", file: LocalResource.FromPath("output\\MoveFolderX_Full.dst\\MoveFolderX_Full.src\\a.txt"));
            // 上書きで移動
            // MoveFolderX はCoded API が無い（Coded API なし（サービスの MoveFile はファイルのリソース用で、フォルダーの移動は無い））ので XAML 経由（coded/_activities/MoveFolderX_77c654.xaml）
            RunWorkflow("coded/_activities/MoveFolderX_77c654.xaml", new Dictionary<string, object> { ["in_From"] = "output\\MoveFolderX_Full.src", ["in_To"] = "output\\MoveFolderX_Full.dst" });
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\MoveFolderX_Full.dst\\MoveFolderX_Full.src\\a.txt"));
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
            ex = system.PathExists(path: "output\\MoveFolderX_Full.dst\\MoveFolderX_Full.src\\sub\\b.txt", pathType: UiPath.Core.Activities.PathType.File);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            ex = system.PathExists(path: "output\\MoveFolderX_Full.src", pathType: UiPath.Core.Activities.PathType.Folder);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
