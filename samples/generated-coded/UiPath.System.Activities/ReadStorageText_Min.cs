using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ReadStorageText_Min）から生成。手で直さず IR を直す
    public class ReadStorageText_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String text = default;
            text = system.ReadStorageText(path: "ir/hello.txt", storageBucketName: "ir-bucket");
            Log(message: "内容: " + text, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
