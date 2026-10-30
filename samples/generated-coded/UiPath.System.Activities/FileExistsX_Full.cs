using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FileExistsX_Full）から生成。手で直さず IR を直す
    public class FileExistsX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            Boolean ex2 = default;
            Boolean ex3 = default;
            system.WriteTextFile(text: "hi", file: LocalResource.FromPath("output\\FileExistsX_Full.txt"));
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\FileExistsX_Full.none"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.CreateFolder(path: "output\\FileExistsX_Full.dir");
            // あるファイル
            ex = system.FileExists(path: "output\\FileExistsX_Full.txt");
            // 無いファイル
            ex2 = system.FileExists(path: "output\\FileExistsX_Full.none");
            // フォルダーはファイルではない
            ex3 = system.FileExists(path: "output\\FileExistsX_Full.dir");
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(ex2.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(ex3.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
