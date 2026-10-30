using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SetAsset_Min）から生成。手で直さず IR を直す
    public class SetAsset_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            system.SetAsset(value: "v1", assetName: "IRAsset");
            Log(message: "アセットを設定した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
