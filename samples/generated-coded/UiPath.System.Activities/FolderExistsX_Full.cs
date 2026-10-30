using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FolderExistsX_Full）から生成。手で直さず IR を直す
    public class FolderExistsX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            Boolean ex2 = default;
            Boolean ex3 = default;
            system.CreateFolder(path: "output\\FolderExistsX_Full.d");
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\FolderExistsX_Full.none"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.WriteTextFile(text: "hi", file: LocalResource.FromPath("output\\FolderExistsX_Full.txt"));
            // あるフォルダー
            ex = system.FolderExists(path: "output\\FolderExistsX_Full.d");
            // 無いフォルダー
            ex2 = system.FolderExists(path: "output\\FolderExistsX_Full.none");
            // ファイルはフォルダーではない
            ex3 = system.FolderExists(path: "output\\FolderExistsX_Full.txt");
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(ex2.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(ex3.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
