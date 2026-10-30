using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（PathExists_Full）から生成。手で直さず IR を直す
    public class PathExists_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            ILocalResource res = default;
            Boolean ex2 = default;
            system.CreateFolder(path: "output\\PathExists_Full");
            // フォルダを確かめる
            ex = system.PathExists("output\\PathExists_Full", UiPath.Core.Activities.PathType.Folder); res = ex ? LocalResource.FromPath("output\\PathExists_Full") : null;
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(System.IO.Path.GetFileName(res.LocalPath)), level: UiPath.CodedWorkflows.LogLevel.Info);
            // 無いファイルを確かめる
            ex2 = system.PathExists(path: "output\\PathExists_Full\\none.txt", pathType: UiPath.Core.Activities.PathType.File);
            Log(message: Convert.ToString(ex2.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
