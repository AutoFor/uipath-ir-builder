using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SetAsset_Json）から生成。手で直さず IR を直す
    public class SetAsset_Json : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            system.SetAsset(value: "{\"a\":1}", assetName: "IRJsonAsset", folderPath: "Shared", timeoutMS: 30000);
            Log(message: "JSON アセットを設定した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
