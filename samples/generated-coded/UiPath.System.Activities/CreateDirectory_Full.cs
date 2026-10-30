using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateDirectory_Full）から生成。手で直さず IR を直す
    public class CreateDirectory_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource dirRes = default;
            // 入れ子のフォルダを作る
            dirRes = system.CreateFolder(path: "output\\CreateDirectory_Full\\a\\b");
            Log(message: Convert.ToString(System.IO.Path.GetFileName(dirRes.LocalPath)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
