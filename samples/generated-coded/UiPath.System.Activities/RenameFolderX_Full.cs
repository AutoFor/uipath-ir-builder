using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RenameFolderX_Full）から生成。手で直さず IR を直す
    public class RenameFolderX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            String txt = default;
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\RenameFolderX_Full.new"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\RenameFolderX_Full.old"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.CreateFolder(path: "output\\RenameFolderX_Full.old");
            system.WriteTextFile(text: "in folder", file: LocalResource.FromPath("output\\RenameFolderX_Full.old\\a.txt"));
            // フォルダー名を変える
            // RenameFolderX はCoded API が無い（Coded API なし（名前の変更はサービスにメソッドが無い））ので XAML 経由（coded/_activities/RenameFolderX.xaml）
            RunWorkflow("coded/_activities/RenameFolderX.xaml", new Dictionary<string, object> { ["in_FolderPath"] = "output\\RenameFolderX_Full.old", ["in_NewName"] = "RenameFolderX_Full.new" });
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\RenameFolderX_Full.new\\a.txt"));
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
            ex = system.PathExists(path: "output\\RenameFolderX_Full.old", pathType: UiPath.Core.Activities.PathType.Folder);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
