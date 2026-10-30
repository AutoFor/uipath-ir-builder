using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SetAsset_Full）から生成。手で直さず IR を直す
    public class SetAsset_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // アセットを設定
            system.SetAsset(value: "v2", assetName: "IRAsset", folderPath: "Shared", timeoutMS: 30000);
            Log(message: "アセットを設定した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
