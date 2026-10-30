using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（NSetCVServer_Min）から生成。手で直さず IR を直す
    public class NSetCVServer_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // CV サーバーを設定する
            uiAutomation.SetCVServer(server: "https://cv.example.invalid", apiKey: "", useLocalServer: false);
        }
    }
}
