using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateFile_Resource）から生成。手で直さず IR を直す
    public class CreateFile_Resource : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource dirRes = default;
            ILocalResource res = default;
            dirRes = system.CreateFolder(path: "output\\CreateFile_Resource");
            // フォルダのリソースを渡す
            res = system.CreateFile(name: "made.txt", path: ((UiPath.Platform.ResourceHandling.ILocalResource)dirRes).LocalPath);
            Log(message: Convert.ToString(System.IO.Path.GetFileName(res.LocalPath)), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(System.IO.File.Exists(System.IO.Path.Combine(dirRes.LocalPath, "made.txt")).ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
