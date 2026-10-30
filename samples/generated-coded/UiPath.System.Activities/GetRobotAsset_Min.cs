using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetRobotAsset_Min）から生成。手で直さず IR を直す
    public class GetRobotAsset_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object val = default;
            val = system.GetAsset(assetName: "IRAsset");
            Log(message: "アセット: " + val.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
