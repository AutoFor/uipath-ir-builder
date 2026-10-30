using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateFile_Full）から生成。手で直さず IR を直す
    public class CreateFile_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource res = default;
            Int64 len = default;
            // 空のファイルを作る
            res = system.CreateFile(name: "CreateFile_Full.txt", path: "output");
            Log(message: Convert.ToString(System.IO.Path.GetFileName(res.LocalPath)), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(new System.IO.FileInfo(res.LocalPath).Length.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
